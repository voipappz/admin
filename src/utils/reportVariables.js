/**
 * Report query variables.
 *
 * A statement can declare variables in either syntax — Mustache ({{{var}}}) or
 * Blazer ({var}) — because the API accepts both (Report.mustachify rewrites
 * single braces before rendering). The admin must detect both, or a
 * single-brace variable gets no input and silently renders empty.
 */

/** Variables the backend auto-fills — never prompt the user for these. */
export const BUILTIN_VARS = [
  'start_time',
  'end_time',
  'environment_uuids',
  'consumer_uuid',
  'columns',
];

// 1-3 braces: {var}, {{var}} and {{{var}}} all count.
const VAR_PATTERN = /\{{1,3}(\w+)\}{1,3}/g;

/**
 * The custom variables a statement declares, in first-appearance order.
 * @param {string} statement - SQL with variable placeholders
 * @param {string[]} [builtins] - names to treat as auto-filled
 * @returns {string[]} - unique custom variable names
 */
export const detectCustomVariables = (statement, builtins = BUILTIN_VARS) => {
  if (!statement) return [];
  const vars = new Set();
  // exec() advances lastIndex on the shared regex, so use a per-call copy
  const regex = new RegExp(VAR_PATTERN.source, 'g');
  let match;
  while ((match = regex.exec(statement)) !== null) {
    if (!builtins.includes(match[1])) vars.add(match[1]);
  }
  return Array.from(vars);
};
