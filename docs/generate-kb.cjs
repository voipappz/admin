#!/usr/bin/env node
/**
 * Generate KB.md — a local copy of the full Zendesk Help Center structure
 */
const zd = require('./zendesk-api.cjs');
const fs = require('fs');

async function run() {
  const cats = await zd.listCategories();
  const sections = await zd.listSections();
  const allArticles = await zd.listAllArticles();

  cats.sort((a, b) => a.position - b.position);

  const published = allArticles.filter(a => a.draft === false);
  const drafts = allArticles.filter(a => a.draft === true);

  let md = '# Voipappz Help Center — Knowledge Base\n\n';
  md += '> Live: https://voipappz.zendesk.com/hc/en-us\n\n';
  md += '> Generated: ' + new Date().toISOString().slice(0, 10) + '\n\n';
  md += '---\n\n';

  md += '## Stats\n\n';
  md += '| Metric | Count |\n|--------|-------|\n';
  md += '| Categories | ' + cats.length + ' |\n';
  md += '| Sections | ' + sections.length + ' |\n';
  md += '| Published Articles | ' + published.length + ' |\n';
  md += '| Draft Articles | ' + drafts.length + ' |\n';
  md += '| Total Articles | ' + allArticles.length + ' |\n\n';
  md += '---\n\n';

  for (const cat of cats) {
    md += '## ' + cat.name + '\n';
    if (cat.description) md += '> ' + cat.description + '\n';
    md += '\n';

    const catSections = sections
      .filter(s => s.category_id === cat.id)
      .sort((a, b) => a.position - b.position);

    for (const sec of catSections) {
      md += '### ' + sec.name + '\n\n';

      const secArticles = allArticles
        .filter(a => a.section_id === sec.id)
        .sort((a, b) => a.position - b.position);

      if (secArticles.length === 0) {
        md += '_(empty)_\n\n';
      } else {
        for (const art of secArticles) {
          const draft = art.draft ? ' **[DRAFT]**' : '';
          const url = art.html_url || '';
          md += '- [' + art.title + '](' + url + ')' + draft + ' (ID: ' + art.id + ')\n';
        }
        md += '\n';
      }
    }
  }

  fs.writeFileSync(__dirname + '/KB.md', md);
  console.log('KB.md written (' + md.length + ' chars, ' + allArticles.length + ' articles)');
}

run().catch(e => { console.error(e); process.exit(1); });
