import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    switch (cmd) {
      case 'get_click_through':
        return Promise.resolve(true);
      case 'set_click_through':
        return Promise.resolve();
      case 'get_mouse_position':
        return Promise.resolve({ x: 500, y: 500 });
      case 'get_all_monitors':
        return Promise.resolve([{ x: 0, y: 0, width: 1920, height: 1080 }]);
      case 'get_primary_monitor':
        return Promise.resolve({ x: 0, y: 0, width: 1920, height: 1080 });
      case 'set_window_bounds':
        return Promise.resolve();
      case 'open_accessibility_settings':
        return Promise.resolve();
      default:
        return Promise.resolve();
    }
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock window.screen
Object.defineProperty(window, 'screen', {
  value: { width: 1920, height: 1080 },
  writable: true,
});
