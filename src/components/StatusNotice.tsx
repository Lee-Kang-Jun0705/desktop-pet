import type { ClickThroughMode } from '../types/pet.types';

interface StatusNoticeProps {
  clickThrough: boolean;
  clickThroughMode: ClickThroughMode;
  mouseHookError: string | null;
  mouseTrackingHealthy: boolean;
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
}: StatusNoticeProps) {
  const modeLabel = MODE_LABELS[clickThroughMode];

  return (
    <div className="interact-mode-notice">
      <div>
        클릭 통과: {clickThrough ? 'ON' : 'OFF'} · 모드: {modeLabel}
      </div>
      <small>트레이의 "자동 모드 / 클릭 통과 ON / 클릭 통과 OFF"로 상태 변경</small>
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
