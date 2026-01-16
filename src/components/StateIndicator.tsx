import type { AnimationState, ClickThroughMode } from '../types/pet.types';

interface StateIndicatorProps {
  isDragging: boolean;
  animState: AnimationState;
  clickThrough: boolean;
  clickThroughMode: ClickThroughMode;
}

const MODE_LABELS: Record<ClickThroughMode, string> = {
  auto: '자동',
  locked_on: '고정(ON)',
  locked_off: '고정(OFF)',
};

export function StateIndicator({
  isDragging,
  animState,
  clickThrough,
  clickThroughMode,
}: StateIndicatorProps) {
  const modeLabel = MODE_LABELS[clickThroughMode];

  return (
    <div className="state-indicator">
      {isDragging ? '드래그 중' : animState}
      <br />
      <small>
        클릭 통과: {clickThrough ? 'ON' : 'OFF'} ({modeLabel})
      </small>
      <br />
      <small>드래그: 이동 | 휠: 크기 | 우클릭: 메뉴</small>
    </div>
  );
}
