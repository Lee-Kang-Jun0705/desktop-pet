import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionModal } from './PermissionModal';

describe('PermissionModal', () => {
  const defaultProps = {
    onDismiss: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  it('renders permission modal with title', () => {
    render(<PermissionModal {...defaultProps} />);
    expect(screen.getByText('접근성 권한 필요')).toBeInTheDocument();
  });

  it('renders permission instructions', () => {
    render(<PermissionModal {...defaultProps} />);
    expect(screen.getByText(/손쉬운 사용/)).toBeInTheDocument();
  });

  it('calls onOpenSettings when settings button clicked', () => {
    const onOpenSettings = vi.fn();
    render(<PermissionModal {...defaultProps} onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByText('설정 열기'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when confirm button clicked', () => {
    const onDismiss = vi.fn();
    render(<PermissionModal {...defaultProps} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText('확인'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
