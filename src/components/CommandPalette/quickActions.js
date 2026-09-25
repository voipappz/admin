import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CallIcon from '@mui/icons-material/Call';
import DialpadIcon from '@mui/icons-material/Dialpad';
import { ASSISTANT_CAN_ANSWER } from '../../services/mcpAssistant';

// Kept with the command palette now that its portal predecessor is gone.
const NUMBER_SHAPE = /^\+?(\(\d{1,4}\)|\d{1,4})([ .-]?(\(\d{1,4}\)|\d{1,4}))*$/;
const DATE_SHAPE = /^\d{4}([-./])\d{1,2}\1\d{1,2}$/;
const looksLikeNumber = (text) => {
  const value = text.trim();
  if (!NUMBER_SHAPE.test(value) || DATE_SHAPE.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 3 && digits.length <= 16;
};

/**
 * The palette's quick actions: ask a question, call a number, open the phone.
 *
 * Pure, so what shows for a given query is a unit test. `keepOpen` rows leave
 * the palette open: Ask's answer appears in it, in place.
 *
 * @param {object} p
 * @param {string} p.query
 * @param {object} p.on  { ask(text), call(number), openPhone() }
 */
export function buildQuickActions({ query = '', on, phoneEnabled = true }) {
  const q = query.trim();
  const rows = [];

  // Anything typed can be a QUESTION, and it is the one row that reads the
  // words rather than matching them, so it comes first. No LLM runs: see
  // services/mcpAssistant.
  if (q) {
    rows.push({
      id: 'quick-ask', label: `Ask: “${q}”`, description: `About ${ASSISTANT_CAN_ANSWER}`,
      iconComponent: AutoAwesomeIcon, keepOpen: true, action: () => on.ask(q),
    });
  }
  if (phoneEnabled && q && looksLikeNumber(q)) {
    rows.push({
      id: 'quick-call', label: `Call ${q}`, description: 'Opens the phone with the number',
      iconComponent: CallIcon, action: () => on.call(q),
    });
  }
  if (phoneEnabled && (!q || 'open phone'.includes(q.toLowerCase()))) {
    rows.push({
      id: 'quick-phone', label: 'Open phone', description: 'The softphone, on the right',
      iconComponent: DialpadIcon, action: () => on.openPhone(),
    });
  }
  return rows;
}
