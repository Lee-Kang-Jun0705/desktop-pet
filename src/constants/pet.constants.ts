// Pet 관련 상수 정의
import type { AnimationState, PetConfig } from '../types/pet.types';

// 스프라이트 import
import idleSprite from '../../assets/sprites/idle.webp';
import walkSprite from '../../assets/sprites/walk.webp';
import runSprite from '../../assets/sprites/run.webp';
import attackSprite from '../../assets/sprites/attack.webp';

// 프레임 설정
export const BASE_FRAME_SIZE = 256;
export const TOTAL_FRAMES = 16;
export const GRID_SIZE = 4;

// 프레임 속도 (ms)
export const FRAME_SPEEDS: Record<AnimationState, number> = {
  idle: 150,
  walk: 100,
  run: 80,
  attack: 100,
};

// 공격 관련
export const ATTACK_FRAMES = 16;
export const ATTACK_DURATION_MS = FRAME_SPEEDS.attack * ATTACK_FRAMES;

// 이동 속도
export const WALK_SPEED = 2;
export const RUN_SPEED = 4;

// 행동 AI 관련
export const BEHAVIOR_TICK_MS = 420;
export const CLOSE_RADIUS = 90;
export const FOLLOW_RADIUS = 520;
export const FOLLOW_RUN_DISTANCE = 260;
export const INTERACT_MARGIN = 24;

// 크기 제한
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 2.0;
export const DEFAULT_SCALE = 0.8;
export const SCALE_STEP = 0.1;

// 마우스 추적 관련
export const MOUSE_POLL_INTERVAL = 80;
export const MOUSE_STALE_THRESHOLD = 800;
export const MOUSE_PERMISSION_THRESHOLD = 2000;
export const MOUSE_HEALTH_CHECK_INTERVAL = 400;

// 컨트롤 패널 영역 (상단 중앙)
export const CONTROL_PANEL_WIDTH = 320;
export const CONTROL_PANEL_HEIGHT = 88;
export const CONTROL_PANEL_MARGIN_TOP = 20;

// 기본 펫 설정
export const DEFAULT_PET: PetConfig = {
  id: 'stone-guardian',
  name: 'Stone Guardian',
  sprites: {
    idle: idleSprite,
    walk: walkSprite,
    run: runSprite,
    attack: attackSprite,
  },
  scale: DEFAULT_SCALE,
};

// 유틸리티 함수
export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
