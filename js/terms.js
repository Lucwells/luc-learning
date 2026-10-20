// Inline text formatting and automatic cross-references.
//
// Markup inside strings:  **bold**   //italic//   x^{2}   x_{i}
// Every section title and every entry in a section's "terms" list becomes a link wherever
// that word appears in other text. The first mention in each top-level section is linked.
// A term links to the current book's section when it has one. Otherwise it links into a book named in the current
// book's "links" list (book.json), first match wins. Books without "links" stay self-contained.

import { esc } from './util.js';
import { lib } from './data.js';

let termMap = new Map();
let termRe = null;

export function buildTerms() {
  termMap = new Map();
  const add = (term, s) => {
    const t = esc(String(term).trim()).toLowerCase();
    if (!t) return;
    if (!termMap.has(t)) termMap.set(t, []);
    termMap.get(t).push({ key: s.key, href: s.href, title: s.title, chapter: s.chapter });
  };
  const visit = (list) => list.forEach((s) => {
    [s.title, ...(s.terms ?? [])].forEach((t) => add(t, s));
    visit(s.subs ?? []);
  });
  for (const ch of lib.chapters) visit(ch.sections);

  const alts = [...termMap.keys()].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  termRe = alts.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
}

// Escape text and apply the markup above. No links.
export function fmt(text, { sup = false } = {}) {
  let html = esc(text);
  if (sup) html = html.replace(/(\d)([spdf])(\d+)/g, '$1$2<sup>$3</sup>'); // electron configurations: 3d5
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\/\/(.+?)\/\//g, '<em>$1</em>')
    .replace(/\^\{(.+?)\}/g, '<sup>$1</sup>')
    .replace(/_\{(.+?)\}/g, '<sub>$1</sub>')
    .replace(/([\p{L})\]̂])_([\p{L}\p{N}])(?![\p{L}\p{N}_])/gu, '$1<sub>$2</sub>'); // x_i, h_θ: a single character after _
}

// fmt() plus term links. Each target is linked once per `seen` set and never links to itself.
export function inline(text, { self, book = self?.split('/')[0], seen = new Set(), sup = false } = {}) {
  const html = fmt(text, { sup });
  if (!termRe) return html;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) return part;
    return part.replace(termRe, (m) => {
      const options = termMap.get(m.toLowerCase());
      const home = lib.bookById.get(book);
      const t = options?.find((o) => o.chapter.book.id === book)
        ?? (home?.links ?? []).map((id) => options?.find((o) => o.chapter.book.id === id)).find(Boolean);
      if (!t || t.key === self || seen.has(t.key)) return m;
      seen.add(t.key);
      return `<a class="term" href="${t.href}" title="${esc(`${t.chapter.title}: ${t.title}`)}">${m}</a>`;
    });
  }).join('');
}

export const rich = inline;
