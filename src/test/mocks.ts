import { vi } from 'vitest';
import type { Position, ScreenBounds, ClickThroughMode } from '../types/pet.types';

export const mockInvoke = vi.fn();
export const mockListen = vi.fn(() => Promise.resolve(() => {}));

export const mockScreenBounds: ScreenBounds = {
  originX: 0,
  originY: 0,
  width: 1920,
  height: 1080,
};

export const mockPosition: Position = {
  x: 500,
  y: 500,
};

export function createMockListeners() {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};

  mockListen.mockImplementation((event: string, callback: (e: unknown) => void) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return Promise.resolve(() => {
      const idx = listeners[event].indexOf(callback);
      if (idx >= 0) listeners[event].splice(idx, 1);
    });
  });

  return {
    emit: (event: string, payload: unknown) => {
      listeners[event]?.forEach((cb) => cb({ payload }));
    },
    listeners,
  };
}
