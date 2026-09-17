import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PermissionsTable from './PermissionsTable.jsx';

const typeData = {
  users: { main: ['read', 'write'] },
  calls: { main: ['read', 'write', 'click2call'] },
  reports: { main: ['read', 'write'], AgentStats: ['read', 'write'] },
};

describe('PermissionsTable', () => {
  it('shows one row per service with read and write switches', () => {
    render(<PermissionsTable typeData={typeData} value={{ users: { main: ['read'] } }} onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'users read' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'users write' })).not.toBeChecked();
    expect(screen.getByText('1 / 9')).toBeInTheDocument();
  });

  it('toggles a main permission without touching the others', () => {
    const onChange = vi.fn();
    render(<PermissionsTable typeData={typeData} value={{ users: { main: ['read'] } }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'users write' }));
    expect(onChange).toHaveBeenCalledWith({ users: { main: ['read', 'write'] } });
  });

  it('keeps extras (click2call, per-report grants) behind the more button', () => {
    const onChange = vi.fn();
    render(<PermissionsTable typeData={typeData} value={{}} onChange={onChange} />);
    expect(screen.queryByRole('switch', { name: 'calls main click2call' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /calls: 0 of 1 more/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'calls main click2call' }));
    expect(onChange).toHaveBeenCalledWith({ calls: { main: ['click2call'] } });
  });

  it('search opens the matching extras', () => {
    render(<PermissionsTable typeData={typeData} value={{}} onChange={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search permissions' }), { target: { value: 'agentstats' } });
    expect(screen.getByRole('switch', { name: 'reports AgentStats read' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'users read' })).toBeNull();
  });

  it('select all grants everything, clear all grants nothing', () => {
    const onChange = vi.fn();
    render(<PermissionsTable typeData={typeData} value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenLastCalledWith({
      users: { main: ['read', 'write'] },
      calls: { main: ['read', 'write', 'click2call'] },
      reports: { main: ['read', 'write'], AgentStats: ['read', 'write'] },
    });
  });
});
