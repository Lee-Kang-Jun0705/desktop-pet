// Pet 관련 상수 정의
import type { AnimationState, PetConfig } from '../types/pet.types';

// 스톤 가디언 스프라이트 import
import stoneGuardianIdle from '../../assets/sprites/stone-guardian/idle.png';
import stoneGuardianWalk from '../../assets/sprites/stone-guardian/walk.png';
import stoneGuardianRun from '../../assets/sprites/stone-guardian/run.png';
import stoneGuardianAttack from '../../assets/sprites/stone-guardian/attack.png';
import stoneGuardianJump from '../../assets/sprites/stone-guardian/jump.png';
import stoneGuardianDie from '../../assets/sprites/stone-guardian/die.png';
import stoneGuardianHit from '../../assets/sprites/stone-guardian/hit.png';
import stoneGuardianSkill from '../../assets/sprites/stone-guardian/skill.png';

// 철장 무승 스프라이트 import
import ironFistIdle from '../../assets/sprites/iron-fist-master/idle.png';
import ironFistWalk from '../../assets/sprites/iron-fist-master/walk.png';
import ironFistAttack from '../../assets/sprites/iron-fist-master/attack.png';
import ironFistDie from '../../assets/sprites/iron-fist-master/die.png';
import ironFistHit from '../../assets/sprites/iron-fist-master/hit.png';
import ironFistSkill from '../../assets/sprites/iron-fist-master/skill.png';
import ironFistClawAttack from '../../assets/sprites/iron-fist-master/claw_attack.png';

// 프레임 설정
export const BASE_FRAME_SIZE = 256;
export const TOTAL_FRAMES = 16;
export const GRID_SIZE = 4;

// 프레임 속도 (ms) - 더 부드러운 애니메이션을 위해 조정
export const FRAME_SPEEDS: Record<AnimationState, number> = {
  idle: 120,        // idle은 느긋하게
  walk: 80,         // 걷기는 자연스럽게
  run: 60,          // 달리기는 빠르게
  attack: 70,       // 공격은 역동적으로
  jump: 80,         // 점프
  die: 100,         // 죽음
  hit: 60,          // 피격
  skill: 70,        // 스킬
  claw_attack: 60,  // 발톱 공격
};

// 모션 관련
export const MOTION_DURATION_MS: Partial<Record<AnimationState, number>> = {
  attack: FRAME_SPEEDS.attack * TOTAL_FRAMES,
  skill: FRAME_SPEEDS.skill * TOTAL_FRAMES,
  jump: FRAME_SPEEDS.jump * TOTAL_FRAMES,
  hit: FRAME_SPEEDS.hit * TOTAL_FRAMES,
  claw_attack: FRAME_SPEEDS.claw_attack * TOTAL_FRAMES,
};

// 이동 속도 (픽셀/프레임, 60fps 기준)
export const WALK_SPEED = 3;   // 걷기는 천천히
export const RUN_SPEED = 7;    // 달리기는 빠르게

// 바닥 모드 설정
export const GROUND_MODE = true;
export const GROUND_OFFSET = 0;  // 화면 하단에 딱 붙이기
export const EDGE_MARGIN = 20;   // 화면 가장자리 여유 공간

// 행동 AI 관련
export const BEHAVIOR_TICK_MS = 2500;  // 2.5초마다 행동 결정 (모션 충분히 지속)
export const CLOSE_RADIUS = 90;
export const FOLLOW_RADIUS = 520;
export const FOLLOW_RUN_DISTANCE = 260;
export const INTERACT_MARGIN = 24;

// 크기 제한
export const MIN_SCALE = 0.15;  // 아주 작게 (15%)
export const MAX_SCALE = 3.0;   // 아주 크게 (300%)
export const DEFAULT_SCALE = 0.8;
export const SCALE_STEP = 0.1;

// 마우스 추적 관련
export const MOUSE_POLL_INTERVAL = 80;
export const MOUSE_STALE_THRESHOLD = 800;
export const MOUSE_PERMISSION_THRESHOLD = 2000;
export const MOUSE_HEALTH_CHECK_INTERVAL = 400;

// 컨트롤 패널 영역 (상단 중앙)
export const CONTROL_PANEL_WIDTH = 360;
export const CONTROL_PANEL_HEIGHT = 280;  // 실제 패널 높이에 맞춤
export const CONTROL_PANEL_MARGIN_TOP = 20;

// 스톤 가디언 펫 설정
export const STONE_GUARDIAN_PET: PetConfig = {
  id: 'stone-guardian',
  name: '스톤 가디언',
  sprites: {
    idle: stoneGuardianIdle,
    walk: stoneGuardianWalk,
    run: stoneGuardianRun,
    attack: stoneGuardianAttack,
    jump: stoneGuardianJump,
    die: stoneGuardianDie,
    hit: stoneGuardianHit,
    skill: stoneGuardianSkill,
  },
  scale: DEFAULT_SCALE,
};

// 철장 무승 펫 설정
export const IRON_FIST_MASTER_PET: PetConfig = {
  id: 'iron-fist-master',
  name: '철장 무승',
  sprites: {
    idle: ironFistIdle,
    walk: ironFistWalk,
    attack: ironFistAttack,
    die: ironFistDie,
    hit: ironFistHit,
    skill: ironFistSkill,
    claw_attack: ironFistClawAttack,
  },
  scale: DEFAULT_SCALE,
};

// 사용 가능한 펫 목록
export const AVAILABLE_PETS: PetConfig[] = [
  STONE_GUARDIAN_PET,
  IRON_FIST_MASTER_PET,
];

// 기본 펫 설정
export const DEFAULT_PET: PetConfig = STONE_GUARDIAN_PET;

// 유틸리티 함수
export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// 스프라이트 존재 여부 확인
export function hasAnimation(pet: PetConfig, state: AnimationState): boolean {
  return state in pet.sprites && pet.sprites[state as keyof typeof pet.sprites] !== undefined;
}

// 대체 애니메이션 상태 반환 (없으면 idle)
export function getFallbackAnimation(pet: PetConfig, state: AnimationState): AnimationState {
  if (hasAnimation(pet, state)) return state;

  // run이 없으면 walk로 대체
  if (state === 'run' && hasAnimation(pet, 'walk')) return 'walk';

  // 기본값은 idle
  return 'idle';
}
