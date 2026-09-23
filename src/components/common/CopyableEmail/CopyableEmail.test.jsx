import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import CopyableEmail from './CopyableEmail.jsx';

describe('CopyableEmail', () => {
  let writeText;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('shows the email with a copy button that copies it', async () => {
    render(<CopyableEmail email="agent@example.com" />);
    expect(screen.getByText('agent@example.com')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy email' }));
    });
    expect(writeText).toHaveBeenCalledWith('agent@example.com');
  });

  it('does not trigger the row or list item it sits in', async () => {
    const onRowClick = vi.fn();
    render(<div onClick={onRowClick}><CopyableEmail email="agent@example.com" /></div>);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy email' }));
    });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('renders the fallback and no copy button without an email', () => {
    render(<CopyableEmail email="" fallback="No email" />);
    expect(screen.getByText('No email')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy email' })).not.toBeInTheDocument();
  });
});
