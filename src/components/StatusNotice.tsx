import type { ClickThroughMode } from '../types/pet.types';

interface StatusNoticeProps {
  clickThrough: boolean;
  clickThroughMode: ClickThroughMode;
  mouseHookError: string | null;
  mouseTrackingHealthy: boolean;
  onModeSelect?: (mode: ClickThroughMode) => void;
}

const MODE_LABELS: Record<ClickThroughMode, string> = {
  auto: '자동',
  locked_on: '고정(ON)',
  locked_off: '고정(OFF)',
};

export function StatusNotice({
  clickThrough,
  clickThroughMode,
  mouseHookError,
  mouseTrackingHealthy,
  onModeSelect,
}: StatusNoticeProps) {
  const modeLabel = MODE_LABELS[clickThroughMode];

  return (
    <div className="interact-mode-notice">
      <div>
        클릭 통과: {clickThrough ? 'ON' : 'OFF'} · 모드: {modeLabel}
      </div>
      <small>트레이의 "자동 모드 / 클릭 통과 ON / 클릭 통과 OFF"로 상태 변경</small>
      <div className="interact-controls">
        <button
          className={`interact-control-button ${clickThroughMode === 'auto' ? 'active' : ''}`}
          onClick={() => onModeSelect?.('auto')}
        >
          자동
        </button>
        <button
          className={`interact-control-button ${clickThroughMode === 'locked_on' ? 'active' : ''}`}
          onClick={() => onModeSelect?.('locked_on')}
        >
          ON
        </button>
        <button
          className={`interact-control-button ${clickThroughMode === 'locked_off' ? 'active' : ''}`}
          onClick={() => onModeSelect?.('locked_off')}
        >
          OFF
        </button>
      </div>
      {mouseHookError && (
        <div>
          <small>마우스 훅 실패: 접근성 권한을 확인하세요.</small>
        </div>
      )}
      {!mouseTrackingHealthy && !mouseHookError && (
        <div>
          <small>마우스 추적이 불안정해 자동 상호작용이 제한됩니다.</small>
        </div>
      )}
    </div>
  );
}
