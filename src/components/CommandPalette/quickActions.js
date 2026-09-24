import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CallIcon from '@mui/icons-material/Call';
import DialpadIcon from '@mui/icons-material/Dialpad';
import { looksLikeNumber } from '../Portal/usePortalCommands';
import { ASSISTANT_CAN_ANSWER } from '../../services/portalAssistant';

/**
 * The palette's quick actions — the portal line's rows (PortalLine), in the
 * account console's ⌘K: ask a question, call a number, open the phone.
 *
 * Pure, so what shows for a given query is a unit test. `keepOpen` rows leave
 * the palette open: Ask's answer appears in it, in place.
 *
 * @param {object} p
 * @param {string} p.query
 * @param {object} p.on  { ask(text), call(number), openPhone() }
 */
export function buildQuickActions({ query = '', on }) {
  const q = query.trim();
  const rows = [];

  // Anything typed can be a QUESTION, and it is the one row that reads the
  // words rather than matching them, so it comes first. No LLM runs: see
  // services/portalAssistant.
  if (q) {
    rows.push({
      id: 'quick-ask', label: `Ask: “${q}”`, description: `About ${ASSISTANT_CAN_ANSWER}`,
      iconComponent: AutoAwesomeIcon, keepOpen: true, action: () => on.ask(q),
    });
  }
  if (q && looksLikeNumber(q)) {
    rows.push({
      id: 'quick-call', label: `Call ${q}`, description: 'Opens the phone with the number',
      iconComponent: CallIcon, action: () => on.call(q),
    });
  }
  if (!q || 'open phone'.includes(q.toLowerCase())) {
    rows.push({
      id: 'quick-phone', label: 'Open phone', description: 'The softphone, on the right',
      iconComponent: DialpadIcon, action: () => on.openPhone(),
    });
  }
  return rows;
}
