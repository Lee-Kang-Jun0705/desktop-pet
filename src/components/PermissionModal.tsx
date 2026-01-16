interface PermissionModalProps {
  onDismiss: () => void;
}

export function PermissionModal({ onDismiss }: PermissionModalProps) {
  return (
    <div className="permission-overlay">
      <div className="permission-modal">
        <div className="permission-title">접근성 권한 필요</div>
        <div className="permission-body">
          macOS에서 전역 마우스 이벤트가 차단되어 기능이 동작하지 않습니다.
          <br />
          시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서
          <br />
          Desktop Pet(또는 터미널)을 허용해주세요.
        </div>
        <button className="permission-button" onClick={onDismiss}>
          확인
        </button>
      </div>
    </div>
  );
}
