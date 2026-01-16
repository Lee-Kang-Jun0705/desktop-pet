import type { Position, ScreenBounds } from '../types/pet.types';

/**
 * 위치를 화면 경계 내로 제한
 */
export function clampPosition(
  pos: Position,
  size: number,
  bounds: ScreenBounds
): Position {
  const maxX = Math.max(0, bounds.width - size);
  const maxY = Math.max(0, bounds.height - size);
  return {
    x: Math.max(0, Math.min(maxX, pos.x)),
    y: Math.max(0, Math.min(maxY, pos.y)),
  };
}

/**
 * 두 점 사이의 거리 계산
 */
export function distance(p1: Position, p2: Position): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * 펫의 중심 위치 계산
 */
export function getPetCenter(pos: Position, size: number): Position {
  return {
    x: pos.x + size / 2,
    y: pos.y + size / 2,
  };
}
