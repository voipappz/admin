#!/usr/bin/env node
/**
 * Phase 2b: Move existing articles to new sections
 * Requires manifest.json from Phase 2.
 */

const fs = require('fs');
const path = require('path');
const zd = require('./zendesk-api.cjs');

// Articles to move: { articleId, targetSection (name from manifest) }
const MOVES = [
  // Dashboard > Intro articles → Admin Portal > Portal Overview
  { id: 15202338215826, title: 'Dashboard and KPIs in the system', target: 'Dashboard' },

  // Existing scenario articles → How-To Guides sections
  { id: 360020179359, title: 'Read First - Administrator guide', target: 'Setup Scenarios' },
  { id: 360020399420, title: 'Automatic Call Distribution - Flow', target: 'Setup Scenarios' },
  { id: 360020438019, title: 'Setting Service Times - Flow', target: 'Setup Scenarios' },
  { id: 360020416859, title: 'Admin Accounts - Flow', target: 'Setup Scenarios' },
  { id: 360020390060, title: 'Configure IVR - Flow', target: 'Setup Scenarios' },
  { id: 360021381259, title: 'Dashboard and Reports - Flow', target: 'Setup Scenarios' },
  { id: 360021420279, title: 'Calls and Logs - Flow', target: 'Setup Scenarios' },
  { id: 360020658479, title: 'Softphone Manual Installation - Flow', target: 'Setup Scenarios' },
  { id: 360021026139, title: 'Adding Voicemail to Extension - Flow', target: 'Setup Scenarios' },
  { id: 8769187404178, title: 'Automation Setup - Flow', target: 'Setup Scenarios' },
  { id: 4402498140946, title: 'SPY Function - flow', target: 'Setup Scenarios' },
  { id: 17815961972882, title: 'Send Email Based on Triggers', target: 'Setup Scenarios' },

  // Integration articles → Integrations
  { id: 360020403140, title: 'Click2Call - Installation Guide', target: 'Integrations' },
  { id: 19570759822226, title: 'Add powerlink integration for FusionPBX', target: 'Integrations' },

  // Troubleshooting
  { id: 12543081294354, title: "Why can't I make/receive calls?", target: 'Troubleshooting' },
  { id: 15684179438482, title: 'Escalation matrix - Jitter Calls', target: 'Troubleshooting' },

  // Device articles → new device sections
  { id: 360021516540, title: 'Setup YEALINK phone manually', target: 'Desk Phones' },
  { id: 360021516580, title: 'הגדרת ידניות לטלפון Yealink (עברית)', target: 'Desk Phones' },
  { id: 360021622620, title: 'Setup ZoiPer Softphone', target: 'Softphones' },
  { id: 360021595639, title: 'Setup microSIP phone', target: 'Softphones' },
  { id: 9559273973010, title: 'Grandstream Wave (Mobile app)', target: 'Softphones' },
  { id: 360021634319, title: 'Portal Dialer (built-in WebRTC)', target: 'Softphones' },

  // Existing module articles → correct new sections
  { id: 9658733372946, title: 'Triggers', target: 'Triggers & Webhooks' },
  { id: 9644941653138, title: 'Skills', target: 'Queues & Call Distribution' },
  { id: 23060249460370, title: 'Spy and Barge', target: 'Live Monitoring' },
  { id: 9550210098450, title: 'Account', target: 'Account Settings' },
  { id: 9035353224722, title: 'Routes', target: 'Providers & Routes' },
  { id: 18888027613202, title: 'Subscriptions', target: 'Subscriptions' },
  { id: 23625336812178, title: 'Wallets', target: 'Wallets' },
  { id: 360020537840, title: 'Tariffs', target: 'Tariffs & Rating' },
  { id: 24092553904274, title: 'Set Provider Strategy LCR', target: 'Providers & Routes' },
  { id: 18545612702866, title: 'Logs - Calls', target: 'Call Logs & CDR' },
  { id: 22568978028818, title: 'Reports', target: 'Reports' },

  // Internal articles stay
  { id: 17732910398226, title: 'Server Reboot', target: 'Development' },
  { id: 4537221789074, title: 'Checklist for new employee', target: 'Development' },
  { id: 4417973569938, title: 'Server Monitoring', target: 'Development' },

  // New customer flow
  { id: 17732619179282, title: 'Add New Customer Flow', target: 'Setup Scenarios' },
];

async function run() {
  console.log('=== Phase 2b: Move Existing Articles ===\n');

  const manifestPath = path.join(__dirname, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest.json not found. Run phase2-structure.js first.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let moved = 0;
  let skipped = 0;

  for (const move of MOVES) {
    const sectionId = manifest.sections[move.target];
    if (!sectionId) {
      console.log(`  SKIP: Section not found: "${move.target}" (for article ${move.title})`);
      skipped++;
      continue;
    }

    try {
      await zd.moveArticle(move.id, sectionId);
      console.log(`  Moved: ${move.title} → ${move.target}`);
      moved++;
    } catch (e) {
      console.log(`  FAIL: ${move.title}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n=== Moved: ${moved}, Skipped: ${skipped} ===`);
}

run().catch(e => { console.error(e); process.exit(1); });
