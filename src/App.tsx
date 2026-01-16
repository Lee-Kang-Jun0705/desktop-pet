import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// 스프라이트 시트 import
import idleSprite from '../assets/sprites/idle.webp';
import walkSprite from '../assets/sprites/walk.webp';
import runSprite from '../assets/sprites/run.webp';
import attackSprite from '../assets/sprites/attack.webp';

type AnimationState = 'idle' | 'walk' | 'run' | 'attack';

interface Position {
  x: number;
  y: number;
}

interface ScreenInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PetConfig {
  id: string;
  name: string;
  sprites: Record<AnimationState, string>;
  scale: number;
}

interface VirtualBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

const BASE_FRAME_SIZE = 256;

const DEFAULT_PET: PetConfig = {
  id: 'stone-guardian',
  name: 'Stone Guardian',
  sprites: {
    idle: idleSprite,
    walk: walkSprite,
    run: runSprite,
    attack: attackSprite,
  },
  scale: 1,
};

const FRAME_SPEEDS: Record<AnimationState, number> = {
  idle: 150,
  walk: 100,
  run: 80,
  attack: 100,
};

function Pet({
  config,
  initialPosition,
  bounds,
  interactMode,
}: {
  config: PetConfig;
  initialPosition: Position;
  bounds: VirtualBounds;
  interactMode: boolean;
}) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [frame, setFrame] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(config.scale);
  const [showMenu, setShowMenu] = useState(false);

  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const wanderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetPosition = useRef<Position | null>(null);

  const frameSize = BASE_FRAME_SIZE * scale;

  // 프레임 애니메이션
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 16);
    }, FRAME_SPEEDS[animState]);

    return () => clearInterval(interval);
  }, [animState]);

  // 배회 AI
  useEffect(() => {
    if (isDragging) return;

    const startWander = () => {
      const actions: AnimationState[] = ['idle', 'walk', 'idle', 'walk', 'run', 'attack'];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      if (randomAction === 'idle') {
        setAnimState('idle');
        wanderTimeout.current = setTimeout(startWander, 2000 + Math.random() * 3000);
      } else if (randomAction === 'attack') {
        setAnimState('attack');
        wanderTimeout.current = setTimeout(() => {
          setAnimState('idle');
          setTimeout(startWander, 1000);
        }, FRAME_SPEEDS.attack * 16);
      } else {
        setAnimState(randomAction);

        // 전체 가상 화면 범위에서 이동
        const maxX = bounds.maxX - frameSize;
        const maxY = bounds.maxY - frameSize;
        const minX = bounds.minX;
        const minY = bounds.minY;

        targetPosition.current = {
          x: minX + Math.random() * (maxX - minX),
          y: minY + Math.random() * (maxY - minY),
        };

        if (targetPosition.current.x < position.x) {
          setIsFlipped(true);
        } else {
          setIsFlipped(false);
        }

        wanderTimeout.current = setTimeout(startWander, 3000 + Math.random() * 2000);
      }
    };

    startWander();

    return () => {
      if (wanderTimeout.current) {
        clearTimeout(wanderTimeout.current);
      }
    };
  }, [isDragging, frameSize, bounds]);

  // 이동 로직
  useEffect(() => {
    if (!targetPosition.current || isDragging || animState === 'idle' || animState === 'attack') {
      return;
    }

    const speed = animState === 'run' ? 4 : 2;

    const moveInterval = setInterval(() => {
      setPosition((prev) => {
        if (!targetPosition.current) return prev;

        const dx = targetPosition.current.x - prev.x;
        const dy = targetPosition.current.y - prev.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < speed) {
          targetPosition.current = null;
          setAnimState('idle');
          return prev;
        }

        return {
          x: prev.x + (dx / distance) * speed,
          y: prev.y + (dy / distance) * speed,
        };
      });
    }, 16);

    return () => clearInterval(moveInterval);
  }, [animState, isDragging]);

  // 전역 마우스 클릭 이벤트 (캐릭터 위 클릭 감지)
  useEffect(() => {
    const unlisten = listen<Position>('mouse_click', (event) => {
      const clickPos = event.payload;

      // 캐릭터 영역 내 클릭인지 확인
      const isOnPet =
        clickPos.x >= position.x &&
        clickPos.x <= position.x + frameSize &&
        clickPos.y >= position.y &&
        clickPos.y <= position.y + frameSize;

      if (isOnPet && !interactMode) {
        // 펫 위에서 클릭 - 반응하기
        setAnimState('attack');
        setTimeout(() => setAnimState('idle'), FRAME_SPEEDS.attack * 16);
      } else if (!isOnPet && !interactMode) {
        // 다른 곳 클릭 - 그쪽으로 달려가기
        targetPosition.current = {
          x: Math.max(bounds.minX, Math.min(bounds.maxX - frameSize, clickPos.x - frameSize / 2)),
          y: Math.max(bounds.minY, Math.min(bounds.maxY - frameSize, clickPos.y - frameSize / 2)),
        };

        if (clickPos.x < position.x) {
          setIsFlipped(true);
        } else {
          setIsFlipped(false);
        }

        setAnimState('run');
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [position, frameSize, interactMode, bounds]);

  // 상호작용 모드일 때만 드래그 가능
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!interactMode) return;

      if (e.button === 2) {
        e.preventDefault();
        setShowMenu(!showMenu);
        return;
      }

      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setAnimState('idle');
      targetPosition.current = null;
      setShowMenu(false);

      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position, showMenu, interactMode]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxX = bounds.maxX - frameSize;
      const maxY = bounds.maxY - frameSize;
      setPosition({
        x: Math.max(bounds.minX, Math.min(maxX, e.clientX - dragOffset.current.x)),
        y: Math.max(bounds.minY, Math.min(maxY, e.clientY - dragOffset.current.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, frameSize, bounds]);

  // 마우스 휠로 크기 조절 (상호작용 모드일 때만)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!interactMode) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.max(0.3, Math.min(2, prev + delta)));
    },
    [interactMode]
  );

  // 메뉴 닫기
  useEffect(() => {
    const handleClick = () => setShowMenu(false);
    if (showMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  const col = frame % 4;
  const row = Math.floor(frame / 4);
  const bgPosX = -col * frameSize;
  const bgPosY = -row * frameSize;

  return (
    <div
      className="pet-container"
      style={{
        left: position.x,
        top: position.y,
        width: frameSize,
        height: frameSize,
        cursor: interactMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
        pointerEvents: interactMode ? 'auto' : 'none',
      }}
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
          backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          backgroundSize: `${frameSize * 4}px ${frameSize * 4}px`,
        }}
      />
      {showMenu && interactMode && (
        <div className="context-menu" onClick={(e) => e.stopPropagation()}>
          <div className="menu-title">{config.name}</div>
          <div className="menu-item">크기: {Math.round(scale * 100)}%</div>
          <div className="menu-slider">
            <input
              type="range"
              min="30"
              max="200"
              value={scale * 100}
              onChange={(e) => setScale(parseInt(e.target.value) / 100)}
            />
          </div>
          <div className="menu-divider" />
          <div
            className="menu-item"
            onClick={() => {
              setAnimState('attack');
              setShowMenu(false);
            }}
          >
            공격!
          </div>
          <div
            className="menu-item"
            onClick={() => {
              setAnimState('run');
              const maxX = bounds.maxX - frameSize;
              const maxY = bounds.maxY - frameSize;
              targetPosition.current = {
                x: bounds.minX + Math.random() * (maxX - bounds.minX),
                y: bounds.minY + Math.random() * (maxY - bounds.minY),
              };
              if (targetPosition.current.x < position.x) {
                setIsFlipped(true);
              } else {
                setIsFlipped(false);
              }
              setShowMenu(false);
            }}
          >
            달려!
          </div>
        </div>
      )}
      <div className="state-indicator">
        {isDragging ? '드래그 중' : animState}
        <br />
        <small>{interactMode ? '상호작용 모드' : '바탕화면 클릭 시 달려감'}</small>
      </div>
    </div>
  );
}

function App() {
  const [interactMode, setInteractMode] = useState(false);
  const [bounds, setBounds] = useState<VirtualBounds>({
    minX: 0,
    minY: 0,
    maxX: window.innerWidth,
    maxY: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // 모든 모니터 정보 가져오기 및 윈도우 크기 조정
  useEffect(() => {
    const setupMultiMonitor = async () => {
      try {
        const monitors = await invoke<ScreenInfo[]>('get_all_monitors');

        if (monitors.length > 0) {
          // 모든 모니터를 포함하는 가상 경계 계산
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

          for (const monitor of monitors) {
            minX = Math.min(minX, monitor.x);
            minY = Math.min(minY, monitor.y);
            maxX = Math.max(maxX, monitor.x + monitor.width);
            maxY = Math.max(maxY, monitor.y + monitor.height);
          }

          const width = maxX - minX;
          const height = maxY - minY;

          // 윈도우를 전체 가상 스크린 크기로 설정
          await invoke('set_window_bounds', {
            x: minX,
            y: minY,
            width: width,
            height: height,
          });

          setBounds({
            minX: 0,
            minY: 0,
            maxX: width,
            maxY: height,
            width,
            height,
          });

          console.log('Multi-monitor setup:', { minX, minY, maxX, maxY, width, height });
        }
      } catch (error) {
        console.error('Failed to setup multi-monitor:', error);
      }
    };

    setupMultiMonitor();
  }, []);

  // 상호작용 모드 토글 이벤트 리스닝
  useEffect(() => {
    const unlisten = listen<boolean>('click_through_changed', (event) => {
      // click_through가 false면 상호작용 모드
      setInteractMode(!event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 초기 위치를 화면 중앙으로 설정
  const initialPosition = {
    x: bounds.width / 2 - BASE_FRAME_SIZE / 2,
    y: bounds.height / 2 - BASE_FRAME_SIZE / 2,
  };

  return (
    <div
      className="app-container"
      style={{
        width: bounds.width,
        height: bounds.height,
      }}
    >
      {interactMode && (
        <div className="interact-mode-notice">
          🎮 상호작용 모드 - 펫을 드래그하거나 우클릭하세요
          <br />
          <small>트레이 메뉴에서 "펫 조작 모드"를 다시 클릭하면 일반 모드로 돌아갑니다</small>
        </div>
      )}
      <Pet
        config={DEFAULT_PET}
        initialPosition={initialPosition}
        bounds={bounds}
        interactMode={interactMode}
      />
    </div>
  );
}

export default App;
