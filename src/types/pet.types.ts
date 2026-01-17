// Pet 관련 타입 정의

// 기본 애니메이션 상태 (모든 캐릭터 공통)
export type BaseAnimationState = 'idle' | 'walk' | 'attack' | 'die' | 'hit' | 'skill';

// 확장 애니메이션 상태 (캐릭터별 선택적)
export type ExtendedAnimationState = 'run' | 'jump' | 'claw_attack';

// 전체 애니메이션 상태
export type AnimationState = BaseAnimationState | ExtendedAnimationState;

export type ClickThroughMode = 'auto' | 'locked_on' | 'locked_off';

export interface Position {
  x: number;
  y: number;
}

export interface ScreenBounds {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface ScreenInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 스프라이트 설정 (기본 필수 + 선택적 확장)
export type SpriteConfig = Record<BaseAnimationState, string> & Partial<Record<ExtendedAnimationState, string>>;

export interface PetConfig {
  id: string;
  name: string;
  sprites: SpriteConfig;
  scale: number;
}
