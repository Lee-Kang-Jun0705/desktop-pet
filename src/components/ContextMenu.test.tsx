import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  const defaultProps = {
    petName: 'Stone Guardian',
    scale: 0.8,
    frameSize: 204.8,
    screenBounds: { originX: 0, originY: 0, width: 1920, height: 1080 },
    onScaleChange: vi.fn(),
    onAttack: vi.fn(),
    onRun: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders pet name', () => {
    render(<ContextMenu {...defaultProps} />);
    expect(screen.getByText('Stone Guardian')).toBeInTheDocument();
  });

  it('renders scale display', () => {
    render(<ContextMenu {...defaultProps} scale={1.0} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('calls onScaleChange when scale slider changed', () => {
    const onScaleChange = vi.fn();
    render(<ContextMenu {...defaultProps} onScaleChange={onScaleChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '100' } });
    expect(onScaleChange).toHaveBeenCalledWith(1);
  });

  it('calls onAttack when attack button clicked', () => {
    const onAttack = vi.fn();
    render(<ContextMenu {...defaultProps} onAttack={onAttack} />);

    fireEvent.click(screen.getByText('공격!'));
    expect(onAttack).toHaveBeenCalledTimes(1);
  });

  it('calls onRun when run button clicked', () => {
    const onRun = vi.fn();
    render(<ContextMenu {...defaultProps} onRun={onRun} />);

    fireEvent.click(screen.getByText('달려!'));
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });
});
