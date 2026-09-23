#!/usr/bin/env node
// Rewrites the CSV views from UAT.md, so the sheet has one source of truth.
// The two files drifting is worse than having only one: a tester filling in the
// spreadsheet would be running a different set of checks from the one under review.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, 'UAT.md'), 'utf8');

const HEADERS = ['Block', 'ID', 'What we are testing', 'Before you start', 'What to do',
  'What you should see', 'Priority', 'Tester', 'Date', 'Result', 'Notes'];

const rows = [];
let block = '';
for (const line of md.split('\n')) {
  const heading = line.match(/^## (.+)$/);
  if (heading) { block = heading[1].trim(); continue; }
  if (!/^\|\s*T-\d+\s*\|/.test(line)) continue;
  const cells = line.slice(1, line.lastIndexOf('|')).split('|').map((c) => c.trim());
  // <br> is how the markdown table holds a numbered list; a spreadsheet wants newlines.
  rows.push([block, ...cells].map((c) => c.replace(/<br>/g, '\n')));
}

const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
const writeCsv = (name, selectedRows) => {
  const csv = [HEADERS, ...selectedRows]
    .map((row) => row.map(quote).join(','))
    .join('\n') + '\n';
  writeFileSync(join(here, name), csv);
  console.log(`${name}: ${selectedRows.length} rows`);
};

const priorityAt = HEADERS.indexOf('Priority');
writeCsv('uat.csv', rows);
writeCsv('uat-release.csv', rows.filter((row) =>
  ['CRITICAL', 'HIGH'].includes(row[priorityAt])));
writeCsv('uat-smoke.csv', rows.filter((row) =>
  row[priorityAt] === 'CRITICAL'));
