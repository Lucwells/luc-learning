// Loads books and chapters from data/ and normalises them into one shape.
// Old-style "articles" and "reaction-types" decks are converted here so they read like chapters.

import { slug } from './util.js';

export const lib = {
  books: [],
  bookById: new Map(),
  chapters: [], // every chapter in every book
};

const getJSON = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export async function loadData() {
  const manifest = await getJSON('data/manifest.json');
  const books = await Promise.all(manifest.books.map(async (path) => {
    const b = await getJSON(`data/${path}`);
    const load = async (file) => normalizeChapter(await getJSON(`data/${file}.json`), file);
    b.front = await Promise.all((b.front ?? []).map(load));
    b.parts = await Promise.all((b.parts ?? []).map(async (p, i) => ({
      ...p, roman: ROMAN[i], chapters: await Promise.all(p.chapters.map(load)),
    })));
    return b;
  }));

  lib.books = books;
  lib.bookById = new Map(books.map((b) => [b.id, b]));
  lib.chapters = [];

  for (const b of books) {
    let n = 0;
    b.chapters = [];
    b.front.forEach((ch) => { ch.book = b; ch.part = null; ch.label = 'Reference'; b.chapters.push(ch); });
    for (const p of b.parts) {
      for (const ch of p.chapters) {
        ch.book = b; ch.part = p; ch.number = ++n; ch.label = `Chapter ${n}`;
        b.chapters.push(ch);
      }
    }
    b.chapters.forEach((ch, i) => {
      ch.prev = b.chapters[i - 1] ?? null;
      ch.next = b.chapters[i + 1] ?? null;
      finalizeChapter(ch);
    });
    lib.chapters.push(...b.chapters);
  }
}

export const chapterHref = (ch) => `#/${ch.book.id}/${ch.id}`;
export const bookHref = (b) => `#/${b.id}`;

/* ---------- normalising ---------- */

function normalizeChapter(raw, file) {
  let ch = raw;
  if (raw.view === 'articles') ch = fromArticles(raw);
  else if (raw.view === 'reaction-types') ch = fromReactions(raw);
  ch.file = file;
  ch.id ??= file.split('/').pop();
  ch.view = ch.view === 'periodic-table' || ch.view === 'world-map' ? ch.view : 'chapter';
  ch.sections ??= [];
  ch.overview = [].concat(ch.overview ?? []);
  ch.objectives ??= [];
  ch.summary = [].concat(ch.summary ?? []);
  ch.problems ??= [];
  return ch;
}

const walk = (list, fn, depth = 0) => list.forEach((s) => { fn(s, depth); walk(s.subs ?? [], fn, depth + 1); });

// Numbers, keys and links for every section, plus the quiz cards for the chapter.
function finalizeChapter(ch) {
  const base = `${ch.book.id}/${ch.id}`;
  const label = (i) => (ch.number ? `${ch.number}.${i}` : `${i}`);
  ch.sections.forEach((s, i) => {
    s.num = label(i + 1);
    (s.subs ?? []).forEach((t, j) => { t.num = `${s.num}.${j + 1}`; });
  });
  walk(ch.sections, (s) => { s.key = `${base}/${s.id}`; s.href = `#/${base}/${s.id}`; s.chapter = ch; });

  let cards = ch.items && ch.modes ? buildCards(ch) : [];
  if (ch.dedupe) cards = cards.filter(ch.dedupe);
  if (ch.view === 'chapter') {
    const asCard = (q, item, i, tag, label) => ({
      key: `${base}#${tag}#${i}`, deck: ch, item,
      mode: q.wrong?.length >= 3 ? { id: 'check', label, mcOnly: true } : { id: 'check', label, grade: 'self' },
      q: q.q, a: q.a, alts: q.alts ?? [], wrong: q.wrong,
    });
    walk(ch.sections, (s) => (s.check ?? []).forEach((q, i) => cards.push(asCard(q, s, i, s.id, `${s.num} ${s.title}`))));
    ch.problems.forEach((p, i) => { if (typeof p.q === 'string') cards.push(asCard(p, ch, i, 'problem', 'Problems')); });
  }
  ch.cards = cards;
}

export function buildCards(d) {
  const cards = [];
  d.items.forEach((item, i) => {
    const id = item[d.idField ?? 'id'] ?? i;
    for (const mode of d.modes) {
      const a = item[mode.answer];
      if (a == null || a === '') continue;
      cards.push({
        key: `${d.id}#${id}#${mode.id}`,
        deck: d, item, mode,
        q: mode.question.replace(/\{(\w+)\}/g, (_, k) => item[k] ?? ''),
        a: String(a),
        alts: (item.alts?.[mode.answer] ?? []).map(String),
      });
    }
  });
  return cards;
}

/* ---------- converters for the older deck formats ---------- */

function fromArticles(d) {
  const blocks = (secs) => secs.flatMap((s) => [
    s.h && { h: s.h },
    ...(s.equations ?? []).map((eq) => ({ eq })),
    s.text,
    s.facts && { facts: s.facts },
    s.points && { list: s.points },
  ].filter(Boolean));
  const entry = (e) => ({
    id: e.id, title: e.name, lead: e.tagline, terms: [e.name, ...(e.terms ?? [])],
    body: blocks(e.sections), check: e.quiz ?? [],
  });
  const groups = [...new Set(d.entries.map((e) => e.group).filter(Boolean))];
  const sections = groups.length > 1
    ? groups.map((g) => ({ id: `g-${slug(g)}`, title: g, terms: [], body: [], subs: d.entries.filter((e) => e.group === g).map(entry) }))
    : d.entries.map(entry);
  const { entries, ...rest } = d;
  return { ...rest, sections };
}

function fromReactions(d) {
  const sections = d.types.map((t) => {
    const examples = d.items.filter((it) => it.type === t.name);
    return {
      id: t.id, title: t.name,
      terms: [t.name, ...(t.aka ?? '').split(',').map((x) => x.trim()).filter(Boolean)],
      body: [
        { eq: t.form },
        t.summary,
        { h: 'How to recognize it' }, { list: t.recognize },
        ...(examples.length ? [{ h: 'Examples' }, { eqs: examples.map((e) => [e.equation, e.note ?? '']) }] : []),
        { h: 'In the real world' }, { list: t.realWorld },
      ],
    };
  });
  // The pattern question is the same for every example of a type, so ask it once per type.
  const seen = new Set();
  const items = d.items;
  const { types, ...rest } = d;
  return { ...rest, sections, items, dedupe: (c) => c.mode.id !== 'form-type' || (!seen.has(c.item.type) && seen.add(c.item.type)) };
}
