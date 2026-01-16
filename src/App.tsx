import { useState, useEffect, useCallback, useRef } from 'react';
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

interface PetConfig {
  id: string;
  name: string;
  sprites: Record<AnimationState, string>;
  scale: number;
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
  scale: 0.8,
};

const FRAME_SPEEDS: Record<AnimationState, number> = {
  idle: 150,
  walk: 100,
  run: 80,
  attack: 100,
};

function Pet({ config }: { config: PetConfig }) {
  const [position, setPosition] = useState<Position>({ x: 200, y: 200 });
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [frame, setFrame] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(config.scale);
  const [showMenu, setShowMenu] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: window.screen.width, height: window.screen.height });

  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const wanderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetPosition = useRef<Position | null>(null);

  const frameSize = BASE_FRAME_SIZE * scale;

  // 화면 크기 설정
  useEffect(() => {
    const width = window.screen.width;
    const height = window.screen.height;
    setScreenSize({ width, height });
    setPosition({ x: width / 2 - frameSize / 2, y: height / 2 - frameSize / 2 });

    invoke('set_window_bounds', { x: 0, y: 0, width, height }).catch(console.error);
  }, []);

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
        targetPosition.current = {
          x: Math.random() * (screenSize.width - frameSize),
          y: Math.random() * (screenSize.height - frameSize),
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
      if (wanderTimeout.current) clearTimeout(wanderTimeout.current);
    };
  }, [isDragging, frameSize, screenSize]);

  // 이동 로직
  useEffect(() => {
    if (!targetPosition.current || isDragging || animState === 'idle' || animState === 'attack') return;

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

  // 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      setShowMenu(!showMenu);
      return;
    }
    if (e.button !== 0) return;

    e.preventDefault();
    setIsDragging(true);
    setAnimState('idle');
    targetPosition.current = null;
    setShowMenu(false);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position, showMenu]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(screenSize.width - frameSize, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(screenSize.height - frameSize, e.clientY - dragOffset.current.y)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, frameSize, screenSize]);

  // 마우스 휠로 크기 조절
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.max(0.3, Math.min(2, prev + (e.deltaY > 0 ? -0.1 : 0.1))));
  }, []);

  // 메뉴 닫기
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = () => setShowMenu(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [showMenu]);

  const col = frame % 4;
  const row = Math.floor(frame / 4);

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
          backgroundSize: `${frameSize * 4}px ${frameSize * 4}px`,
        }}
      />
      {showMenu && (
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
          <div className="menu-item" onClick={() => { setAnimState('attack'); setShowMenu(false); }}>
            공격!
          </div>
          <div className="menu-item" onClick={() => {
            setAnimState('run');
            targetPosition.current = {
              x: Math.random() * (screenSize.width - frameSize),
              y: Math.random() * (screenSize.height - frameSize),
            };
            if (targetPosition.current.x < position.x) setIsFlipped(true);
            else setIsFlipped(false);
            setShowMenu(false);
          }}>
            달려!
          </div>
        </div>
      )}
      <div className="state-indicator">
        {isDragging ? '드래그 중' : animState}
        <br />
        <small>드래그: 이동 | 휠: 크기 | 우클릭: 메뉴</small>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="app-container">
      <Pet config={DEFAULT_PET} />
    </div>
  );
}

export default App;
