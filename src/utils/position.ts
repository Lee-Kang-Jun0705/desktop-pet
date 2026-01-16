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

/**
 * 컨트롤 패널 위치 계산
 */
export function calculateControlPanelPosition(
  screenWidth: number,
  panelWidth: number,
  marginTop: number
): Position {
  return {
    x: (screenWidth - panelWidth) / 2,
    y: marginTop,
  };
}

/**
 * 점이 사각형 내부에 있는지 확인
 */
export function isInsideRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
