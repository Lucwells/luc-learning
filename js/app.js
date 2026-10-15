// Luc Learning: a library of textbooks. Static site, no build step.
// Books and chapters live in data/ (see README.md for the formats).

import { $app, ui, nav, navigate } from './util.js';
import { lib, loadData } from './data.js';
import { buildTerms } from './terms.js';
import { viewShelf, viewBook, viewChapter, viewQuiz, notFound } from './reader.js';
import { viewPeriodicTable } from './periodic.js';
import { viewWorldMap } from './worldmap.js';
import { initSearch } from './search.js';

let shownHash = null;
let shownChapter = null; // "book/chapter" while a reading chapter is on screen, so section links only scroll

function route(restoreY) {
  ui.stopKeys();
  ui.stopModal();
  shownHash = location.hash;
  const seg = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent).filter(Boolean);
  const scrollTop = () => window.scrollTo(0, restoreY ?? 0);
  const here = shownChapter;
  shownChapter = null;
  document.title = 'Luc Learning';

  if (!seg.length) { scrollTop(); return viewShelf(); }
  if (seg[0] === 'quiz') { scrollTop(); return viewQuiz(seg[1], seg[2]); }

  const book = lib.bookById.get(seg[0]);
  if (!book) { scrollTop(); return notFound(); }
  document.title = `${book.title} · Luc Learning`;
  if (!seg[1]) { scrollTop(); return viewBook(book); }

  const ch = book.chapters.find((c) => c.id === seg[1]);
  if (!ch) { scrollTop(); return notFound(); }
  document.title = `${ch.title} · ${book.title}`;

  switch (ch.view) {
    case 'periodic-table':
      if (!seg[2]) scrollTop();
      return viewPeriodicTable(ch, null, seg[2]);
    case 'world-map':
      scrollTop();
      return viewWorldMap(ch, null);
    default: {
      const key = `${book.id}/${ch.id}`;
      shownChapter = key;
      if (here === key) { // same chapter: just move within it
        const el = seg[2] && $app.querySelector(`#s-${CSS.escape(seg[2])}`);
        if (el && restoreY == null) { el.scrollIntoView(); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } else scrollTop();
        return undefined;
      }
      return viewChapter(ch, seg[2], restoreY);
    }
  }
}

nav.route = () => route();

// In-app links: push history ourselves so Back restores the scroll position.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[href^="#/"]');
  if (!a) return;
  e.preventDefault();
  const from = a.classList.contains('term') ? { label: nav.here ?? 'where you were' } : null;
  navigate(a.getAttribute('href'), { from, replace: a.hasAttribute('data-replace') });
});

window.addEventListener('popstate', (e) => {
  nav.memo.set(nav.idx, window.scrollY);
  nav.idx = e.state?.i ?? 0;
  nav.from = null;
  route(nav.memo.get(nav.idx));
});

window.addEventListener('hashchange', () => { if (location.hash !== shownHash) { nav.from = null; route(); } });

history.scrollRestoration = 'manual';
history.replaceState({ i: 0 }, '');

loadData().then(() => {
  buildTerms();
  initSearch();
  route();
}).catch((err) => {
  $app.innerHTML = `<p class="bad">Could not load data: ${err.message}</p>
    <p class="muted">Serve this folder over HTTP (<code>npm start</code>) instead of opening the file directly.</p>`;
});
