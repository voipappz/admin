import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBarPhoneButton from './TopBarPhoneButton.jsx';

const toggle = vi.fn();
vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ status: 'registered' }) }));
vi.mock('../../context/PortalSidebarContext', () => ({ usePortalSidebar: () => ({ view: null, toggle }) }));

describe('the top bar phone button', () => {
  it('opens the phone in the right-hand sidebar', () => {
    render(<TopBarPhoneButton />);
    fireEvent.click(screen.getByTestId('topbar-phone-button'));
    expect(toggle).toHaveBeenCalledWith('phone');
  });
});
