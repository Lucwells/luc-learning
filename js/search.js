// Search box in the top bar: finds sections (by title, terms and text) and elements of the periodic table.

import { esc, norm, navigate } from './util.js';
import { lib } from './data.js';

let index = null;

const strip = (s) => s.replace(/\*\*|\/\/|[\^_]\{|\}/g, '');

function textOf(x, out = []) {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach((y) => textOf(y, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (k !== 'svg') textOf(v, out);
  return out;
}

function build() {
  index = [];
  const visit = (ch, list) => list.forEach((s) => {
    const raw = strip(textOf([s.lead, s.body]).join(' '));
    index.push({
      href: s.href, title: s.title, where: `${ch.book.title} › ${ch.title}`,
      terms: norm([s.title, ...(s.terms ?? [])].join(' ')), t: norm(s.title), text: norm(raw), raw,
    });
    visit(ch, s.subs ?? []);
  });
  for (const ch of lib.chapters) {
    visit(ch, ch.sections);
    index.push({ href: `#/${ch.book.id}/${ch.id}`, title: ch.title, where: ch.book.title, terms: norm(ch.title), t: norm(ch.title), text: norm(ch.description ?? ''), raw: ch.description ?? '' });
    if (ch.view === 'periodic-table') {
      for (const el of ch.items) {
        index.push({
          href: `#/${ch.book.id}/${ch.id}/${el.symbol}`, title: `${el.name} (${el.symbol})`, where: `${ch.book.title} › ${ch.title}`,
          terms: norm(`${el.name} ${el.symbol}`), t: norm(`${el.name} ${el.symbol}`), text: norm(el.category), raw: `${el.category}, atomic number ${el.number}`,
        });
      }
    }
  }
}

function search(q) {
  index ?? build();
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length || norm(q).length < 2) return [];
  return index.map((e) => {
    let score = 0;
    for (const t of toks) {
      const p = ` ${t}`; // match at the start of a word, so "iron" does not hit "environmental"
      const inText = ` ${e.text}`.split(p).length - 1;
      if (e.t === t) score += 30;
      else if (` ${e.t}`.includes(p)) score += 12;
      else if (` ${e.terms}`.includes(p)) score += 7;
      else if (inText) score += Math.min(inText, 5);
      else return null; // every word must match somewhere
    }
    return { e, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);
}

function snippet(e, q) {
  const w = norm(q).split(' ')[0];
  const i = e.raw.toLowerCase().indexOf(w);
  if (i < 0) return e.raw.slice(0, 90);
  const from = Math.max(0, i - 35);
  return `${from ? '…' : ''}${e.raw.slice(from, from + 100)}…`;
}

export function initSearch() {
  const box = document.getElementById('search');
  const out = document.getElementById('search-results');
  if (!box || !out) return;
  let hits = [];
  let sel = 0;

  const paint = () => {
    if (!hits.length) { out.hidden = !box.value.trim() || norm(box.value).length < 2; out.innerHTML = out.hidden ? '' : '<div class="none">No matches.</div>'; return; }
    out.hidden = false;
    out.innerHTML = hits.map((h, i) => `<a href="${h.e.href}" class="${i === sel ? 'sel' : ''}"><b>${esc(h.e.title)}</b><small>${esc(h.e.where)}</small><span>${esc(snippet(h.e, box.value))}</span></a>`).join('');
  };
  const close = () => { out.hidden = true; };

  box.addEventListener('input', () => { hits = search(box.value); sel = 0; paint(); });
  box.addEventListener('focus', () => { if (box.value) { hits = search(box.value); paint(); } });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, hits.length - 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); paint(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[sel]) { navigate(hits[sel].e.href); box.value = ''; close(); box.blur(); }
    else if (e.key === 'Escape') { box.value = ''; close(); box.blur(); }
  });
  out.addEventListener('click', (e) => { if (e.target.closest('a')) { box.value = ''; close(); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); box.focus(); }
  });
}
