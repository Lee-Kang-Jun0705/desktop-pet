// Pet 관련 타입 정의

export type AnimationState = 'idle' | 'walk' | 'run' | 'attack';

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

export interface PetConfig {
  id: string;
  name: string;
  sprites: Record<AnimationState, string>;
  scale: number;
}
