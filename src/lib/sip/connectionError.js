// Browsers deliberately hide WHY a WebSocket failed: an untrusted TLS
// certificate, a closed port and a dead host all arrive as the same bare
// `error` event and close code 1006. SIP.js can only log "WebSocket error
// occurred.", so this turns the failure into something a user can act on:
// which server it was, and what to check.
// Returns { message, hint, detail }: `message` is short enough for the phone
// header, `hint` is the next step, `detail` is SIP.js's own error text.
export function describeConnectionFailure(wssUrl, error, pageProtocol = globalThis.location?.protocol) {
  const detail = error instanceof Error ? error.message : (error == null ? '' : String(error));
  let url = null;
  try { url = new URL(wssUrl); } catch { /* reported below */ }

  if (!url || !/^wss?:$/.test(url.protocol)) {
    return {
      message: `Invalid SIP server address: ${wssUrl || '(not set)'}`,
      hint: 'Set a wss:// server address in the phone settings.',
      detail
    };
  }
  if (url.protocol === 'ws:' && pageProtocol === 'https:') {
    return {
      message: `Browser blocked insecure SIP server ${url.host}`,
      hint: `An https page can only open wss:// connections; change ${wssUrl} to wss://.`,
      detail
    };
  }
  return {
    message: `Can't connect to SIP server ${url.host}`,
    hint: url.protocol === 'wss:'
      ? `The browser does not report the cause. Check that the server is up and the port is reachable, then open https://${url.host} in this browser: a certificate warning there means its TLS certificate is not trusted.`
      : 'The browser does not report the cause. Check that the server is up and the port is reachable.',
    detail
  };
}
