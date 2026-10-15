// Sanity-check every book and chapter listed in data/manifest.json. Run: npm run validate
import { readFile } from 'node:fs/promises';

let errors = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); errors++; };
const readJSON = async (path) => JSON.parse(await readFile(`data/${path}`, 'utf8'));

const BLOCKS = ['h', 'eq', 'list', 'facts', 'eqs', 'def', 'table', 'svg', 'example', 'key', 'warn', 'tip', 'note'];

function checkBlocks(blocks, where) {
  for (const b of [].concat(blocks ?? [])) {
    if (typeof b === 'string') continue;
    const kind = BLOCKS.find((k) => b[k] != null);
    if (!kind) { fail(`${where}: unknown block ${JSON.stringify(b).slice(0, 60)}`); continue; }
    if (kind === 'table') {
      const n = (b.table.head ?? b.table.rows[0]).length;
      b.table.rows.forEach((r, i) => { if (r.length !== n) fail(`${where}: table row ${i} has ${r.length} cells, expected ${n}`); });
    }
    if (kind === 'svg' && /<script|onload=|onclick=/i.test(b.svg)) fail(`${where}: svg must not contain scripts or handlers`);
    if (kind === 'example') {
      if (!b.example.problem || !b.example.solution) fail(`${where}: example needs problem and solution`);
      checkBlocks(b.example.problem, where);
      checkBlocks(b.example.solution, where);
    }
  }
}

function checkQuestions(list, where) {
  for (const q of list ?? []) {
    if (!q.q || !q.a) { fail(`${where}: question needs q and a`); continue; }
    if (q.wrong) {
      if (q.wrong.length < 3) fail(`${where}: "${q.q.slice(0, 40)}" needs 3+ wrong answers`);
      if (q.wrong.includes(q.a)) fail(`${where}: right answer also listed as wrong: ${q.a}`);
    }
  }
}

function checkSections(sections, ids, where) {
  for (const s of sections) {
    if (!s.id || !s.title) { fail(`${where}: section needs id and title`); continue; }
    if (ids.has(s.id)) fail(`${where}: duplicate section id "${s.id}"`);
    ids.add(s.id);
    if (!s.body && !s.subs) fail(`${where}: section "${s.id}" has neither body nor subs`);
    checkBlocks(s.body, `${where}/${s.id}`);
    checkQuestions(s.check, `${where}/${s.id}`);
    if (s.subs) checkSections(s.subs, ids, where);
  }
}

function checkChapter(d, where) {
  if (!d.title) fail('missing "title"');
  if (!d.id) fail('missing "id"');

  if (d.view === 'articles') {
    if (!Array.isArray(d.entries) || !d.entries.length) return fail('"entries" must be a non-empty array');
    const ids = new Set();
    d.entries.forEach((e, i) => {
      if (!e.id || !e.name || !e.tagline || !Array.isArray(e.sections)) fail(`entry ${i} needs id, name, tagline and sections`);
      if (ids.has(e.id)) fail(`duplicate entry id "${e.id}"`);
      ids.add(e.id);
      checkQuestions(e.quiz, `entry "${e.id}"`);
    });
    return undefined;
  }

  if (d.view === 'chapter') {
    if (!Array.isArray(d.sections) || !d.sections.length) return fail('"sections" must be a non-empty array');
    checkSections(d.sections, new Set(), where);
    d.problems?.forEach((p, i) => { if (!p.q || !p.a) fail(`problem ${i + 1} needs q and a`); else checkBlocks(p.q, `problem ${i + 1}`); checkBlocks(p.solution, `problem ${i + 1}`); });
    return undefined;
  }

  if (d.view === 'reaction-types') { if (!Array.isArray(d.types) || !d.types.length) return fail('"types" must be a non-empty array'); }

  // Item decks: periodic table, reaction types, world map.
  if (!Array.isArray(d.items) || !d.items.length) return fail('"items" must be a non-empty array');
  const modes = d.modes ?? [{ id: 'qa', question: '{q}', answer: 'a' }];
  const ids = new Set();
  for (const m of modes) {
    if (!m.id || (!m.label && d.modes)) fail(`mode needs "id" and "label": ${JSON.stringify(m)}`);
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
  return undefined;
}

const manifest = await readJSON('manifest.json');
const termOwners = new Map(); // term -> first section that claims it
const notes = [];

for (const bookPath of manifest.books) {
  console.log(bookPath);
  let book;
  try { book = await readJSON(bookPath); } catch (e) { fail(`invalid JSON: ${e.message}`); continue; }
  if (!book.id || !book.title) fail('book needs id and title');
  const files = [...(book.front ?? []), ...(book.parts ?? []).flatMap((p) => { if (!p.title || !p.chapters?.length) fail(`part "${p.title}" needs a title and chapters`); return p.chapters ?? []; })];
  const chapterIds = new Set();
  for (const file of files) {
    console.log(`  ${file}`);
    let d;
    try { d = await readJSON(`${file}.json`); } catch (e) { fail(`${file}: ${e.message}`); continue; }
    const before = errors;
    checkChapter(d, file);
    if (errors > before) console.error(`    (in ${file})`);
    if (d.id && chapterIds.has(d.id)) fail(`${file}: duplicate chapter id "${d.id}" in book "${book.id}"`);
    chapterIds.add(d.id);

    const claim = (s) => {
      for (const t of [s.title, ...(s.terms ?? [])]) {
        const k = String(t).toLowerCase();
        if (termOwners.has(k) && termOwners.get(k) !== `${d.id}/${s.id}`) notes.push(`"${t}": ${termOwners.get(k)} (used) vs ${d.id}/${s.id}`);
        else termOwners.set(k, `${d.id}/${s.id}`);
      }
      (s.subs ?? []).forEach(claim);
    };
    (d.sections ?? []).forEach(claim);
  }
}

if (notes.length) {
  console.log('\nTerms claimed by more than one section (the first one is linked):');
  notes.forEach((n) => console.log(`  - ${n}`));
}
if (errors) { console.error(`\n${errors} problem(s).`); process.exit(1); }
console.log('\nAll books OK.');
