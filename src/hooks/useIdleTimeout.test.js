import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useIdleTimeout, { idleState, WARNING_MS } from './useIdleTimeout';

const MIN = 60 * 1000;

describe('idleState', () => {
  it('is disabled when the timeout is 0 (VITE_IDLE_TIMEOUT_MINUTES=0)', () => {
    expect(idleState(999 * MIN, 0)).toBe('disabled');
  });

  it('is active well before the timeout', () => {
    expect(idleState(5 * MIN, 30 * MIN)).toBe('active');
  });

  it('warns inside the final minute', () => {
    expect(idleState(30 * MIN - WARNING_MS, 30 * MIN)).toBe('warning');
    expect(idleState(30 * MIN - 1, 30 * MIN)).toBe('warning');
  });

  it('times out at/after the limit', () => {
    expect(idleState(30 * MIN, 30 * MIN)).toBe('timeout');
    expect(idleState(31 * MIN, 30 * MIN)).toBe('timeout');
  });
});

describe('useIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onTimeout once after the configured idle period (default 30 min)', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ enabled: true, onTimeout }));

    act(() => { vi.advanceTimersByTime(31 * MIN); });
    expect(onTimeout).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(10 * MIN); });
    expect(onTimeout).toHaveBeenCalledTimes(1); // does not re-fire
  });

  it('exposes the warning in the final minute and clears it on activity', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout({ enabled: true, onTimeout }));

    act(() => { vi.advanceTimersByTime(29 * MIN + 30 * 1000); });
    expect(result.current.warningOpen).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();

    // User clicks "Stay signed in" → warning clears and the clock resets.
    act(() => { result.current.staySignedIn(); });
    expect(result.current.warningOpen).toBe(false);

    act(() => { vi.advanceTimersByTime(5 * MIN); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('user activity (e.g. keydown) resets the idle clock', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ enabled: true, onTimeout }));

    act(() => { vi.advanceTimersByTime(20 * MIN); });
    act(() => { window.dispatchEvent(new Event('keydown')); });
    act(() => { vi.advanceTimersByTime(20 * MIN); });
    // 40 min total but only ~20 min since last activity → still signed in
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ enabled: false, onTimeout }));
    act(() => { vi.advanceTimersByTime(120 * MIN); });
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
