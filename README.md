# 🐾 Desktop Pet

바탕화면에서 돌아다니는 귀여운 펫 애플리케이션

![Desktop Pet](assets/sprites/idle.webp)

![version](https://img.shields.io/badge/version-0.1.0-blue)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![license](https://img.shields.io/badge/license-MIT-green)

---

## 📖 문서

- **[📚 사용 튜토리얼](docs/TUTORIAL.md)** - 상세 사용법 및 가이드
- **[📋 PRD](docs/PRD.md)** - 제품 요구사항 문서

---

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

---

## 🎯 빠른 사용법

| 동작 | 방법 |
|------|------|
| **이동** | 펫 드래그 |
| **클릭 이동** | 바탕화면 아무 곳이나 클릭 |
| **크기 조절** | 마우스 휠 (30%~200%) |
| **메뉴** | 펫 우클릭 |
| **모드 변경** | 상단 버튼 또는 트레이 메뉴 |

### 클릭 통과 모드

| 모드 | 설명 |
|------|------|
| **자동** (권장) | 펫 근처에서만 조작 가능 |
| **ON** | 항상 클릭 통과 |
| **OFF** | 항상 조작 가능 |

> 📖 더 자세한 사용법은 [튜토리얼](docs/TUTORIAL.md)을 참고하세요.

---

## 기능

- ✅ 투명 윈도우로 바탕화면 위에서 움직임
- ✅ 다른 앱 클릭 방해 없음
- ✅ 듀얼 모니터 지원
- ✅ 스프라이트 애니메이션 (idle, walk, run, attack)
- ✅ AI 배회 시스템
- ✅ 마우스 시선 추적 + 근접 반응
- ✅ 바탕화면 클릭 이동
- ✅ 시스템 트레이 메뉴
- ✅ macOS / Windows 지원

---

## 개발

### 요구사항
- Node.js 18+
- pnpm 8+
- Rust 1.70+

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 개발 모드
pnpm tauri dev

# 빌드
pnpm tauri build
```

### 테스트

```bash
# 유닛 테스트
pnpm test:run

# E2E 테스트
pnpm test:e2e

# 커버리지
pnpm test:coverage
```

---

## 프로젝트 구조

```
desktop-pet/
├── src/                    # React 프론트엔드
│   ├── components/         # UI 컴포넌트
│   ├── constants/          # 상수 정의
│   ├── types/              # TypeScript 타입
│   └── utils/              # 유틸리티 함수
├── src-tauri/              # Rust 백엔드
├── assets/sprites/         # 스프라이트 이미지
├── e2e/                    # E2E 테스트
└── docs/                   # 문서
```

---

## 라이선스

MIT License

---

Made with ❤️ by Kangjun Lee
