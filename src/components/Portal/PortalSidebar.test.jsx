import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortalSidebar from './PortalSidebar.jsx';

let sidebar = { view: null, params: null, close: vi.fn() };
vi.mock('../../context/PortalSidebarContext', () => ({ usePortalSidebar: () => sidebar }));
vi.mock('../Phone/PhoneScreen.jsx', () => ({ default: () => <div data-testid="phone-screen" /> }));
vi.mock('../Calls/CallDetailPanel/CallDetailPanel.jsx', () => ({ default: ({ call }) => <div data-testid="call-detail">{call?.uuid}</div> }));

describe('the portal sidebar', () => {
  it('shows the phone', () => {
    sidebar = { view: 'phone', params: { tab: 'dialpad' }, close: vi.fn() };
    render(<PortalSidebar />);
    expect(screen.getByTestId('phone-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('call-detail')).toBeNull();
  });

  // Unmounting the phone to show a call threw away a half-typed number and an
  // open transfer — and would drop an in-progress call's UI the moment someone
  // clicked a row.
  it('keeps the phone mounted while a call is showing', () => {
    sidebar = { view: 'call', params: { call: { uuid: 'call-9' } }, close: vi.fn() };
    render(<PortalSidebar />);
    expect(screen.getByTestId('call-detail')).toHaveTextContent('call-9');
    expect(screen.getByTestId('phone-screen')).toBeInTheDocument();
  });
});
