import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalLine from './PortalLine.jsx';

const mockSave = vi.fn();
const mockDial = vi.fn();
const mockLogout = vi.fn();
vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ acl: { dashboard: ['read'], calls: ['read'] }, logout: mockLogout, token: 'tok' }) }));
const mockAsk = vi.fn(() => Promise.resolve({ text: 'You had 7 calls today.' }));
vi.mock('../../services/portalAssistant', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, askPortal: (...args) => mockAsk(...args) };
});
vi.mock('../../context/PortalPreferencesContext', () => ({ usePortalPreferences: () => ({ preferences: { theme: 'light', calls_density: 'comfortable' }, ready: true, save: mockSave }) }));
vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ dial: mockDial }) }));
const mockOpenSidebar = vi.fn();
vi.mock('../../context/PortalSidebarContext', () => ({ usePortalSidebar: () => ({ view: null, params: null, open: mockOpenSidebar, toggle: vi.fn(), close: vi.fn() }) }));
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}</output>; }
const mount = () => render(<MemoryRouter initialEntries={['/my-calls']}><PortalLine /><Where /></MemoryRouter>);

describe('the line', () => {
  beforeEach(() => { mockSave.mockClear(); mockDial.mockClear(); mockOpenSidebar.mockClear(); });

  it('is a combobox whose rows appear on focus and close on Escape', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    expect(line).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(line);
    expect(line).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: /Calls/ })).toBeInTheDocument();
    fireEvent.keyDown(line, { key: 'Escape' });
    expect(line).toHaveAttribute('aria-expanded', 'false');
  });

  it('goes where Enter says, moving with the arrow keys', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.keyDown(line, { key: 'ArrowDown' }); // Calls -> Live
    fireEvent.keyDown(line, { key: 'Enter' });
    expect(screen.getByTestId('where')).toHaveTextContent('/live');
  });

  it('calls a typed number in the phone panel, without leaving the screen', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: '0501234567' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Call 0501234567/ }));
    expect(mockDial).toHaveBeenCalledWith('0501234567');
    expect(mockOpenSidebar).toHaveBeenCalledWith('phone', { tab: 'dialpad' });
    expect(screen.getByTestId('where')).toHaveTextContent('/my-calls');
  });

  it('opens the phone in the sidebar from its row', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.mouseDown(screen.getByRole('option', { name: /Phone/ }));
    expect(mockOpenSidebar).toHaveBeenCalledWith('phone', { tab: 'dialpad' });
  });

  // The assistant is the line now: ask, and the answer lands where the rows
  // were, without navigating and without a chat window.
  it('asks the question typed into it and shows the answer in place', async () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: 'how many calls today' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /^Ask:/ }));
    expect(mockAsk).toHaveBeenCalledWith('tok', 'how many calls today');
    expect(await screen.findByText('You had 7 calls today.')).toBeInTheDocument();
    // The rows stay: the answer is a result, not a page.
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('drops a stale answer as soon as the question changes', async () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: 'how many calls today' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /^Ask:/ }));
    await screen.findByText('You had 7 calls today.');
    fireEvent.change(line, { target: { value: 'devices' } });
    expect(screen.queryByText('You had 7 calls today.')).toBeNull();
  });

  it('searches calls for typed text, keeping the text intact', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: '050%123' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Search calls for/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/my-calls?q=050%25123');
  });

  it('flips a setting from a row', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: 'compact' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Compact rows/ }));
    expect(mockSave).toHaveBeenCalledWith({ calls_density: 'compact' });
  });

  it('always has somewhere to go with text typed: ask it, or search the calls', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: 'zzzz' } });
    // Text that matches no place and no setting still has two answers: ask
    // about it, or search the calls for it.
    expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Ask: “zzzz”About today’s call count, abandoned or recent calls, devices, and logs', 'Search calls for “zzzz”']);
    fireEvent.keyDown(line, { key: 'ArrowDown' }); // onto the search row
    fireEvent.keyDown(line, { key: 'Enter' });
    expect(screen.getByTestId('where')).toHaveTextContent('/my-calls?q=zzzz');
  });
});
