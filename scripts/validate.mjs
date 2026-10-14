// Sanity-check every deck listed in data/manifest.json. Run: npm run validate
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('data/manifest.json', 'utf8'));
let errors = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); errors++; };

for (const path of manifest.decks) {
  console.log(path);
  let d;
  try { d = JSON.parse(await readFile(`data/${path}`, 'utf8')); } catch (e) { fail(`invalid JSON: ${e.message}`); continue; }

  if (!d.title) fail('missing "title"');
  if (!Array.isArray(d.category) || !d.category.length) fail('"category" must be a non-empty array');
  if (d.view === 'articles') {
    if (!Array.isArray(d.entries) || !d.entries.length) { fail('"entries" must be a non-empty array'); continue; }
    const ids = new Set();
    d.entries.forEach((e, i) => {
      if (!e.id || !e.name || !e.tagline || !Array.isArray(e.sections)) fail(`entry ${i} needs id, name, tagline and sections`);
      if (ids.has(e.id)) fail(`duplicate entry id "${e.id}"`);
      ids.add(e.id);
      for (const q of e.quiz ?? []) {
        if (!q.q || !q.a || !Array.isArray(q.wrong) || q.wrong.length < 3) fail(`entry "${e.id}": quiz question needs q, a and 3+ wrong answers`);
        else if (q.wrong.includes(q.a)) fail(`entry "${e.id}": the right answer is also listed as wrong: ${q.a}`);
      }
    });
    continue;
  }
  if (!Array.isArray(d.items) || !d.items.length) { fail('"items" must be a non-empty array'); continue; }

  const modes = d.modes ?? [{ id: 'qa', question: '{q}', answer: 'a' }];
  const ids = new Set();
  for (const m of modes) {
    if (!m.id || !m.label && d.modes) fail(`mode needs "id" and "label": ${JSON.stringify(m)}`);
    if (ids.has(m.id)) fail(`duplicate mode id "${m.id}"`);
    ids.add(m.id);
    for (const k of (m.question ?? '').matchAll(/\{(\w+)\}/g)) {
      d.items.forEach((it, i) => { if (it[k[1]] == null) fail(`item ${i} lacks "${k[1]}" used by mode "${m.id}"`); });
    }
    d.items.forEach((it, i) => { if (it[m.answer] == null) fail(`item ${i} lacks answer field "${m.answer}" for mode "${m.id}"`); });
  }

  const idField = d.idField ?? 'id';
  const seen = new Set();
  d.items.forEach((it, i) => {
    const id = it[idField] ?? i;
    if (seen.has(id)) fail(`duplicate ${idField} "${id}"`);
    seen.add(id);
  });
}

if (errors) { console.error(`\n${errors} problem(s).`); process.exit(1); }
console.log('\nAll decks OK.');
