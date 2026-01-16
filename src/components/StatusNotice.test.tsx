import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusNotice } from './StatusNotice';
import type { ClickThroughMode } from '../types/pet.types';

describe('StatusNotice', () => {
  const defaultProps = {
    clickThrough: true,
    clickThroughMode: 'auto' as ClickThroughMode,
    mouseHookError: null,
    mouseTrackingHealthy: true,
    onModeSelect: vi.fn(),
  };

  it('renders click through status correctly when ON', () => {
    render(<StatusNotice {...defaultProps} />);
    expect(screen.getByText(/클릭 통과: ON/)).toBeInTheDocument();
  });

  it('renders click through status correctly when OFF', () => {
    render(<StatusNotice {...defaultProps} clickThrough={false} />);
    expect(screen.getByText(/클릭 통과: OFF/)).toBeInTheDocument();
  });

  it('renders mode label correctly', () => {
    render(<StatusNotice {...defaultProps} clickThroughMode="locked_on" />);
    expect(screen.getByText(/모드: 고정\(ON\)/)).toBeInTheDocument();
  });

  it('shows mouse hook error when present', () => {
    render(<StatusNotice {...defaultProps} mouseHookError="permission denied" />);
    expect(screen.getByText(/마우스 훅 실패/)).toBeInTheDocument();
  });

  it('shows unhealthy tracking warning', () => {
    render(<StatusNotice {...defaultProps} mouseTrackingHealthy={false} />);
    expect(screen.getByText(/마우스 추적이 불안정/)).toBeInTheDocument();
  });

  it('calls onModeSelect when mode button clicked', () => {
    const onModeSelect = vi.fn();
    render(<StatusNotice {...defaultProps} onModeSelect={onModeSelect} />);

    fireEvent.click(screen.getByText('ON'));
    expect(onModeSelect).toHaveBeenCalledWith('locked_on');

    fireEvent.click(screen.getByText('OFF'));
    expect(onModeSelect).toHaveBeenCalledWith('locked_off');

    fireEvent.click(screen.getByText('자동'));
    expect(onModeSelect).toHaveBeenCalledWith('auto');
  });

  it('highlights active mode button', () => {
    const { rerender } = render(<StatusNotice {...defaultProps} clickThroughMode="auto" />);
    expect(screen.getByText('자동').classList.contains('active')).toBe(true);

    rerender(<StatusNotice {...defaultProps} clickThroughMode="locked_on" />);
    expect(screen.getByText('ON').classList.contains('active')).toBe(true);

    rerender(<StatusNotice {...defaultProps} clickThroughMode="locked_off" />);
    expect(screen.getByText('OFF').classList.contains('active')).toBe(true);
  });
});
