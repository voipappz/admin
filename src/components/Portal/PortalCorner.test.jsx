import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PortalCorner from './PortalCorner.jsx';
import { PortalPanelsProvider } from '../../context/PortalPanelsContext';

vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ status: 'registered' }) }));
vi.mock('../Phone/PhoneScreen.jsx', () => ({ default: () => <div data-testid="phone-screen" /> }));
vi.mock('../AIChat/PortalMcpAssistant.jsx', () => ({ default: () => <div data-testid="assistant-body" /> }));

const mount = () => render(<PortalPanelsProvider><PortalCorner /></PortalPanelsProvider>);

// The two things you reach for. Buttons, not rail items: they act, they do not
// navigate — and only one panel is open at a time.
describe('the corner', () => {
  it('shows a phone with its registration dot, and an assistant', () => {
    mount();
    expect(screen.getByTestId('phone-fab')).toHaveAccessibleName(/Phone — registered/);
    expect(screen.getByTestId('assistant-fab')).toHaveAccessibleName('Assistant');
    expect(screen.getByTestId('phone-fab-status')).toBeInTheDocument();
  });

  it('opens one panel at a time', () => {
    mount();
    fireEvent.click(screen.getByTestId('phone-fab'));
    expect(screen.getByTestId('phone-panel')).toHaveAttribute('aria-hidden', 'false');
    fireEvent.click(screen.getByTestId('assistant-fab'));
    expect(screen.getByTestId('phone-panel')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('assistant-panel')).toHaveAttribute('aria-hidden', 'false');
  });

  it('closes on a second click, and on Escape', () => {
    mount();
    fireEvent.click(screen.getByTestId('phone-fab'));
    fireEvent.click(screen.getByTestId('phone-fab'));
    expect(screen.getByTestId('phone-panel')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByTestId('assistant-fab'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('assistant-panel')).toHaveAttribute('aria-hidden', 'true');
  });
});
