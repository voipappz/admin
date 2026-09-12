#!/usr/bin/env node
/**
 * Phase 2: Create the new category/section structure in Zendesk
 * Outputs a manifest JSON with all created IDs for use by article creation scripts.
 */

const fs = require('fs');
const zd = require('./zendesk-api.cjs');

// New structure definition
const STRUCTURE = [
  {
    name: 'Getting Started',
    description: 'New to Voipappz? Start here.',
    position: 1,
    sections: [
      { name: 'What is Voipappz?', description: 'Platform overview and capabilities' },
      { name: 'Your Account', description: 'Account setup and navigation' },
      { name: 'Key Concepts', description: 'Core concepts: DIDs, Extensions, Bridges, Environments' },
      { name: 'Glossary', description: 'A-Z reference of VoIP and platform terms' },
    ],
  },
  {
    name: 'Admin Portal & Account Management',
    description: 'Manage your Voipappz portal settings, users, and access.',
    position: 2,
    sections: [
      { name: 'Portal Overview', description: 'Admin panel walkthrough and navigation' },
      { name: 'Users & Permissions', description: 'User management, ACLs, and roles' },
      { name: 'Environments', description: 'Multi-tenant environment management' },
      { name: 'Account Settings', description: 'Customer profile and preferences' },
    ],
  },
  {
    name: 'Number Management (DIDs)',
    description: 'Search, order, configure, and route your phone numbers.',
    position: 3,
    sections: [
      { name: 'Phone Numbers Overview', description: 'DID types, screen walkthrough, searching' },
      { name: 'Ordering & Setup', description: 'Creating, editing, and managing DIDs' },
      { name: 'Bridge Routing', description: 'How bridges route calls to destinations' },
      { name: 'Number Features', description: 'Caller ID, forwarding, voicemail' },
    ],
  },
  {
    name: 'Call Routing & IVR',
    description: 'Design call flows with IVR menus, queues, conditions, and announcements.',
    position: 4,
    sections: [
      { name: 'IVR (Interactive Voice Response)', description: 'Voice menus and DTMF routing' },
      { name: 'Queues & Call Distribution', description: 'Call queues, agents, and strategies' },
      { name: 'Call Conditions & Segments', description: 'Time-based and caller-based routing' },
      { name: 'Announcements', description: 'Audio files and TTS messages' },
    ],
  },
  {
    name: 'Extensions & Devices',
    description: 'Set up phones, softphones, and extensions for your team.',
    position: 5,
    sections: [
      { name: 'Extensions', description: 'Extension setup, groups, and user assignment' },
      { name: 'Desk Phones', description: 'Yealink and hardware phone setup' },
      { name: 'Softphones', description: 'ZoiPer, MicroSIP, Grandstream Wave, WebRTC' },
    ],
  },
  {
    name: 'Voice AI & Automation',
    description: 'Build AI voice agents, automate with scripts and workflows.',
    position: 6,
    sections: [
      { name: 'Bots (Voice AI Agents)', description: 'AI-powered voice agents and Flow Builder' },
      { name: 'VML Scripts', description: 'Voice Markup Language scripting' },
      { name: 'Workflows', description: 'Process automation and workflow builder' },
      { name: 'Triggers & Webhooks', description: 'Event-driven automation' },
    ],
  },
  {
    name: 'Monitoring & Reporting',
    description: 'Track calls, monitor performance, and generate reports.',
    position: 7,
    sections: [
      { name: 'Dashboard', description: 'KPIs, widgets, and overview' },
      { name: 'Live Monitoring', description: 'Real-time call monitoring and actions' },
      { name: 'Call Logs & CDR', description: 'Call history and detail records' },
      { name: 'Reports', description: 'Report generation and export' },
      { name: 'System Health', description: 'Health monitoring and logs' },
    ],
  },
  {
    name: 'Billing & Pricing',
    description: 'Manage subscriptions, tariffs, and account billing.',
    position: 8,
    sections: [
      { name: 'Subscriptions', description: 'Subscription plans and management' },
      { name: 'Tariffs & Rating', description: 'Rate configuration and LCR' },
      { name: 'Wallets', description: 'Balance management and top-up' },
      { name: 'Providers & Routes', description: 'Provider and route configuration' },
    ],
  },
  {
    name: 'End User Portal',
    description: 'Guide for agents and operators using the Voipappz portal.',
    position: 9,
    // Reuse existing section — articles already live here
    reuseSectionId: 360005744920, // Portal Use
    sections: [],
  },
  {
    name: 'How-To Guides & Scenarios',
    description: 'Step-by-step workflows for common tasks.',
    position: 10,
    sections: [
      { name: 'Setup Scenarios', description: 'End-to-end setup workflows' },
      { name: 'Integrations', description: 'Third-party integrations and plugins' },
      { name: 'Troubleshooting', description: 'Common issues and solutions' },
    ],
  },
  {
    name: 'Voipappz - Internal',
    description: 'Internal operations documentation (not customer-facing).',
    position: 11,
    reuseId: 4417971856018, // Existing "Voipappz - Internal" category
    sections: [],
  },
];

// Existing categories to rename/reposition (or keep)
const KEEP_CATEGORIES = {
  4417971856018: true, // Voipappz - Internal
};

// Existing categories to delete after moving content
const DELETE_AFTER_MOVE = [
  // 200615052,      // General — will delete after moving Configuration articles
  // 360001266771,   // Modules — will delete after moving articles
  // 9559320293394,  // Dashboard — will delete after moving Intro articles
];

async function run() {
  console.log('=== Phase 2: Create Structure ===\n');

  const manifest = { categories: {}, sections: {} };

  // Get existing categories for reference
  const existingCats = await zd.listCategories();
  console.log(`Found ${existingCats.length} existing categories\n`);

  for (const catDef of STRUCTURE) {
    let catId;

    if (catDef.reuseId) {
      // Reuse existing category
      catId = catDef.reuseId;
      await zd.updateCategory(catId, {
        name: catDef.name,
        description: catDef.description,
        position: catDef.position,
      });
      console.log(`  Reused category: ${catDef.name} (${catId})`);
    } else {
      // Check if category already exists (by name)
      const existing = existingCats.find(c => c.name === catDef.name);
      if (existing) {
        catId = existing.id;
        await zd.updateCategory(catId, {
          description: catDef.description,
          position: catDef.position,
        });
        console.log(`  Updated existing category: ${catDef.name} (${catId})`);
      } else {
        const cat = await zd.createCategory(catDef.name, catDef.description, catDef.position);
        catId = cat.id;
      }
    }

    manifest.categories[catDef.name] = catId;

    // Handle sections that should be moved to this category
    if (catDef.reuseSectionId) {
      // Move existing section to this category
      await zd.updateSection(catDef.reuseSectionId, { category_id: catId });
      console.log(`  Moved section ${catDef.reuseSectionId} to category ${catDef.name}`);
      manifest.sections['Portal Use'] = catDef.reuseSectionId;
    }

    // Create new sections
    for (let i = 0; i < catDef.sections.length; i++) {
      const secDef = catDef.sections[i];
      // Check if section already exists in this category
      const existingSections = await zd.listSections(catId);
      const existingSec = existingSections.find(s => s.name === secDef.name);

      if (existingSec) {
        manifest.sections[secDef.name] = existingSec.id;
        console.log(`  Section exists: ${secDef.name} (${existingSec.id})`);
      } else {
        const sec = await zd.createSection(catId, secDef.name, secDef.description, i + 1);
        manifest.sections[secDef.name] = sec.id;
      }
    }

    console.log('');
  }

  // Save manifest
  const manifestPath = __dirname + '/manifest.json';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest saved to ${manifestPath}`);
  console.log('\n=== Phase 2 Complete ===');
}

run().catch(e => { console.error(e); process.exit(1); });
