// Saving an export response, kept out of the component so it can be tested.
//
// The rule that matters: never hand a protected URL to the browser to navigate
// to. `a.href = url; a.click()` sends no Authorization header, so an API that
// requires one answers 401 and the user sees nothing. Fetch with credentials and
// save the blob instead — or, better, save the body of the request we already
// made, which is what the API returns now.

const dateStamp = () => new Date().toISOString().split('T')[0];

const filenameFrom = (disposition, fallback) => {
  const match = (disposition || '').match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
};

const saveBlob = (blob, filename) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(objectUrl);
};

/**
 * Save an export response as a file.
 * Returns true when the file was saved, false when the caller should fall back
 * to building the CSV client-side.
 */
export async function saveExportResponse(response, { access, fallbackName } = {}) {
  const name = fallbackName || `calls-export-${dateStamp()}.csv`;

  // The API streams the CSV on this same authenticated request: the body IS the
  // file.
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    // Read a CLONE: returning false hands the caller back to its JSON fallback,
    // and a Response body can only be consumed once — reading it here would make
    // that fallback throw "body stream already read".
    const blob = await response.clone().blob();
    if (blob.size === 0) return false;
    saveBlob(blob, filenameFrom(response.headers.get('content-disposition'), name));
    return true;
  }

  // Legacy API: a URL in x-report. Fetch it WITH credentials rather than
  // navigating, and only accept a non-empty body — the old backend wrote 0-byte
  // files and still returned 200.
  const reportUrl = response.headers.get('x-report');
  if (reportUrl) {
    try {
      const reportResponse = await fetch(reportUrl, {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      });
      if (reportResponse.ok) {
        const blob = await reportResponse.blob();
        if (blob.size > 0) {
          saveBlob(blob, name);
          return true;
        }
      }
    } catch {
      // fall through to the client-side CSV
    }
  }

  return false;
}
