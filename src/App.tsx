import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 타입 및 상수
import type {
  Position,
  ScreenBounds,
  ScreenInfo,
  PetConfig,
  AnimationState,
  ClickThroughMode,
} from './types/pet.types';
import {
  BASE_FRAME_SIZE,
  DEFAULT_PET,
  FRAME_SPEEDS,
  ATTACK_DURATION_MS,
  BEHAVIOR_TICK_MS,
  CLOSE_RADIUS,
  FOLLOW_RADIUS,
  FOLLOW_RUN_DISTANCE,
  INTERACT_MARGIN,
  MIN_SCALE,
  MAX_SCALE,
  SCALE_STEP,
  MOUSE_POLL_INTERVAL,
  MOUSE_STALE_THRESHOLD,
  MOUSE_PERMISSION_THRESHOLD,
  MOUSE_HEALTH_CHECK_INTERVAL,
  WALK_SPEED,
  RUN_SPEED,
  TOTAL_FRAMES,
  GRID_SIZE,
} from './constants/pet.constants';
import { clampPosition } from './utils/position';

// 컴포넌트
import { ErrorBoundary } from './components/ErrorBoundary';
import { ContextMenu } from './components/ContextMenu';
import { PermissionModal } from './components/PermissionModal';
import { StatusNotice } from './components/StatusNotice';
import { StateIndicator } from './components/StateIndicator';

interface PetProps {
  config: PetConfig;
}

function Pet({ config }: PetProps) {
  // 핵심 상태
  const [position, setPosition] = useState<Position>({ x: 200, y: 200 });
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [frame, setFrame] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(config.scale);
  const [showMenu, setShowMenu] = useState(false);

  // 클릭 통과 상태
  const [clickThrough, setClickThrough] = useState(true);
  const [clickThroughMode, setClickThroughMode] = useState<ClickThroughMode>('auto');

  // 화면 및 마우스 상태
  const [screenBounds, setScreenBounds] = useState<ScreenBounds>({
    originX: 0, originY: 0,
    width: window.screen.width,
    height: window.screen.height,
  });
  const [mousePosition, setMousePosition] = useState<Position | null>(null);
  const [mouseTrackingHealthy, setMouseTrackingHealthy] = useState(true);
  const [mouseHookError, setMouseHookError] = useState<string | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);

  // Refs for stable access in callbacks
  const refs = useRef({
    position: { x: 200, y: 200 },
    screenBounds: screenBounds,
    frameSize: BASE_FRAME_SIZE * scale,
    mousePosition: null as Position | null,
    clickThrough: true,
    isDragging: false,
    showMenu: false,
    lastMouseUpdate: Date.now(),
    permissionPrompted: false,
    targetPosition: null as Position | null,
    manualOverrideUntil: 0,
    attackLockUntil: 0,
    dragOffset: { x: 0, y: 0 },
    internalClickThroughUpdate: false,
  });

  const frameSize = BASE_FRAME_SIZE * scale;
  const initialFrameSize = BASE_FRAME_SIZE * config.scale;

  // Ref 동기화
  useEffect(() => {
    refs.current.position = position;
    refs.current.screenBounds = screenBounds;
    refs.current.frameSize = frameSize;
    refs.current.mousePosition = mousePosition;
    refs.current.isDragging = isDragging;
    refs.current.showMenu = showMenu;
  }, [position, screenBounds, frameSize, mousePosition, isDragging, showMenu]);

  // 클릭 통과 상태 안전하게 설정
  const setClickThroughSafe = useCallback((enabled: boolean) => {
    if (refs.current.clickThrough === enabled) return;
    refs.current.clickThrough = enabled;
    refs.current.internalClickThroughUpdate = true;
    setClickThrough(enabled);
    invoke('set_click_through', { enabled }).catch(() => {});
    setTimeout(() => { refs.current.internalClickThroughUpdate = false; }, 200);
  }, []);

  // 초기 클릭 통과 상태 조회
  useEffect(() => {
    invoke<boolean>('get_click_through').then((value) => {
      setClickThrough(value);
      refs.current.clickThrough = value;
    }).catch(() => {});
  }, []);

  // 이벤트 리스너 설정
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      unlisteners.push(await listen<boolean>('click_through_changed', (e) => {
        setClickThrough(e.payload);
        refs.current.clickThrough = e.payload;
        if (!refs.current.internalClickThroughUpdate) {
          setClickThroughMode(e.payload ? 'locked_on' : 'locked_off');
        }
        refs.current.internalClickThroughUpdate = false;
      }));

      unlisteners.push(await listen<Position>('mouse_click', (e) => {
        if (!refs.current.clickThrough || refs.current.isDragging || refs.current.showMenu) return;
        const { screenBounds: b, frameSize: s } = refs.current;
        const target = clampPosition(
          { x: e.payload.x - b.originX - s / 2, y: e.payload.y - b.originY - s / 2 },
          s, b
        );
        refs.current.targetPosition = target;
        refs.current.manualOverrideUntil = Date.now() + 2600;
        setAnimState('run');
      }));

      unlisteners.push(await listen<ClickThroughMode>('click_through_mode_changed', (e) => {
        setClickThroughMode(e.payload);
      }));

      unlisteners.push(await listen<string>('mouse_hook_error', (e) => {
        setMouseHookError(e.payload);
        setPermissionRequired(true);
        refs.current.permissionPrompted = true;
      }));
    };

    setup();
    return () => unlisteners.forEach((fn) => fn());
  }, []);

  // 화면 설정
  useEffect(() => {
    const setupScreens = async () => {
      try {
        const monitors = await invoke<ScreenInfo[]>('get_all_monitors');
        if (monitors?.length > 0) {
          const minX = Math.min(...monitors.map((m) => m.x));
          const minY = Math.min(...monitors.map((m) => m.y));
          const maxX = Math.max(...monitors.map((m) => m.x + m.width));
          const maxY = Math.max(...monitors.map((m) => m.y + m.height));
          const width = maxX - minX, height = maxY - minY;
          setScreenBounds({ originX: minX, originY: minY, width, height });
          setPosition({ x: width / 2 - initialFrameSize / 2, y: height / 2 - initialFrameSize / 2 });
          await invoke('set_window_bounds', { x: minX, y: minY, width, height });
          return;
        }
      } catch (e) { console.error(e); }

      const { width, height } = window.screen;
      setScreenBounds({ originX: 0, originY: 0, width, height });
      setPosition({ x: width / 2 - initialFrameSize / 2, y: height / 2 - initialFrameSize / 2 });
      invoke('set_window_bounds', { x: 0, y: 0, width, height }).catch(console.error);
    };
    setupScreens();
  }, [initialFrameSize]);

  // 크기 변경 시 위치 보정
  useEffect(() => {
    setPosition((p) => clampPosition(p, frameSize, screenBounds));
  }, [frameSize, screenBounds]);

  // 프레임 애니메이션
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % TOTAL_FRAMES), FRAME_SPEEDS[animState]);
    return () => clearInterval(id);
  }, [animState]);

  // 마우스 위치 폴링
  useEffect(() => {
    let mounted = true;
    const id = setInterval(async () => {
      try {
        const pos = await invoke<Position | null>('get_mouse_position');
        if (!mounted || !pos) return;
        refs.current.lastMouseUpdate = Date.now();
        setMouseTrackingHealthy(true);
        setMousePosition({ x: pos.x - screenBounds.originX, y: pos.y - screenBounds.originY });
      } catch { setMouseTrackingHealthy(false); }
    }, MOUSE_POLL_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [screenBounds.originX, screenBounds.originY]);

  // 마우스 바라보기
  useEffect(() => {
    if (!mousePosition) return;
    setIsFlipped(mousePosition.x < position.x + frameSize / 2);
  }, [mousePosition, position.x, frameSize]);

  // 자동 클릭 통과 모드
  useEffect(() => {
    if (clickThroughMode !== 'auto' || !mousePosition) return;
    if (isDragging || showMenu) { setClickThroughSafe(false); return; }
    if (!mouseTrackingHealthy) { setClickThroughSafe(true); return; }

    const { x, y } = refs.current.position;
    const s = refs.current.frameSize;
    const inside = mousePosition.x >= x - INTERACT_MARGIN && mousePosition.x <= x + s + INTERACT_MARGIN
      && mousePosition.y >= y - INTERACT_MARGIN && mousePosition.y <= y + s + INTERACT_MARGIN;
    setClickThroughSafe(!inside);
  }, [mousePosition, isDragging, showMenu, mouseTrackingHealthy, clickThroughMode, setClickThroughSafe]);

  // 마우스 추적 건강 체크
  useEffect(() => {
    if (clickThroughMode !== 'auto') return;
    const id = setInterval(() => {
      const age = Date.now() - refs.current.lastMouseUpdate;
      if (age > MOUSE_STALE_THRESHOLD) {
        setMouseTrackingHealthy(false);
        setClickThroughSafe(true);
        if (age > MOUSE_PERMISSION_THRESHOLD && !refs.current.permissionPrompted) {
          setPermissionRequired(true);
          refs.current.permissionPrompted = true;
        }
      }
    }, MOUSE_HEALTH_CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [clickThroughMode, setClickThroughSafe]);

  useEffect(() => {
    if (permissionRequired) setClickThroughSafe(false);
  }, [permissionRequired, setClickThroughSafe]);

  useEffect(() => {
    if (mouseTrackingHealthy) refs.current.permissionPrompted = false;
  }, [mouseTrackingHealthy]);

  // 행동 AI 루프
  useEffect(() => {
    if (isDragging) return;

    const decideBehavior = () => {
      const now = Date.now();
      if (now < refs.current.manualOverrideUntil || now < refs.current.attackLockUntil) return;

      const { screenBounds: bounds, frameSize: size, position: pos, mousePosition: mouse } = refs.current;
      const petCenter = { x: pos.x + size / 2, y: pos.y + size / 2 };

      if (mouse) {
        const dist = Math.hypot(mouse.x - petCenter.x, mouse.y - petCenter.y);
        if (dist <= CLOSE_RADIUS) {
          if (Math.random() < 0.15) {
            setAnimState('attack');
            refs.current.attackLockUntil = now + ATTACK_DURATION_MS;
          } else { setAnimState('idle'); }
          refs.current.targetPosition = null;
          return;
        }
        if (dist <= FOLLOW_RADIUS) {
          setAnimState(dist > FOLLOW_RUN_DISTANCE ? 'run' : 'walk');
          refs.current.targetPosition = clampPosition({ x: mouse.x - size / 2, y: mouse.y - size / 2 }, size, bounds);
          return;
        }
      }

      const roll = Math.random();
      if (roll < 0.35) { setAnimState('idle'); refs.current.targetPosition = null; return; }
      if (roll > 0.9) {
        setAnimState('attack');
        refs.current.attackLockUntil = now + ATTACK_DURATION_MS;
        refs.current.targetPosition = null;
        return;
      }
      setAnimState(roll > 0.7 ? 'run' : 'walk');
      refs.current.targetPosition = {
        x: Math.random() * Math.max(0, bounds.width - size),
        y: Math.random() * Math.max(0, bounds.height - size),
      };
    };

    decideBehavior();
    const id = setInterval(decideBehavior, BEHAVIOR_TICK_MS);
    return () => clearInterval(id);
  }, [isDragging]);

  // 이동 로직
  useEffect(() => {
    if (!refs.current.targetPosition || isDragging || animState === 'idle' || animState === 'attack') return;

    const speed = animState === 'run' ? RUN_SPEED : WALK_SPEED;
    const id = setInterval(() => {
      setPosition((prev) => {
        const target = refs.current.targetPosition;
        if (!target) return prev;
        const dx = target.x - prev.x, dy = target.y - prev.y;
        const dist = Math.hypot(dx, dy);
        if (dist < speed) { refs.current.targetPosition = null; setAnimState('idle'); return prev; }
        return { x: prev.x + (dx / dist) * speed, y: prev.y + (dy / dist) * speed };
      });
    }, 16);
    return () => clearInterval(id);
  }, [animState, isDragging]);

  // 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { e.preventDefault(); setShowMenu((v) => !v); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    setAnimState('idle');
    refs.current.targetPosition = null;
    setShowMenu(false);
    refs.current.dragOffset = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition(clampPosition(
        { x: e.clientX - refs.current.dragOffset.x, y: e.clientY - refs.current.dragOffset.y },
        frameSize, screenBounds
      ));
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, frameSize, screenBounds]);

  // 휠 크기 조절
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + (e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP))));
  }, []);

  // 메뉴 외부 클릭
  useEffect(() => {
    if (!showMenu) return;
    const onClick = () => setShowMenu(false);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [showMenu]);

  const handleDismissPermission = useCallback(() => {
    setPermissionRequired(false);
    if (clickThroughMode === 'auto') setClickThroughSafe(true);
  }, [clickThroughMode, setClickThroughSafe]);

  const handleAttack = useCallback(() => {
    const now = Date.now();
    setAnimState('attack');
    refs.current.manualOverrideUntil = now + ATTACK_DURATION_MS;
    refs.current.attackLockUntil = now + ATTACK_DURATION_MS;
  }, []);

  const handleRun = useCallback((target: Position) => {
    refs.current.manualOverrideUntil = Date.now() + 2000;
    refs.current.targetPosition = target;
    setAnimState('run');
  }, []);

  const col = frame % GRID_SIZE;
  const row = Math.floor(frame / GRID_SIZE);

  return (
    <>
      <StatusNotice
        clickThrough={clickThrough}
        clickThroughMode={clickThroughMode}
        mouseHookError={mouseHookError}
        mouseTrackingHealthy={mouseTrackingHealthy}
      />

      {permissionRequired && <PermissionModal onDismiss={handleDismissPermission} />}

      <div
        className="pet-container"
        style={{ left: position.x, top: position.y, width: frameSize, height: frameSize, cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className={`sprite ${isFlipped ? 'flip' : ''}`}
          style={{
            width: frameSize,
            height: frameSize,
            backgroundImage: `url(${config.sprites[animState]})`,
            backgroundPosition: `${-col * frameSize}px ${-row * frameSize}px`,
            backgroundSize: `${frameSize * GRID_SIZE}px ${frameSize * GRID_SIZE}px`,
          }}
        />

        {showMenu && (
          <ContextMenu
            petName={config.name}
            scale={scale}
            frameSize={frameSize}
            screenBounds={screenBounds}
            onScaleChange={setScale}
            onAttack={handleAttack}
            onRun={handleRun}
            onClose={() => setShowMenu(false)}
          />
        )}

        <StateIndicator
          isDragging={isDragging}
          animState={animState}
          clickThrough={clickThrough}
          clickThroughMode={clickThroughMode}
        />
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="app-container">
        <Pet config={DEFAULT_PET} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
