# 🐾 Desktop Pet

바탕화면에서 돌아다니는 귀여운 펫 애플리케이션

![Desktop Pet](assets/sprites/idle.webp)

## 설치

### macOS
```bash
curl -fsSL https://raw.githubusercontent.com/kangjunlee/desktop-pet/main/install.sh | bash
```

### Windows (PowerShell 관리자 권한)
```powershell
irm https://raw.githubusercontent.com/kangjunlee/desktop-pet/main/install.ps1 | iex
```

### 직접 다운로드
[Releases 페이지](https://github.com/kangjunlee/desktop-pet/releases)에서 다운로드

## 사용법

- **일반 모드**: 바탕화면 클릭 시 펫이 그 위치로 달려감
- **펫 조작 모드**: 트레이 아이콘 → "펫 조작 모드" 클릭
  - 드래그로 위치 이동
  - 마우스 휠로 크기 조절
  - 우클릭으로 메뉴

## 기능

- ✅ 투명 윈도우로 바탕화면 위에서 움직임
- ✅ 다른 앱 클릭 방해 없음
- ✅ 듀얼 모니터 지원
- ✅ 스프라이트 애니메이션 (idle, walk, run, attack)
- ✅ AI 배회 시스템
- ✅ 시스템 트레이 메뉴
- ✅ macOS / Windows 지원

## 개발

```bash
# 의존성 설치
pnpm install

# 개발 모드
pnpm tauri dev

# 빌드
pnpm tauri build
```

## 라이선스

MIT License
