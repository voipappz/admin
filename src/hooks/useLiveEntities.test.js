import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * The cable consumer, driven by frames rather than a socket.
 *
 * useWebSocket is mocked so these assert what this hook is actually
 * responsible for: turning a stream of whole-document frames into a stable set
 * of rows. The socket itself (connect, welcome, subscribe, reconnect) is the
 * existing hook's job and is unchanged by this work.
 *
 * The behaviours pinned here are the ones that decide whether a dashboard is
 * correct or merely plausible: a document REPLACES its entity rather than
 * merging into it, a deletion removes the row, and renders are coalesced so a
 * busy environment cannot melt the tab.
 */

let mockState = { data: null, connectionStatus: 'Disconnected', error: null };
const useWebSocketSpy = vi.fn(() => mockState);

vi.mock('./useWebSocket', () => ({
  useWebSocket: (...args) => useWebSocketSpy(...args),
}));

vi.mock('../config.js', () => ({
  config: { ws: { cable: 'ws://node.test:4000/cable' } },
}));

const { default: useLiveEntities } = await import('./useLiveEntities');

const frame = (scope, id, doc, extra = {}) => ({ scope, id, revision: 1, deleted: false, doc, ...extra });

/**
 * Push one frame. Each gets its own act() so the effect actually runs —
 * batching several into one act() means the hook only ever sees the last,
 * which is a property of React, not of the cable.
 */
function push(rerender, f, props) {
  mockState = { ...mockState, data: f };
  act(() => {
    if (props === undefined) rerender();
    else rerender(props);
  });
}

/** Push a frame and let the coalescing window elapse. */
function deliver(rerender, f, props) {
  push(rerender, f, props);
  act(() => { vi.advanceTimersByTime(300); });
}

describe('useLiveEntities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('auth', JSON.stringify({ access: 'admin-token' }));
    mockState = { data: null, connectionStatus: 'Connected', error: null };
    useWebSocketSpy.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('subscribes to LiveChannel for the given environment', () => {
    renderHook(() => useLiveEntities('env-1'));

    const [url, , opts] = useWebSocketSpy.mock.calls.at(-1);
    expect(url).toContain('ws://node.test:4000/cable');
    expect(url).toContain('token=admin-token');
    expect(opts.identifier).toEqual({ channel: 'LiveChannel', environment_uuid: 'env-1' });
    // LiveChannel streams on subscribe; the DashboardLive `login` handshake
    // would just be an unhandled frame.
    expect(opts.loginAction).toBe(false);
  });

  it('narrows to a scope when one is given', () => {
    renderHook(() => useLiveEntities('env-1', 'user'));
    const [, , opts] = useWebSocketSpy.mock.calls.at(-1);
    expect(opts.identifier.scope).toBe('user');
  });

  it('does not subscribe without an environment', () => {
    renderHook(() => useLiveEntities(null));
    const [, , opts] = useWebSocketSpy.mock.calls.at(-1);
    expect(opts.identifier).toBeNull();
  });

  it('sends the portal token when there is no admin session', () => {
    localStorage.clear();
    localStorage.setItem('user_auth', JSON.stringify({ token: 'portal-token' }));
    renderHook(() => useLiveEntities('env-1'));
    expect(useWebSocketSpy.mock.calls.at(-1)[0]).toContain('token=portal-token');
  });

  it('builds rows from the frames it receives', () => {
    const { result, rerender } = renderHook(() => useLiveEntities('env-1'));

    deliver(rerender, frame('user', 'u1', { user_name: 'Noam', answer_counter: 2 }));

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toMatchObject({ scope: 'user', id: 'u1', user_name: 'Noam' });
  });

  it('REPLACES an entity rather than merging into it', () => {
    // Each frame is a whole document. Merging would leave a field alive after
    // the node cleared it — talking_to_number after a hangup, say.
    const { result, rerender } = renderHook(() => useLiveEntities('env-1'));

    deliver(rerender, frame('user', 'u1', { state: 'answer', talking_to_number: '0501112222' }));
    deliver(rerender, frame('user', 'u1', { state: 'waiting' }));

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].state).toBe('waiting');
    expect(result.current.rows[0].talking_to_number).toBeUndefined();
  });

  it('removes a row on a deletion frame', () => {
    // Whole-document replacement updates rows but never removes one that is
    // gone, so a deleted key has to arrive as an explicit removal.
    const { result, rerender } = renderHook(() => useLiveEntities('env-1'));

    deliver(rerender, frame('user', 'u1', { state: 'answer' }));
    expect(result.current.rows).toHaveLength(1);

    deliver(rerender, { scope: 'user', id: 'u1', deleted: true, doc: {} });
    expect(result.current.rows).toHaveLength(0);
  });

  it('keeps entities of different scopes apart', () => {
    const { result, rerender } = renderHook(() => useLiveEntities('env-1'));

    deliver(rerender, frame('user', 'x', { user_name: 'Noam' }));
    deliver(rerender, frame('queue', 'x', { call_count: 4 }));

    // Same id, different entities — keying on id alone would collapse them.
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.byScope('user')).toHaveLength(1);
    expect(result.current.byScope('queue')[0].call_count).toBe(4);
  });

  it('coalesces a burst into one render', () => {
    const { result, rerender } = renderHook(() => useLiveEntities('env-1'));

    for (let i = 0; i < 20; i++) push(rerender, frame('user', `u${i}`, { n: i }));

    // Nothing painted yet — the window has not elapsed.
    expect(result.current.rows).toHaveLength(0);

    // One timer fires for the whole burst, not twenty.
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.rows).toHaveLength(20);
  });

  it('drops everything when the environment changes', () => {
    // A different environment is a different dataset, not more of the same one.
    const { result, rerender } = renderHook(({ env }) => useLiveEntities(env), {
      initialProps: { env: 'env-1' },
    });

    deliver(rerender, frame('user', 'u1', { user_name: 'Noam' }), { env: 'env-1' });
    expect(result.current.rows).toHaveLength(1);

    act(() => { rerender({ env: 'env-2' }); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.rows).toHaveLength(0);
  });

  it('reports a rejected subscription distinctly from a dropped connection', () => {
    // Rejected means the token carries no tenant, or the environment is not
    // this session's — reconnecting would be refused again.
    mockState = { data: null, connectionStatus: 'Rejected', error: 'Subscription rejected' };
    const { result } = renderHook(() => useLiveEntities('env-1'));

    expect(result.current.rejected).toBe(true);
    expect(result.current.connected).toBe(false);
  });

  it('ignores a malformed frame instead of throwing', () => {
    const { result, rerender } = renderHook(() => useLiveEntities('env-1'));

    deliver(rerender, { scope: 'user' }); // no id
    expect(result.current.rows).toHaveLength(0);
  });
});
