import { describe, it, expect } from 'vitest';
import { clampPosition, calculateControlPanelPosition, isInsideRect } from './position';
import type { ScreenBounds } from '../types/pet.types';

describe('clampPosition', () => {
  const bounds: ScreenBounds = {
    originX: 0,
    originY: 0,
    width: 1920,
    height: 1080,
  };
  const frameSize = 256;

  it('should not change position when within bounds', () => {
    const pos = { x: 500, y: 500 };
    const result = clampPosition(pos, frameSize, bounds);
    expect(result.x).toBe(500);
    expect(result.y).toBe(500);
  });

  it('should clamp position when x is negative', () => {
    const pos = { x: -100, y: 500 };
    const result = clampPosition(pos, frameSize, bounds);
    expect(result.x).toBe(0);
  });

  it('should clamp position when y is negative', () => {
    const pos = { x: 500, y: -50 };
    const result = clampPosition(pos, frameSize, bounds);
    expect(result.y).toBe(0);
  });

  it('should clamp position when x exceeds width', () => {
    const pos = { x: 2000, y: 500 };
    const result = clampPosition(pos, frameSize, bounds);
    expect(result.x).toBe(1920 - frameSize);
  });

  it('should clamp position when y exceeds height', () => {
    const pos = { x: 500, y: 1200 };
    const result = clampPosition(pos, frameSize, bounds);
    expect(result.y).toBe(1080 - frameSize);
  });
});

describe('calculateControlPanelPosition', () => {
  it('should center panel horizontally', () => {
    const result = calculateControlPanelPosition(1920, 320, 20);
    expect(result.x).toBe(800);
    expect(result.y).toBe(20);
  });
});

describe('isInsideRect', () => {
  it('should return true when point is inside rect', () => {
    const result = isInsideRect(50, 50, { x: 0, y: 0, width: 100, height: 100 });
    expect(result).toBe(true);
  });

  it('should return false when point is outside rect', () => {
    const result = isInsideRect(150, 50, { x: 0, y: 0, width: 100, height: 100 });
    expect(result).toBe(false);
  });

  it('should return true when point is on boundary', () => {
    const result = isInsideRect(100, 50, { x: 0, y: 0, width: 100, height: 100 });
    expect(result).toBe(true);
  });
});
