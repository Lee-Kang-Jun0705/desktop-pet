import type { Position, ScreenBounds } from '../types/pet.types';
import { MIN_SCALE, MAX_SCALE } from '../constants/pet.constants';

interface ContextMenuProps {
  petName: string;
  scale: number;
  frameSize: number;
  screenBounds: ScreenBounds;
  onScaleChange: (scale: number) => void;
  onAttack: () => void;
  onJump: () => void;
  onRun: (target: Position) => void;
  onClose: () => void;
  canJump: boolean;
}

export function ContextMenu({
  petName,
  scale,
  frameSize,
  screenBounds,
  onScaleChange,
  onAttack,
  onJump,
  onRun,
  onClose,
  canJump,
}: ContextMenuProps) {
  const handleAttackClick = (): void => {
    onAttack();
    onClose();
  };

  const handleJumpClick = (): void => {
    onJump();
    onClose();
  };

  const handleRunClick = (): void => {
    const target = {
      x: Math.random() * (screenBounds.width - frameSize),
      y: Math.random() * (screenBounds.height - frameSize),
    };
    onRun(target);
    onClose();
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onScaleChange(parseInt(e.target.value) / 100);
  };

  return (
    <div className="context-menu" onClick={(e) => e.stopPropagation()}>
      <div className="menu-title">{petName}</div>
      <div className="menu-item">크기: {Math.round(scale * 100)}%</div>
      <div className="menu-slider">
        <input
          type="range"
          min={MIN_SCALE * 100}
          max={MAX_SCALE * 100}
          value={scale * 100}
          onChange={handleSliderChange}
        />
      </div>
      <div className="menu-divider" />
      <div className="menu-item" onClick={handleAttackClick}>
        공격!
      </div>
      {canJump && (
        <div className="menu-item" onClick={handleJumpClick}>
          점프!
        </div>
      )}
      <div className="menu-item" onClick={handleRunClick}>
        달려!
      </div>
    </div>
  );
}
