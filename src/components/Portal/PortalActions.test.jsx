import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PortalActions from './PortalActions.jsx';

let status = 'registered';
const mockToggle = vi.fn();
vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ status }) }));
vi.mock('../../context/PortalSidebarContext', () => ({ usePortalSidebar: () => ({ view: null, toggle: mockToggle }) }));

// One button: the assistant is a tab inside the phone, not a second thing to press.
describe('the bar actions', () => {
  it('are one phone button, carrying the registration state', () => {
    render(<PortalActions />);
    const button = screen.getByTestId('phone-button');
    expect(button).toHaveAccessibleName(/Phone — registered/);
    expect(screen.getByTestId('phone-status')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-button')).toBeNull();
  });

  it('opens the sidebar on the phone', () => {
    render(<PortalActions />);
    fireEvent.click(screen.getByTestId('phone-button'));
    expect(mockToggle).toHaveBeenCalledWith('phone');
  });

  it('says what is wrong when the phone is not registered', () => {
    status = 'failed';
    render(<PortalActions />);
    expect(screen.getByTestId('phone-button')).toHaveAccessibleName(/Phone — failed/);
    status = 'registered';
  });
});
