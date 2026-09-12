// transfer.js — the pure half of the softphone's PBX transfer feature.
//
// A SIP transfer is a REFER sent inside the established dialog (RFC 3515). The
// 202 Accepted only says the far end took the request; whether the transfer
// actually WORKED arrives later, as a NOTIFY carrying a message/sipfrag body
// ("SIP/2.0 200 OK"). Both halves are needed before the UI may claim anything,
// so the outcome lives in a reducer here rather than in ad-hoc setState calls —
// same reasoning as reduceCallState in useSipPhone.js: SIP callbacks arrive late
// and out of order, and the widget must never show a state the dialog isn't in.
//
// Nothing in this file touches sip.js or the DOM, so it is unit-testable.
//
// TransferInfo shape: { kind: 'blind'|'attended', target, phase:
// 'consulting'|'referring'|'completed'|'failed', code?, reason? }
// TransferEvent shape: one of
//   { type: 'consult', target } | { type: 'refer', kind, target } |
//   { type: 'progress', code } | { type: 'completed' } |
//   { type: 'failed', reason } | { type: 'clear' } | { type: 'cancel' }

const isTerminal = (info) => info.phase === 'completed' || info.phase === 'failed';

export function reduceTransferState(current, event) {
  if (event.type === 'cancel') return null;
  if (event.type === 'consult') {
    // A consultation may only start when nothing is pending.
    if (current && !isTerminal(current)) return current;
    return { kind: 'attended', target: event.target, phase: 'consulting' };
  }
  if (event.type === 'refer') {
    // Refuse a second REFER while one is unresolved — the dialog can only hold one.
    if (current && current.phase === 'referring') return current;
    return { kind: event.kind, target: event.target, phase: 'referring' };
  }
  if (!current) return null;
  if (event.type === 'clear') return isTerminal(current) ? null : current;
  // Outcomes are only meaningful for a REFER we actually sent.
  if (event.type === 'progress') return current.phase === 'referring' ? { ...current, code: event.code } : current;
  if (event.type === 'completed') return current.phase === 'referring' ? { ...current, phase: 'completed' } : current;
  if (event.type === 'failed') {
    if (isTerminal(current)) return current;
    return { ...current, phase: 'failed', reason: event.reason };
  }
  return current;
}

/**
 * Build the SIP address for a dial or transfer target.
 *
 * Accepts what a user actually types: an extension ("204"), a formatted number
 * ("03-555 1234"), a full AOR ("204@pbx.example"), or a ready-made URI
 * ("sip:204@pbx.example"). Returns null when there is nothing dialable —
 * callers turn that into an error rather than handing UserAgent.makeURI a
 * string it will silently reject.
 */
export function sipTargetAddress(target, domain) {
  const raw = String(target ?? '').trim();
  if (!raw) return null;
  // Already a URI: pass through untouched apart from stray whitespace.
  if (/^sips?:/i.test(raw)) return raw.replace(/\s+/g, '');
  const at = raw.indexOf('@');
  // Spaces, dashes and brackets are dial-pad decoration, not part of the SIP
  // user part — a URI containing them is invalid and makeURI returns undefined.
  const user = (at >= 0 ? raw.slice(0, at) : raw).replace(/[\s()\-–—]/g, '');
  const host = (at >= 0 ? raw.slice(at + 1) : domain).trim();
  if (!user || !host) return null;
  return `sip:${user}@${host}`;
}

// message/sipfrag bodies start with a status line; anything after it (headers)
// is optional and ignored. Matched multiline so a leading CRLF doesn't defeat it.
const SIPFRAG_STATUS = /^\s*SIP\/2\.0\s+(\d{3})[ \t]*(.*)$/m;

/**
 * Parse the message/sipfrag body of a REFER NOTIFY into a transfer outcome:
 * { code: number|null, reason: string, final: boolean, success: boolean }.
 */
export function parseReferNotify(body) {
  const match = body ? SIPFRAG_STATUS.exec(body) : null;
  if (!match) return { code: null, reason: '', final: false, success: false };
  const code = Number(match[1]);
  return {
    code,
    reason: match[2].trim(),
    final: code >= 200,
    success: code >= 200 && code < 300
  };
}
