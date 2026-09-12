#!/usr/bin/env node
/**
 * Phase 1: Cleanup — delete boilerplate, empty sections, duplicates, archive old screen articles
 */

const zd = require('./zendesk-api.cjs');

// Boilerplate articles to DELETE (Zendesk default content)
const BOILERPLATE_IDS = [
  203854472, // Help, I have a question and I need an answer
  203854462, // How do I publish my content in other languages?
  203854452, // How do I customize my Help Center?
  203854442, // What are these sections and articles doing here?
  203854432, // Your community is ready for users
  203854422, // Welcome to your Help Center!
  115003211485, // Change Agent Settings [DRAFT]
  207857875, // How to search recording [DRAFT]
];

// Duplicate article to DELETE
const DUPLICATE_IDS = [
  4416413625362, // Portal Dashboard [DRAFT] — duplicate of 4418810091282
];

// Old "- Screen" articles to ARCHIVE (set to draft)
const SCREEN_ARTICLE_IDS = [
  360021437679, // Users - Screen
  360020450999, // DIDs - Screen
  360020404380, // Environment - Screen
  360020415260, // Extensions - Screen
  360020542819, // Extension Groups - Screen
  360020507420, // Announcements - Screen
  360020455019, // Voicemails - Screen
  360020543779, // Queues - Screens
  360020415800, // IVR - Screen
  360020713219, // Call Conditions - Screen
  360021328580, // Blacklist - Screen
  360021227540, // Widgets - Screen
  360021229260, // Webhooks - Screen
  360021022959, // ACLs - Screen
  360020856840, // Templates - Screen
  360020745619, // Facsimiles - Screen
  360020683960, // Time Group - Screen [DRAFT]
  360021252719, // Logs - Screen
  360021357180, // Reports - Screen
  360020738811, // הסבר לתפריטים — tour [DRAFT]
  360021517300, // Statuses - Screen
  8780320876178, // Live - Screen
  360020628100, // Articles Table of Content, Status and Links
];

// Empty sections to DELETE
const EMPTY_SECTION_IDS = [
  360005782739, // Dialer (End User Portal — empty)
  201721879, // Pre-Install (General — empty)
  201721869, // Installaion (General — empty)
  360005521620, // Salesforce (Installation — empty)
];

// Empty category to DELETE
const EMPTY_CATEGORY_IDS = [
  360003083879, // Installation
];

async function run() {
  console.log('=== Phase 1: Cleanup ===\n');

  // 1. Delete boilerplate articles
  console.log('1. Deleting boilerplate articles...');
  for (const id of BOILERPLATE_IDS) {
    try {
      await zd.deleteArticle(id);
    } catch (e) {
      console.log(`  Skip ${id}: ${e.message}`);
    }
  }

  // 2. Delete duplicate articles
  console.log('\n2. Deleting duplicate articles...');
  for (const id of DUPLICATE_IDS) {
    try {
      await zd.deleteArticle(id);
    } catch (e) {
      console.log(`  Skip ${id}: ${e.message}`);
    }
  }

  // 3. Archive old screen articles (set to draft)
  console.log('\n3. Archiving old screen articles to draft...');
  for (const id of SCREEN_ARTICLE_IDS) {
    try {
      await zd.updateArticle(id, { draft: true });
      console.log(`  Archived to draft: ${id}`);
    } catch (e) {
      console.log(`  Skip ${id}: ${e.message}`);
    }
  }

  // 4. Delete empty sections
  console.log('\n4. Deleting empty sections...');
  for (const id of EMPTY_SECTION_IDS) {
    try {
      await zd.deleteSection(id);
    } catch (e) {
      console.log(`  Skip section ${id}: ${e.message}`);
    }
  }

  // 5. Delete empty categories
  console.log('\n5. Deleting empty categories...');
  for (const id of EMPTY_CATEGORY_IDS) {
    try {
      await zd.deleteCategory(id);
    } catch (e) {
      console.log(`  Skip category ${id}: ${e.message}`);
    }
  }

  console.log('\n=== Phase 1 Complete ===');
}

run().catch(e => { console.error(e); process.exit(1); });
