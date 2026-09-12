#!/usr/bin/env node
/**
 * Phase 3+: Create all articles in Zendesk
 * Reads article definitions from articles/*.js and creates them in the correct sections.
 * Uses manifest.json (from Phase 2) for section IDs.
 */

const fs = require('fs');
const path = require('path');
const zd = require('./zendesk-api.cjs');

// Article source files in order
const ARTICLE_FILES = [
  'getting-started',
  'admin-portal',
  'number-management',
  'call-routing',
  'extensions-devices',
  'voice-ai',
  'monitoring',
  'billing',
  'how-to-guides',
];

async function run() {
  console.log('=== Phase 3+: Create Articles ===\n');

  // Load manifest
  const manifestPath = path.join(__dirname, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest.json not found. Run phase2-structure.js first.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Loaded manifest with ${Object.keys(manifest.sections).length} sections\n`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // Track created articles for link resolution later
  const createdArticles = [];

  for (const file of ARTICLE_FILES) {
    const filePath = path.join(__dirname, 'articles', `${file}.cjs`);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${file}.js (not found)`);
      continue;
    }

    const articles = require(filePath);
    console.log(`--- ${file} (${articles.length} articles) ---`);

    for (const article of articles) {
      const sectionId = manifest.sections[article.section];
      if (!sectionId) {
        console.log(`  SKIP: Section not found: "${article.section}"`);
        totalSkipped++;
        continue;
      }

      try {
        const created = await zd.createArticle(
          sectionId,
          article.title,
          article.body.trim(),
          article.draft || false
        );
        createdArticles.push({
          id: created.id,
          title: article.title,
          section: article.section,
          html_url: created.html_url,
        });
        totalCreated++;
      } catch (e) {
        console.log(`  FAIL: ${article.title}: ${e.message}`);
        totalFailed++;
      }
    }
    console.log('');
  }

  // Save created articles manifest
  const articlesManifest = path.join(__dirname, 'articles-manifest.json');
  fs.writeFileSync(articlesManifest, JSON.stringify(createdArticles, null, 2));

  console.log('=== Summary ===');
  console.log(`  Created: ${totalCreated}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Failed:  ${totalFailed}`);
  console.log(`\nArticles manifest saved to ${articlesManifest}`);
  console.log('\n=== Phase 3+ Complete ===');
}

run().catch(e => { console.error(e); process.exit(1); });
