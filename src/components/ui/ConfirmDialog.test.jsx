import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.jsx';
import { ConfirmProvider, useConfirm } from './useConfirm.jsx';

describe('ConfirmDialog', () => {
  it('names what is being deleted and is labelled for screen readers', () => {
    render(<ConfirmDialog open title="Delete User" entityName="Dana" onClose={() => {}} onConfirm={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete User' });
    expect(dialog).toHaveTextContent('Are you sure you want to delete Dana?');
    expect(dialog).toHaveAccessibleDescription(/cannot be undone/);
  });

  it('confirms with the button and with Enter, cancels with Esc', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Delete" onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('confirm-delete-button'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('locks while loading: no confirm, no cancel', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog open loading title="Delete" onClose={onClose} onConfirm={onConfirm} />);
    expect(screen.getByTestId('confirm-delete-button')).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is not red when not destructive', () => {
    render(<ConfirmDialog open destructive={false} confirmLabel="Send" title="Send" onClose={() => {}} onConfirm={() => {}} />);
    expect(screen.getByTestId('confirm-delete-button')).toHaveClass('MuiButton-colorPrimary');
  });
});

describe('useConfirm', () => {
  const Probe = ({ onResult }) => {
    const confirm = useConfirm();
    return <button onClick={async () => onResult(await confirm({ title: 'Remove it?' }))}>go</button>;
  };

  it('resolves true on confirm and false on cancel', async () => {
    const results = [];
    render(<ConfirmProvider><Probe onResult={(r) => results.push(r)} /></ConfirmProvider>);

    fireEvent.click(screen.getByText('go'));
    fireEvent.click(await screen.findByTestId('confirm-delete-button'));
    await vi.waitFor(() => expect(results).toEqual([true]));

    fireEvent.click(screen.getByText('go'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await vi.waitFor(() => expect(results).toEqual([true, false]));
  });

  it('falls back to window.confirm without a provider', async () => {
    const results = [];
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Probe onResult={(r) => results.push(r)} />);
    fireEvent.click(screen.getByText('go'));
    await vi.waitFor(() => expect(results).toEqual([true]));
    expect(spy).toHaveBeenCalledWith('Remove it?');
    spy.mockRestore();
  });
});
