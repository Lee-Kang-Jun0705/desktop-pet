# Desktop Pet - Product Requirements Document (PRD)

**Version:** 0.1.0
**Last Updated:** 2026-01-16
**Author:** 이강준
**Status:** Development

---

## 1. 제품 개요

### 1.1 제품명
Desktop Pet (데스크톱 펫)

### 1.2 제품 설명
macOS 및 Windows 데스크톱에서 자유롭게 돌아다니는 애니메이션 캐릭터(펫) 애플리케이션. 사용자는 펫을 드래그하여 이동시키고, 크기를 조절하며, 다양한 애니메이션 상태를 관찰할 수 있습니다.

### 1.3 목표 플랫폼
- macOS (Apple Silicon / Intel)
- Windows (64-bit)

### 1.4 기술 스택
| 영역 | 기술 |
|------|------|
| Framework | Tauri v2 |
| Backend | Rust |
| Frontend | React 18 + TypeScript |
| Build Tool | Vite |
| Package Manager | pnpm |

---

## 2. 기능 요구사항

### 2.1 핵심 기능

#### 2.1.1 펫 표시 및 애니메이션
- **스프라이트 시트 기반 애니메이션**
  - 4x4 그리드 (16프레임)
  - 프레임 크기: 256x256px (기본)
  - 스프라이트 시트 크기: 1024x1024px
  - WebP 형식 지원

- **애니메이션 상태**
  | 상태 | 설명 | 프레임 속도 |
  |------|------|------------|
  | idle | 대기 상태 | 150ms |
  | walk | 걷기 | 100ms |
  | run | 달리기 | 80ms |
  | attack | 공격 | 100ms |

#### 2.1.2 펫 이동
- **자동 배회 (AI Wandering)**
  - 랜덤 행동 선택: idle, walk, run, attack
  - 목표 위치로 자동 이동
  - 이동 방향에 따라 좌우 반전

- **수동 이동 (드래그)**
  - 마우스 왼쪽 버튼으로 드래그
  - 드래그 중에는 자동 배회 중지
  - 화면 경계 내로 위치 제한

#### 2.1.3 크기 조절
- **마우스 휠로 조절**
  - 최소: 30%
  - 최대: 200%
  - 기본: 80%
- **컨텍스트 메뉴 슬라이더로 조절**

#### 2.1.4 컨텍스트 메뉴 (우클릭)
- 펫 이름 표시
- 현재 크기 표시
- 크기 조절 슬라이더
- "공격!" 버튼 (attack 애니메이션 실행)
- "달려!" 버튼 (랜덤 위치로 달리기)

### 2.2 시스템 기능

#### 2.2.1 투명 윈도우
- 배경 완전 투명
- 항상 최상위 표시 (Always on Top)
- 창 테두리 없음 (Decorations: false)
- 작업표시줄에서 숨김

#### 2.2.2 시스템 트레이
- 트레이 아이콘 표시
- 메뉴 항목:
  - "펫 조작 모드" (클릭 통과 토글)
  - "종료"

#### 2.2.3 클릭 통과 모드
- 활성화 시: 펫 아래의 창 클릭 가능
- 비활성화 시: 펫과 직접 상호작용 가능
- 기본값: 비활성화 (펫 조작 가능)

---

## 3. 기술 구현 상세

### 3.1 프로젝트 구조

```
desktop-pet/
├── src/                      # React 프론트엔드
│   ├── App.tsx              # 메인 컴포넌트
│   ├── App.css              # 스타일
│   └── main.tsx             # 엔트리 포인트
├── src-tauri/               # Tauri 백엔드
│   ├── src/
│   │   └── lib.rs           # Rust 백엔드 로직
│   ├── icons/               # 앱 아이콘
│   ├── Cargo.toml           # Rust 의존성
│   └── tauri.conf.json      # Tauri 설정
├── assets/
│   └── sprites/             # 스프라이트 시트
│       ├── idle.webp
│       ├── walk.webp
│       ├── run.webp
│       └── attack.webp
├── docs/
│   └── PRD.md               # 이 문서
├── install.sh               # macOS 설치 스크립트
├── install.ps1              # Windows 설치 스크립트
└── README.md                # 프로젝트 설명
```

### 3.2 프론트엔드 구현 (App.tsx)

#### 3.2.1 타입 정의

```typescript
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
```

#### 3.2.2 상태 관리

| State | 타입 | 설명 |
|-------|------|------|
| position | Position | 펫의 현재 위치 |
| animState | AnimationState | 현재 애니메이션 상태 |
| frame | number | 현재 프레임 (0-15) |
| isFlipped | boolean | 좌우 반전 여부 |
| isDragging | boolean | 드래그 중 여부 |
| scale | number | 현재 크기 배율 |
| showMenu | boolean | 컨텍스트 메뉴 표시 여부 |
| screenSize | {width, height} | 화면 크기 |

#### 3.2.3 핵심 useEffect 훅

1. **화면 크기 설정**
```typescript
useEffect(() => {
  const width = window.screen.width;
  const height = window.screen.height;
  setScreenSize({ width, height });
  setPosition({ x: width / 2 - frameSize / 2, y: height / 2 - frameSize / 2 });
  invoke('set_window_bounds', { x: 0, y: 0, width, height });
}, []);
```

2. **프레임 애니메이션**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    setFrame((prev) => (prev + 1) % 16);
  }, FRAME_SPEEDS[animState]);
  return () => clearInterval(interval);
}, [animState]);
```

3. **자동 배회 AI**
```typescript
useEffect(() => {
  if (isDragging) return;

  const startWander = () => {
    const actions = ['idle', 'walk', 'idle', 'walk', 'run', 'attack'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    // 행동에 따른 처리...
  };

  startWander();
  return () => clearTimeout(wanderTimeout.current);
}, [isDragging, frameSize, screenSize]);
```

4. **이동 로직**
```typescript
useEffect(() => {
  if (!targetPosition.current || isDragging || animState === 'idle') return;

  const speed = animState === 'run' ? 4 : 2;
  const moveInterval = setInterval(() => {
    // 목표 위치로 이동...
  }, 16);
  return () => clearInterval(moveInterval);
}, [animState, isDragging]);
```

#### 3.2.4 스프라이트 렌더링

```typescript
const col = frame % 4;
const row = Math.floor(frame / 4);

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
```

### 3.3 백엔드 구현 (lib.rs)

#### 3.3.1 Tauri 명령어

```rust
#[tauri::command]
fn set_click_through(enabled: bool, window: tauri::Window) -> Result<(), String>

#[tauri::command]
fn get_click_through() -> bool

#[tauri::command]
fn get_all_monitors(window: tauri::Window) -> Result<Vec<ScreenInfo>, String>

#[tauri::command]
fn set_window_bounds(window: tauri::Window, x: i32, y: i32, width: u32, height: u32) -> Result<(), String>
```

#### 3.3.2 시스템 트레이 설정

```rust
let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
let toggle_click = MenuItem::with_id(app, "toggle_click", "펫 조작 모드", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&toggle_click, &quit])?;

TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .tooltip("Desktop Pet - 우클릭으로 메뉴")
    .on_menu_event(move |app, event| {
        match event.id.as_ref() {
            "quit" => app.exit(0),
            "toggle_click" => { /* 클릭 통과 토글 */ }
            _ => {}
        }
    })
    .build(app)?;
```

#### 3.3.3 마우스 이벤트 리스닝

```rust
fn listen_for_mouse_events(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut mouse_manager = OtherMouse::new();
        let _ = mouse_manager.hook(Box::new(move |e| match e {
            MouseEvent::Press(MouseButton::Left) => {
                let position = Mouse::get_mouse_position();
                // 마우스 클릭 이벤트 emit
            }
            _ => (),
        }));
    });
}
```

### 3.4 Tauri 설정 (tauri.conf.json)

```json
{
  "app": {
    "macOSPrivateApi": true,
    "windows": [{
      "title": "Desktop Pet",
      "width": 1920,
      "height": 1080,
      "alwaysOnTop": true,
      "decorations": false,
      "transparent": true,
      "resizable": true,
      "skipTaskbar": true,
      "visible": true,
      "fullscreen": false,
      "maximized": true
    }],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  }
}
```

---

## 4. 스프라이트 시트 가이드라인

### 4.1 스프라이트 시트 구조

```
┌─────┬─────┬─────┬─────┐
│ 0,0 │ 0,1 │ 0,2 │ 0,3 │  ← Row 0 (frames 0-3)
├─────┼─────┼─────┼─────┤
│ 1,0 │ 1,1 │ 1,2 │ 1,3 │  ← Row 1 (frames 4-7)
├─────┼─────┼─────┼─────┤
│ 2,0 │ 2,1 │ 2,2 │ 2,3 │  ← Row 2 (frames 8-11)
├─────┼─────┼─────┼─────┤
│ 3,0 │ 3,1 │ 3,2 │ 3,3 │  ← Row 3 (frames 12-15)
└─────┴─────┴─────┴─────┘
```

### 4.2 새 캐릭터 추가 방법

1. **스프라이트 시트 준비**
   - 각 상태별 1024x1024px WebP 파일 준비
   - 파일명: `idle.webp`, `walk.webp`, `run.webp`, `attack.webp`
   - `assets/sprites/[캐릭터명]/` 폴더에 저장

2. **코드 수정 (App.tsx)**
```typescript
// 새 캐릭터 import
import newIdleSprite from '../assets/sprites/new-pet/idle.webp';
import newWalkSprite from '../assets/sprites/new-pet/walk.webp';
// ...

// PetConfig 추가
const NEW_PET: PetConfig = {
  id: 'new-pet',
  name: 'New Pet Name',
  sprites: {
    idle: newIdleSprite,
    walk: newWalkSprite,
    run: newRunSprite,
    attack: newAttackSprite,
  },
  scale: 0.8,
};
```

3. **캐릭터 선택 UI 추가** (선택사항)
   - 컨텍스트 메뉴에 캐릭터 선택 옵션 추가
   - 또는 별도의 설정 창 구현

---

## 5. 빌드 및 배포

### 5.1 개발 환경 설정

```bash
# 의존성 설치
pnpm install

# Rust 설치 (필요시)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 개발 서버 실행
pnpm tauri dev
```

### 5.2 프로덕션 빌드

```bash
# macOS
pnpm tauri build
# 결과: src-tauri/target/release/bundle/dmg/Desktop Pet_*.dmg

# Windows (Windows 환경에서)
pnpm tauri build
# 결과: src-tauri/target/release/bundle/msi/*.msi
```

### 5.3 설치 방법

**macOS (터미널):**
```bash
curl -fsSL https://raw.githubusercontent.com/Lee-Kang-Jun0705/desktop-pet/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Lee-Kang-Jun0705/desktop-pet/main/install.ps1 | iex
```

---

## 6. 알려진 이슈 및 제한사항

### 6.1 현재 알려진 이슈

| 이슈 | 상태 | 설명 |
|------|------|------|
| 마우스 클릭 감지 | 해결 중 | macOS에서 접근성 권한이 있어도 마우스 훅이 작동하지 않을 수 있음 |
| 멀티모니터 지원 | 제한적 | 현재 주 모니터에서만 동작 |

### 6.2 해결 방법

- **클릭 감지 문제**: 클릭 통과 모드를 비활성화하여 펫과 직접 상호작용
- **멀티모니터**: 향후 버전에서 지원 예정

---

## 7. 향후 계획

### 7.1 v0.2.0 예정 기능
- [ ] 다중 캐릭터 선택 UI
- [ ] 설정 저장 (위치, 크기, 선호 캐릭터)
- [ ] 멀티모니터 완전 지원

### 7.2 v0.3.0 예정 기능
- [ ] 캐릭터 마켓플레이스
- [ ] 사용자 정의 애니메이션 추가
- [ ] 알림/리마인더 기능

---

## 8. 참고 자료

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [React Documentation](https://react.dev/)
- [Rust Documentation](https://doc.rust-lang.org/)
- [GitHub Repository](https://github.com/Lee-Kang-Jun0705/desktop-pet)

---

*이 문서는 Desktop Pet 프로젝트의 제품 요구사항을 정의합니다.*
