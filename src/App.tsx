import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
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
  AVAILABLE_PETS,
  FRAME_SPEEDS,
  MOTION_DURATION_MS,
  BEHAVIOR_TICK_MS,
  CLOSE_RADIUS,
  FOLLOW_RADIUS,
  FOLLOW_RUN_DISTANCE,
  MIN_SCALE,
  MAX_SCALE,
  MOUSE_POLL_INTERVAL,
  MOUSE_STALE_THRESHOLD,
  MOUSE_PERMISSION_THRESHOLD,
  MOUSE_HEALTH_CHECK_INTERVAL,
  WALK_SPEED,
  RUN_SPEED,
  TOTAL_FRAMES,
  GRID_SIZE,
  GROUND_MODE,
  EDGE_MARGIN,
  clampValue,
  hasAnimation,
  getFallbackAnimation,
} from './constants/pet.constants';
import { clampPosition, getGroundY } from './utils/position';

// 컴포넌트
import { ErrorBoundary } from './components/ErrorBoundary';
import { ContextMenu } from './components/ContextMenu';
import { PermissionModal } from './components/PermissionModal';

// 펫 인스턴스 타입
interface PetInstance {
  id: string;
  config: PetConfig;
  scale: number;
}

type ControlPanelState = 'open' | 'minimized' | 'closed';

// 개별 펫 컴포넌트 Props
interface PetProps {
  instance: PetInstance;
  screenBounds: ScreenBounds;
  mousePosition: Position | null;
  onScaleChange: (id: string, scale: number) => void;
  onSelect: (id: string) => void;
  onContextMenuToggle: (id: string, open: boolean) => void;
}

function Pet({ instance, screenBounds, mousePosition, onScaleChange, onSelect, onContextMenuToggle }: PetProps) {
  const { config: currentPet, scale, id: petId } = instance;

  // 핵심 상태
  const [position, setPosition] = useState<Position>({ x: 200, y: 200 });
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [frame, setFrame] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const frameSize = BASE_FRAME_SIZE * scale;
  const initialFrameSize = BASE_FRAME_SIZE * currentPet.scale;

  // Refs
  const refs = useRef({
    position: { x: 200, y: 200 },
    screenBounds: screenBounds,
    frameSize: frameSize,
    mousePosition: null as Position | null,
    isDragging: false,
    showMenu: false,
    targetPosition: null as Position | null,
    manualOverrideUntil: 0,
    attackLockUntil: 0,
    dragOffset: { x: 0, y: 0 },
  });

  // Ref 동기화
  useEffect(() => {
    refs.current.position = position;
    refs.current.screenBounds = screenBounds;
    refs.current.frameSize = frameSize;
    refs.current.mousePosition = mousePosition;
    refs.current.isDragging = isDragging;
    refs.current.showMenu = showMenu;
  }, [position, screenBounds, frameSize, mousePosition, isDragging, showMenu]);

  // 초기 위치 설정 (마운트 시 한 번만)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const groundY = getGroundY(initialFrameSize, screenBounds);
    // 랜덤 X 위치로 시작
    const randomX = EDGE_MARGIN + Math.random() * Math.max(0, screenBounds.width - initialFrameSize - EDGE_MARGIN * 2);
    setPosition({
      x: randomX,
      y: GROUND_MODE ? groundY : screenBounds.height / 2 - initialFrameSize / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 크기 변경 시 위치 보정
  useEffect(() => {
    setPosition((p) => clampPosition(p, frameSize, screenBounds));
  }, [frameSize, screenBounds]);

  // 프레임 애니메이션
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % TOTAL_FRAMES), FRAME_SPEEDS[animState]);
    return () => clearInterval(id);
  }, [animState]);

  // 마우스 바라보기
  useEffect(() => {
    if (!mousePosition) return;
    setIsFlipped(mousePosition.x < position.x + frameSize / 2);
  }, [mousePosition, position.x, frameSize]);

  // 행동 AI 루프
  useEffect(() => {
    if (isDragging) return;

    const pickSpecialMotion = (): AnimationState | null => {
      const specialMotions: AnimationState[] = [];
      if (hasAnimation(currentPet, 'attack')) specialMotions.push('attack');
      if (hasAnimation(currentPet, 'skill')) specialMotions.push('skill');
      if (hasAnimation(currentPet, 'jump')) specialMotions.push('jump');
      if (hasAnimation(currentPet, 'claw_attack')) specialMotions.push('claw_attack');
      if (specialMotions.length === 0) return null;
      return specialMotions[Math.floor(Math.random() * specialMotions.length)];
    };

    const getMotionDuration = (state: AnimationState): number => {
      return MOTION_DURATION_MS[state] || FRAME_SPEEDS[state] * TOTAL_FRAMES;
    };

    const decideBehavior = () => {
      const now = Date.now();
      if (now < refs.current.manualOverrideUntil || now < refs.current.attackLockUntil) return;

      const { screenBounds: bounds, frameSize: size, position: pos, mousePosition: mouse } = refs.current;
      const petCenter = { x: pos.x + size / 2, y: pos.y + size / 2 };

      if (mouse) {
        const dist = Math.hypot(mouse.x - petCenter.x, mouse.y - petCenter.y);
        if (dist <= CLOSE_RADIUS) {
          if (Math.random() < 0.25) {
            const motion = pickSpecialMotion();
            if (motion) {
              setAnimState(motion);
              refs.current.attackLockUntil = now + getMotionDuration(motion);
            } else {
              setAnimState('idle');
            }
          } else {
            setAnimState('idle');
          }
          refs.current.targetPosition = null;
          return;
        }
        if (dist <= FOLLOW_RADIUS) {
          const moveState = dist > FOLLOW_RUN_DISTANCE
            ? getFallbackAnimation(currentPet, 'run')
            : 'walk';
          setAnimState(moveState);
          const groundY = getGroundY(size, bounds);
          refs.current.targetPosition = {
            x: Math.max(0, Math.min(bounds.width - size, mouse.x - size / 2)),
            y: GROUND_MODE ? groundY : Math.max(0, Math.min(bounds.height - size, mouse.y - size / 2)),
          };
          return;
        }
      }

      const roll = Math.random();
      if (roll < 0.25) {
        setAnimState('idle');
        refs.current.targetPosition = null;
        return;
      }
      if (roll < 0.45) {
        const motion = pickSpecialMotion();
        if (motion) {
          setAnimState(motion);
          refs.current.attackLockUntil = now + getMotionDuration(motion);
          refs.current.targetPosition = null;
          return;
        }
      }

      const moveState = roll > 0.75
        ? getFallbackAnimation(currentPet, 'run')
        : 'walk';
      setAnimState(moveState);
      const groundY = getGroundY(size, screenBounds);
      const minX = EDGE_MARGIN;
      const maxX = Math.max(minX, screenBounds.width - size - EDGE_MARGIN);
      refs.current.targetPosition = {
        x: minX + Math.random() * (maxX - minX),
        y: GROUND_MODE ? groundY : Math.random() * Math.max(0, screenBounds.height - size),
      };
    };

    decideBehavior();
    const id = setInterval(decideBehavior, BEHAVIOR_TICK_MS);
    return () => clearInterval(id);
  }, [isDragging, currentPet, screenBounds]);

  const isSpecialMotion = (state: AnimationState): boolean => {
    return ['attack', 'skill', 'jump', 'hit', 'die', 'claw_attack'].includes(state);
  };

  // 이동 로직
  useEffect(() => {
    if (!refs.current.targetPosition || isDragging || animState === 'idle' || isSpecialMotion(animState)) return;

    let animId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const delta = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;

      setPosition((prev) => {
        const target = refs.current.targetPosition;
        if (!target) return prev;

        const dx = target.x - prev.x;
        const dy = GROUND_MODE ? 0 : target.y - prev.y;
        const dist = Math.hypot(dx, dy);
        const speed = (animState === 'run' ? RUN_SPEED : WALK_SPEED) * delta;

        if (dist < speed || dist < 1) {
          refs.current.targetPosition = null;
          setAnimState('idle');
          return prev;
        }

        return {
          x: prev.x + (dx / dist) * speed,
          y: GROUND_MODE ? prev.y : prev.y + (dy / dist) * speed,
        };
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [animState, isDragging]);

  // 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    onSelect(petId);
    if (e.button === 2) { e.preventDefault(); setShowMenu((v) => !v); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    setAnimState('idle');
    refs.current.targetPosition = null;
    setShowMenu(false);
    refs.current.dragOffset = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position, petId, onSelect]);

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

  // 메뉴 외부 클릭
  useEffect(() => {
    if (!showMenu) return;
    const onClick = () => setShowMenu(false);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [showMenu]);

  useEffect(() => {
    onContextMenuToggle(petId, showMenu);
  }, [petId, showMenu, onContextMenuToggle]);

  const handleAttack = useCallback(() => {
    const now = Date.now();
    const duration = MOTION_DURATION_MS.attack || FRAME_SPEEDS.attack * TOTAL_FRAMES;
    setAnimState('attack');
    refs.current.manualOverrideUntil = now + duration;
    refs.current.attackLockUntil = now + duration;
  }, []);

  const handleJump = useCallback(() => {
    const now = Date.now();
    const duration = MOTION_DURATION_MS.jump || FRAME_SPEEDS.jump * TOTAL_FRAMES;
    setAnimState('jump');
    refs.current.manualOverrideUntil = now + duration;
    refs.current.attackLockUntil = now + duration;
  }, []);

  const handleRun = useCallback((target: Position) => {
    refs.current.manualOverrideUntil = Date.now() + 2000;
    refs.current.targetPosition = target;
    const runState = getFallbackAnimation(currentPet, 'run');
    setAnimState(runState);
  }, [currentPet]);

  const col = frame % GRID_SIZE;
  const row = Math.floor(frame / GRID_SIZE);

  const currentSprite = currentPet.sprites[animState as keyof typeof currentPet.sprites]
    || currentPet.sprites[getFallbackAnimation(currentPet, animState) as keyof typeof currentPet.sprites]
    || currentPet.sprites.idle;

  return (
    <div
      className="pet-container"
      style={{
        left: position.x,
        top: position.y,
        width: frameSize,
        height: frameSize,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={`sprite ${isFlipped ? 'flip' : ''}`}
        style={{
          width: frameSize,
          height: frameSize,
          backgroundImage: `url(${currentSprite})`,
          backgroundPosition: `${-col * frameSize}px ${-row * frameSize}px`,
          backgroundSize: `${frameSize * GRID_SIZE}px ${frameSize * GRID_SIZE}px`,
        }}
      />

      {showMenu && (
        <ContextMenu
          petName={currentPet.name}
          scale={scale}
          frameSize={frameSize}
          screenBounds={screenBounds}
          onScaleChange={(s) => onScaleChange(petId, s)}
          onAttack={handleAttack}
          onJump={handleJump}
          onRun={handleRun}
          onClose={() => setShowMenu(false)}
          canJump={hasAnimation(currentPet, 'jump')}
        />
      )}
    </div>
  );
}

// 컨트롤 패널 컴포넌트
interface ControlPanelProps {
  pets: PetInstance[];
  selectedPetId: string | null;
  onScaleChange: (id: string, scale: number) => void;
  onAddPet: (configId: string) => void;
  onCharacterChange: (id: string, configId: string) => void;
  onSelectPet: (id: string) => void;
  clickThrough: boolean;
  clickThroughMode: ClickThroughMode;
  onModeSelect: (mode: ClickThroughMode) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  panelState: ControlPanelState;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
}

function ControlPanel({
  pets,
  selectedPetId,
  onScaleChange,
  onAddPet,
  onCharacterChange,
  onSelectPet,
  clickThrough,
  clickThroughMode,
  onModeSelect,
  panelRef,
  panelState,
  onClose,
  onMinimize,
  onRestore,
}: ControlPanelProps) {
  const selectedPet = pets.find((p) => p.id === selectedPetId);

  return (
    <div className={`control-panel ${panelState !== 'open' ? 'minimized' : ''}`} ref={panelRef}>
      <div className="control-header">
        <div className="control-title">펫 제어</div>
        <div className="control-window-buttons">
          {panelState === 'open' ? (
            <button className="control-window-button" onClick={onMinimize} aria-label="최소화">—</button>
          ) : (
            <button className="control-window-button" onClick={onRestore} aria-label="복원">▢</button>
          )}
          <button className="control-window-button" onClick={onClose} aria-label="닫기">×</button>
        </div>
      </div>

      {panelState === 'open' && (
        <>
          <div className="control-section">
            <div className="control-label">클릭 통과: {clickThrough ? 'ON' : 'OFF'}</div>
            <div className="control-buttons">
              <button className={clickThroughMode === 'auto' ? 'active' : ''} onClick={() => onModeSelect('auto')}>자동</button>
              <button className={clickThroughMode === 'locked_on' ? 'active' : ''} onClick={() => onModeSelect('locked_on')}>ON</button>
              <button className={clickThroughMode === 'locked_off' ? 'active' : ''} onClick={() => onModeSelect('locked_off')}>OFF</button>
            </div>
          </div>

          <div className="control-section">
            <div className="control-label">캐릭터 추가 (최대 2마리)</div>
            <div className="control-buttons">
              {AVAILABLE_PETS.map((pet) => (
                <button key={pet.id} onClick={() => onAddPet(pet.id)} disabled={pets.length >= 2}>
                  {pet.name}
                </button>
              ))}
            </div>
          </div>

          {pets.length > 1 && (
            <div className="control-section">
              <div className="control-label">펫 선택</div>
              <div className="control-buttons">
                {pets.map((pet, index) => (
                  <button
                    key={pet.id}
                    className={selectedPetId === pet.id ? 'active' : ''}
                    onClick={() => onSelectPet(pet.id)}
                  >
                    {index + 1}. {pet.config.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPet && (
            <>
              <div className="control-section">
                <div className="control-label">캐릭터 변경 ({selectedPet.config.name})</div>
                <div className="control-buttons">
                  {AVAILABLE_PETS.map((pet) => (
                    <button
                      key={pet.id}
                      className={selectedPet.config.id === pet.id ? 'active' : ''}
                      onClick={() => onCharacterChange(selectedPet.id, pet.id)}
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-section">
                <div className="control-label">
                  크기: {Math.round(selectedPet.scale * 100)}%
                </div>
                <div className="scale-slider-container">
                  <span className="scale-label">작게</span>
                  <input
                    type="range"
                    min={MIN_SCALE * 100}
                    max={MAX_SCALE * 100}
                    value={selectedPet.scale * 100}
                    onChange={(e) => onScaleChange(selectedPet.id, Number(e.target.value) / 100)}
                    className="scale-slider"
                  />
                  <span className="scale-label">크게</span>
                </div>
              </div>
            </>
          )}

          <div className="control-hint">
            펫 클릭: 선택 | 펫 드래그: 이동 | 펫 우클릭: 메뉴
          </div>
          <div className="control-credit">made by 보물</div>
        </>
      )}
    </div>
  );
}

interface DebugEvent {
  ts: number;
  message: string;
}

interface DebugPanelProps {
  visible: boolean;
  clickThrough: boolean;
  clickThroughMode: ClickThroughMode;
  permissionRequired: boolean;
  mouseTrackingHealthy: boolean;
  lastMouseUpdateAgeMs: number;
  events: DebugEvent[];
  onToggleVisible: () => void;
  onModeSelect: (mode: ClickThroughMode) => void;
  onAddPet: (configId: string) => void;
  onChangePet: (configId: string) => void;
  onScaleDelta: (delta: number) => void;
  onRemovePet: () => void;
}

function DebugPanel({
  visible,
  clickThrough,
  clickThroughMode,
  permissionRequired,
  mouseTrackingHealthy,
  lastMouseUpdateAgeMs,
  events,
  onToggleVisible,
  onModeSelect,
  onAddPet,
  onChangePet,
  onScaleDelta,
  onRemovePet,
}: DebugPanelProps) {
  if (!visible) return null;

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <div className="debug-title">Debug Panel</div>
        <button className="debug-toggle" onClick={onToggleVisible}>숨기기</button>
      </div>
      <div className="debug-row">
        클릭 통과: <strong>{clickThrough ? 'ON' : 'OFF'}</strong> · 모드: <strong>{clickThroughMode}</strong>
      </div>
      <div className="debug-row">
        권한 필요: <strong>{permissionRequired ? 'YES' : 'NO'}</strong> · 마우스 상태: <strong>{mouseTrackingHealthy ? 'OK' : 'BAD'}</strong>
      </div>
      <div className="debug-row">
        마지막 마우스 업데이트: <strong>{Math.round(lastMouseUpdateAgeMs)}ms</strong>
      </div>
      <div className="debug-divider" />
      <div className="debug-buttons">
        <button onClick={() => onModeSelect('auto')}>모드 자동</button>
        <button onClick={() => onModeSelect('locked_on')}>모드 ON</button>
        <button onClick={() => onModeSelect('locked_off')}>모드 OFF</button>
        <button onClick={() => onAddPet('stone-guardian')}>스톤 추가</button>
        <button onClick={() => onAddPet('iron-fist-master')}>철장 추가</button>
        <button onClick={() => onChangePet('stone-guardian')}>선택=스톤</button>
        <button onClick={() => onChangePet('iron-fist-master')}>선택=철장</button>
        <button onClick={() => onScaleDelta(0.1)}>크기 +</button>
        <button onClick={() => onScaleDelta(-0.1)}>크기 -</button>
        <button onClick={onRemovePet}>마지막 제거</button>
      </div>
      <div className="debug-divider" />
      <div className="debug-log">
        {events.length === 0 && <div className="debug-log-item">이벤트 없음</div>}
        {events.map((event, index) => (
          <div key={`${event.ts}-${index}`} className="debug-log-item">
            [{formatTime(event.ts)}] {event.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  // 펫 인스턴스 배열
  const [pets, setPets] = useState<PetInstance[]>([
    { id: 'pet-1', config: DEFAULT_PET, scale: DEFAULT_PET.scale },
  ]);
  const [selectedPetId, setSelectedPetId] = useState<string>('pet-1');
  const selectedPetIdRef = useRef<string>('pet-1');
  const petIdCounter = useRef(1);
  const controlPanelRef = useRef<HTMLDivElement | null>(null);
  const controlPanelToggleRef = useRef<HTMLButtonElement | null>(null);
  const [controlPanelState, setControlPanelState] = useState<ControlPanelState>('open');
  const [windowOrigin, setWindowOrigin] = useState<Position>({ x: 0, y: 0 });
  const [debugVisible, setDebugVisible] = useState<boolean>(false);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const isTauri = Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const contextMenuOpenRef = useRef(new Set<string>());

  // selectedPetId ref 동기화
  useEffect(() => {
    selectedPetIdRef.current = selectedPetId;
  }, [selectedPetId]);


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
  const [, setMouseHookError] = useState<string | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);

  const refs = useRef({
    clickThrough: true,
    lastMouseUpdate: Date.now(),
    permissionPrompted: false,
    internalClickThroughUpdate: false,
  });

  const logEvent = useCallback((message: string) => {
    setDebugEvents((prev) => {
      const next = [...prev, { ts: Date.now(), message }];
      return next.slice(-30);
    });
  }, []);

  const handleContextMenuToggle = useCallback((id: string, open: boolean) => {
    if (open) {
      contextMenuOpenRef.current.add(id);
    } else {
      contextMenuOpenRef.current.delete(id);
    }
    setContextMenuOpen(contextMenuOpenRef.current.size > 0);
  }, []);

  // 클릭 통과 설정
  const setClickThroughSafe = useCallback((enabled: boolean) => {
    if (refs.current.clickThrough === enabled) return;
    refs.current.clickThrough = enabled;
    refs.current.internalClickThroughUpdate = true;
    setClickThrough(enabled);
    invoke('set_click_through', { enabled }).catch(() => {});
    logEvent(`local: set_click_through -> ${enabled ? 'ON' : 'OFF'}`);
    setTimeout(() => { refs.current.internalClickThroughUpdate = false; }, 200);
  }, [isTauri, logEvent]);

  // 초기 클릭 통과 상태
  useEffect(() => {
    invoke<boolean>('get_click_through').then((value) => {
      setClickThrough(value);
      refs.current.clickThrough = value;
      logEvent(`init: get_click_through -> ${value ? 'ON' : 'OFF'}`);
    }).catch(() => {});
  }, [logEvent]);

  useEffect(() => {
    if (!contextMenuOpen) return;
    setClickThroughSafe(false);
  }, [contextMenuOpen, setClickThroughSafe]);

  // 이벤트 리스너
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      unlisteners.push(await listen<boolean>('click_through_changed', (e) => {
        setClickThrough(e.payload);
        refs.current.clickThrough = e.payload;
        logEvent(`event: click_through_changed -> ${e.payload ? 'ON' : 'OFF'}`);
        if (!refs.current.internalClickThroughUpdate) {
          setClickThroughMode(e.payload ? 'locked_on' : 'locked_off');
        }
        refs.current.internalClickThroughUpdate = false;
      }));

      unlisteners.push(await listen<Position>('mouse_click', () => {
        // mouse click 이벤트는 현재 사용하지 않음
      }));

      unlisteners.push(await listen<ClickThroughMode>('click_through_mode_changed', (e) => {
        setClickThroughMode(e.payload);
        logEvent(`event: click_through_mode_changed -> ${e.payload}`);
      }));

      unlisteners.push(await listen<string>('mouse_hook_error', (e) => {
        setMouseHookError(e.payload);
        if (isTauri) {
          setPermissionRequired(true);
          refs.current.permissionPrompted = true;
        }
        logEvent(`event: mouse_hook_error -> ${e.payload}`);
      }));

      // 트레이 메뉴 이벤트: 크기 변경
      unlisteners.push(await listen<number>('pet_scale_changed', (e) => {
        logEvent(`event: pet_scale_changed -> ${e.payload}`);
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, e.payload));
        setPets((prev) => {
          const idx = prev.findIndex((p) => p.id === selectedPetIdRef.current);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], scale: newScale };
          return updated;
        });
      }));

      // 트레이 메뉴 이벤트: 캐릭터 변경
      unlisteners.push(await listen<string>('pet_character_changed', (e) => {
        logEvent(`event: pet_character_changed -> ${e.payload}`);
        const petConfig = AVAILABLE_PETS.find((p) => p.id === e.payload);
        if (petConfig) {
          setPets((prev) => {
            const idx = prev.findIndex((p) => p.id === selectedPetIdRef.current);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], config: petConfig };
            return updated;
          });
        }
      }));

      // 트레이 메뉴 이벤트: 펫 추가
      unlisteners.push(await listen<string>('pet_add', (e) => {
        logEvent(`event: pet_add -> ${e.payload}`);
        const petConfig = AVAILABLE_PETS.find((p) => p.id === e.payload);
        if (petConfig) {
          setPets((prev) => {
            if (prev.length >= 2) return prev;
            const nextIdNum = petIdCounter.current + 1;
            petIdCounter.current = nextIdNum;
            const newPet: PetInstance = {
              id: `pet-${nextIdNum}`,
              config: petConfig,
              scale: petConfig.scale,
            };
            selectedPetIdRef.current = newPet.id;
            setSelectedPetId(newPet.id);
            return [...prev, newPet];
          });
        }
      }));

      // 트레이 메뉴 이벤트: 마지막 펫 제거
      unlisteners.push(await listen('pet_remove_last', () => {
        logEvent('event: pet_remove_last');
        setPets((prev) => {
          if (prev.length <= 1) return prev;
          const updated = prev.slice(0, -1);
          const nextSelected = updated[updated.length - 1].id;
          selectedPetIdRef.current = nextSelected;
          setSelectedPetId(nextSelected);
          return updated;
        });
      }));
    };

    setup();
    return () => unlisteners.forEach((fn) => fn());
  }, []);

  const updateWindowOrigin = useCallback(async () => {
    try {
      const pos = await invoke<Position>('get_window_position');
      setWindowOrigin({ x: pos.x, y: pos.y });
    } catch {}
  }, []);

  // 화면 설정
  useEffect(() => {
    const setupScreens = async () => {
      try {
        const primary = await invoke<ScreenInfo | null>('get_primary_monitor');
        if (primary) {
          const bounds = {
            originX: primary.x,
            originY: primary.y,
            width: primary.width,
            height: primary.height,
          };
          setScreenBounds(bounds);
          await invoke('set_window_bounds', {
            x: primary.x,
            y: primary.y,
            width: primary.width,
            height: primary.height,
          });
          await updateWindowOrigin();
          setTimeout(() => { updateWindowOrigin(); }, 300);
          return;
        }
      } catch (e) { console.error(e); }

      const { width, height } = window.screen;
      const bounds = { originX: 0, originY: 0, width, height };
      setScreenBounds(bounds);
      invoke('set_window_bounds', { x: 0, y: 0, width, height }).catch(console.error);
      await updateWindowOrigin();
      setTimeout(() => { updateWindowOrigin(); }, 300);
    };
    setupScreens();
  }, [updateWindowOrigin]);

  // 마우스 위치 폴링
  useEffect(() => {
    let mounted = true;
    const id = setInterval(async () => {
      try {
        const pos = await invoke<Position | null>('get_mouse_position');
        if (!mounted || !pos) return;
        refs.current.lastMouseUpdate = Date.now();
        setMouseTrackingHealthy(true);
        setMousePosition({ x: pos.x - windowOrigin.x, y: pos.y - windowOrigin.y });
      } catch { setMouseTrackingHealthy(false); }
    }, MOUSE_POLL_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [windowOrigin.x, windowOrigin.y]);

  // 자동 클릭 통과 모드
  useEffect(() => {
    if (clickThroughMode !== 'auto' || !mousePosition) return;
    if (contextMenuOpen) {
      setClickThroughSafe(false);
      return;
    }

    // 컨트롤 패널 영역 체크 (여유 공간 포함)
    const margin = 20;
    const panelRect = controlPanelState === 'closed'
      ? controlPanelToggleRef.current?.getBoundingClientRect()
      : controlPanelRef.current?.getBoundingClientRect();
    if (!panelRect) return;
    const panelX = panelRect.left - margin;
    const panelY = panelRect.top - margin;
    const panelWidth = panelRect.width + margin * 2;
    const panelHeight = panelRect.height + margin * 2;
    const insidePanel = mousePosition.x >= panelX && mousePosition.x <= panelX + panelWidth
      && mousePosition.y >= panelY && mousePosition.y <= panelY + panelHeight;

    setClickThroughSafe(!insidePanel);
  }, [mousePosition, clickThroughMode, contextMenuOpen, pets.length, controlPanelState, setClickThroughSafe]);

  // 마우스 추적 건강 체크
  useEffect(() => {
    if (clickThroughMode !== 'auto') return;
    const id = setInterval(() => {
      if (permissionRequired) {
        setClickThroughSafe(false);
        return;
      }

      const age = Date.now() - refs.current.lastMouseUpdate;
      if (age > MOUSE_STALE_THRESHOLD) {
        setMouseTrackingHealthy(false);
        setClickThroughSafe(true);
        if (isTauri && age > MOUSE_PERMISSION_THRESHOLD && !refs.current.permissionPrompted) {
          setPermissionRequired(true);
          refs.current.permissionPrompted = true;
        }
      }
    }, MOUSE_HEALTH_CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [clickThroughMode, isTauri, permissionRequired, setClickThroughSafe]);

  useEffect(() => {
    if (permissionRequired) setClickThroughSafe(false);
  }, [permissionRequired, setClickThroughSafe]);

  useEffect(() => {
    if (mouseTrackingHealthy) refs.current.permissionPrompted = false;
  }, [mouseTrackingHealthy]);

  // 핸들러
  const handleScaleChange = useCallback((id: string, scale: number) => {
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    logEvent(`ui: scale_change(${id}) -> ${clampedScale.toFixed(2)}`);
    setPets((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], scale: clampedScale };
      return updated;
    });
  }, [logEvent]);

  const handleAddPet = useCallback((configId: string) => {
    const petConfig = AVAILABLE_PETS.find((p) => p.id === configId);
    if (!petConfig) return;
    logEvent(`ui: add_pet -> ${configId}`);
    setPets((prev) => {
      if (prev.length >= 2) return prev;
      const nextIdNum = petIdCounter.current + 1;
      petIdCounter.current = nextIdNum;
      const newPet: PetInstance = {
        id: `pet-${nextIdNum}`,
        config: petConfig,
        scale: petConfig.scale,
      };
      selectedPetIdRef.current = newPet.id;
      setSelectedPetId(newPet.id);
      return [...prev, newPet];
    });
  }, [logEvent]);

  const handleRemovePet = useCallback(() => {
    logEvent('ui: remove_last_pet');
    setPets((prev) => {
      if (prev.length <= 1) return prev;
      const updated = prev.slice(0, -1);
      const nextSelected = updated[updated.length - 1].id;
      selectedPetIdRef.current = nextSelected;
      setSelectedPetId(nextSelected);
      return updated;
    });
  }, [logEvent]);

  const handleCharacterChange = useCallback((petId: string, configId: string) => {
    const petConfig = AVAILABLE_PETS.find((p) => p.id === configId);
    if (petConfig) {
      logEvent(`ui: character_change(${petId}) -> ${configId}`);
      setPets((prev) => {
        const idx = prev.findIndex((p) => p.id === petId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], config: petConfig };
        return updated;
      });
    }
  }, [logEvent]);

  const handleChangeSelectedCharacter = useCallback((configId: string) => {
    const selectedId = selectedPetIdRef.current;
    if (!selectedId) return;
    handleCharacterChange(selectedId, configId);
  }, [handleCharacterChange]);

  const handleSelectPet = useCallback((id: string) => {
    selectedPetIdRef.current = id;
    setSelectedPetId(id);
  }, []);

  const handlePanelClose = useCallback(() => {
    setControlPanelState('closed');
  }, []);

  const handlePanelMinimize = useCallback(() => {
    setControlPanelState('minimized');
  }, []);

  const handlePanelRestore = useCallback(() => {
    setControlPanelState('open');
  }, []);

  const handleScaleDelta = useCallback((delta: number) => {
    const selectedId = selectedPetIdRef.current;
    if (!selectedId) return;
    const current = pets.find((p) => p.id === selectedId);
    if (!current) return;
    const nextScale = clampValue(current.scale + delta, MIN_SCALE, MAX_SCALE);
    setPets((prev) => {
      const idx = prev.findIndex((p) => p.id === selectedId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], scale: nextScale };
      return updated;
    });
    logEvent(`ui: scale_delta(${selectedId}) -> ${nextScale.toFixed(2)}`);
  }, [logEvent, pets]);

  const handleModeSelect = useCallback((mode: ClickThroughMode) => {
    logEvent(`ui: mode_select -> ${mode}`);
    setClickThroughMode(mode);
    if (mode === 'locked_off') {
      setClickThroughSafe(false);
    } else {
      setClickThroughSafe(true);
    }
  }, [logEvent, setClickThroughSafe]);

  const handleDismissPermission = useCallback(() => {
    setPermissionRequired(false);
    if (clickThroughMode === 'auto') setClickThroughSafe(true);
  }, [clickThroughMode, setClickThroughSafe]);

  const lastMouseUpdateAgeMs = Date.now() - refs.current.lastMouseUpdate;

  return (
    <ErrorBoundary>
      <div className="app-container">
        {controlPanelState !== 'closed' ? (
        <ControlPanel
          pets={pets}
          selectedPetId={selectedPetId}
          onScaleChange={handleScaleChange}
            onAddPet={handleAddPet}
            onCharacterChange={handleCharacterChange}
            onSelectPet={handleSelectPet}
            clickThrough={clickThrough}
            clickThroughMode={clickThroughMode}
            onModeSelect={handleModeSelect}
            panelRef={controlPanelRef}
            panelState={controlPanelState}
          onClose={handlePanelClose}
          onMinimize={handlePanelMinimize}
          onRestore={handlePanelRestore}
        />
        ) : (
          <button
            ref={controlPanelToggleRef}
            className="control-panel-toggle"
            onClick={handlePanelRestore}
          >
            펫 제어 열기
          </button>
        )}

        {permissionRequired && (
          <PermissionModal
            onDismiss={handleDismissPermission}
            onOpenSettings={() => invoke('open_accessibility_settings').catch(() => {})}
          />
        )}

        <DebugPanel
          visible={debugVisible}
          clickThrough={clickThrough}
          clickThroughMode={clickThroughMode}
          permissionRequired={permissionRequired}
          mouseTrackingHealthy={mouseTrackingHealthy}
          lastMouseUpdateAgeMs={lastMouseUpdateAgeMs}
          events={debugEvents}
          onToggleVisible={() => setDebugVisible((v) => !v)}
          onModeSelect={handleModeSelect}
          onAddPet={handleAddPet}
          onChangePet={handleChangeSelectedCharacter}
          onScaleDelta={handleScaleDelta}
          onRemovePet={handleRemovePet}
        />

        {pets.map((pet) => (
          <Pet
            key={pet.id}
            instance={pet}
            screenBounds={screenBounds}
            mousePosition={mousePosition}
            onScaleChange={handleScaleChange}
            onSelect={handleSelectPet}
            onContextMenuToggle={handleContextMenuToggle}
          />
        ))}
      </div>
    </ErrorBoundary>
  );
}

export default App;
