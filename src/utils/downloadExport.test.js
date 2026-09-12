import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveExportResponse } from './downloadExport';

// Mimics the one-shot nature of a real Response body: reading it twice throws,
// so a helper that forgets to clone fails here the way it fails in a browser.
const makeResponse = (headers, blob) => {
  let consumed = false;
  const read = () => {
    if (consumed) throw new TypeError('body stream already read');
    consumed = true;
    return Promise.resolve(blob);
  };
  const response = {
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    ok: true,
    blob: vi.fn(read),
    json: vi.fn(() => { read(); return Promise.resolve({}); }),
    clone: () => ({
      headers: response.headers,
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    }),
  };
  return response;
};

let clicked;
let fetchMock;

beforeEach(() => {
  clicked = [];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  window.URL.createObjectURL = vi.fn(() => 'blob:mock');
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    clicked.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('saveExportResponse', () => {
  it('saves a streamed text/csv body and takes the filename from the header', async () => {
    const response = makeResponse(
      { 'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="calls-20260820-110336.csv"' },
      new Blob(['call_uuid\nabc\n']),
    );

    await expect(saveExportResponse(response, {})).resolves.toBe(true);
    expect(clicked[0].download).toBe('calls-20260820-110336.csv');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never navigates to the x-report URL — it fetches it with the token', async () => {
    const response = makeResponse({ 'content-type': 'application/json', 'x-report': 'https://api/tmp/x.csv' }, null);
    fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(['a,b\n1,2\n']) });

    await expect(saveExportResponse(response, { access: 'tok' })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://api/tmp/x.csv',
      { headers: { Authorization: 'Bearer tok' } });
  });

  it('falls back when x-report points at an empty file, as the old backend wrote', async () => {
    const response = makeResponse({ 'content-type': 'application/json', 'x-report': 'https://api/tmp/x.csv' }, null);
    fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob([]) });

    await expect(saveExportResponse(response, { access: 'tok' })).resolves.toBe(false);
    expect(clicked).toHaveLength(0);
  });

  it('falls back when the CSV body is empty, leaving the body readable', async () => {
    const response = makeResponse({ 'content-type': 'text/csv' }, new Blob([]));

    await expect(saveExportResponse(response, {})).resolves.toBe(false);

    // The caller's JSON fallback runs next — it must not hit an already-read body.
    await expect(response.json()).resolves.toBeDefined();
  });

  it('falls back when there is neither a CSV body nor an x-report header', async () => {
    const response = makeResponse({ 'content-type': 'application/json' }, null);

    await expect(saveExportResponse(response, {})).resolves.toBe(false);
  });
});
