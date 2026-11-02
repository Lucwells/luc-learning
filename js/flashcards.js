// Flashcards: short term/definition cards, separate from the textbooks. Reads data/flashcards.json.
// Nothing is saved between visits: no scores, streaks or progress.

import { $app, ui, nav, esc, shuffle, layout } from './util.js';

let cache = null;
const load = () => (cache ??= fetch('data/flashcards.json').then((r) => {
  if (!r.ok) throw new Error(`flashcards.json: ${r.status}`);
  return r.json();
}));

// Escape, then turn `backticks` into <code>.
const text = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const code = (c) => (c.code ? `<pre class="fc-code">${esc(c.code)}</pre>` : '');
const count = (cat) => cat.groups.reduce((n, g) => n + g.cards.length, 0);

function deckList(d) {
  $app.innerHTML = `
    <nav class="crumbs"><a href="#/">Library</a> › <span>${esc(d.title)}</span></nav>
    <header class="shelf-head"><h1>${esc(d.title)}</h1><p class="muted">${esc(d.dek)}</p></header>
    <div class="shelf">${d.categories.map((c) => `
      <a class="book" href="#/flashcards/${esc(c.id)}" style="--book:${esc(c.color)}">
        <div class="book-cover"><span class="book-kicker">Flashcards</span><h2>${esc(c.title)}</h2><p>${esc(c.blurb)}</p></div>
        <span class="book-meta">${count(c)} cards · ${c.groups.length} groups</span>
      </a>`).join('')}</div>`;
}

function study(d, cat) {
  const all = cat.groups.flatMap((g) => g.cards.map((c) => ({ ...c, group: g.title, gid: g.id })));
  const st = { group: 'all', shuffled: false, defFirst: false, list: false, i: 0, flipped: false, deck: all };

  const rebuild = () => {
    const pool = st.group === 'all' ? all : all.filter((c) => c.gid === st.group);
    st.deck = st.shuffled ? shuffle(pool) : pool;
    st.i = 0;
    st.flipped = false;
  };

  const face = (c, back) => {
    const showTerm = back === st.defFirst; // back side shows the opposite of the front
    return showTerm
      ? `<div class="fc-term">${text(c.term)}</div>`
      : `<div class="fc-def">${text(c.def)}</div>${code(c)}`;
  };

  const render = () => {
    ui.stopKeys();
    const header = `
      <nav class="crumbs"><a href="#/">Library</a> › <a href="#/flashcards">${esc(d.title)}</a> › <span>${esc(cat.title)}</span></nav>
      <header class="shelf-head" style="--book:${esc(cat.color)}"><h1>${esc(cat.title)} flashcards</h1><p class="muted">${esc(cat.blurb)}</p></header>
      <div class="row fc-controls">
        <select id="fc-group" aria-label="Group">
          <option value="all">All groups (${all.length})</option>
          ${cat.groups.map((g) => `<option value="${esc(g.id)}"${st.group === g.id ? ' selected' : ''}>${esc(g.title)} (${g.cards.length})</option>`).join('')}
        </select>
        <button id="fc-mode">${st.list ? 'Study cards' : 'View as list'}</button>
        ${st.list ? '' : `<button id="fc-shuffle" class="${st.shuffled ? 'primary' : ''}">Shuffle</button>
        <button id="fc-side">${st.defFirst ? 'Definition first' : 'Term first'}</button>`}
      </div>`;

    if (st.list) {
      $app.innerHTML = header + `<dl class="fc-list">${st.deck.map((c) => `
        <dt>${text(c.term)} <span class="muted">${esc(c.group)}</span></dt>
        <dd>${text(c.def)}${code(c)}</dd>`).join('')}</dl>`;
    } else {
      const c = st.deck[st.i];
      $app.innerHTML = header + `
        <div class="fc-meta muted">${st.i + 1} / ${st.deck.length} · ${esc(c.group)}</div>
        <button class="fc-card${st.flipped ? ' flipped' : ''}" id="fc-card" aria-live="polite">
          <span class="fc-side muted">${st.flipped ? (st.defFirst ? 'Term' : 'Definition') : (st.defFirst ? 'Definition' : 'Term')}</span>
          ${face(c, st.flipped)}
        </button>
        <div class="row">
          <button id="fc-prev"${st.i === 0 ? ' disabled' : ''}>← Back</button>
          <button class="primary" id="fc-flip">Flip</button>
          <button id="fc-next"${st.i === st.deck.length - 1 ? ' disabled' : ''}>Next →</button>
        </div>
        <p class="muted fc-hint"><kbd>Space</kbd> flip · <kbd>←</kbd> <kbd>→</kbd> move</p>`;
    }
    wire();
  };

  const go = (delta) => {
    const n = st.i + delta;
    if (n < 0 || n >= st.deck.length) return;
    st.i = n;
    st.flipped = false;
    render();
  };
  const flip = () => { st.flipped = !st.flipped; render(); };

  function wire() {
    const q = (s) => $app.querySelector(s);
    q('#fc-group').onchange = (e) => { st.group = e.target.value; rebuild(); render(); };
    q('#fc-mode').onclick = () => { st.list = !st.list; render(); };
    if (st.list) return;
    q('#fc-shuffle').onclick = () => { st.shuffled = !st.shuffled; rebuild(); render(); };
    q('#fc-side').onclick = () => { st.defFirst = !st.defFirst; st.flipped = false; render(); };
    q('#fc-card').onclick = flip;
    q('#fc-flip').onclick = flip;
    q('#fc-prev').onclick = () => go(-1);
    q('#fc-next').onclick = () => go(1);
    const onKey = (e) => {
      if (e.target.matches?.('input, select, textarea')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); flip(); }
    };
    window.addEventListener('keydown', onKey);
    ui.stopKeys = () => { window.removeEventListener('keydown', onKey); ui.stopKeys = () => {}; };
  }

  render();
}

export async function viewFlashcards(catId) {
  layout('page');
  nav.here = null;
  document.title = 'Flashcards · Luc Learning';
  $app.innerHTML = '<p class="muted">Loading…</p>';
  let d;
  try { d = await load(); } catch (e) { $app.innerHTML = `<p class="muted">Could not load flashcards. ${esc(e.message)}</p>`; return; }
  if (!catId) return deckList(d);
  const cat = d.categories.find((c) => c.id === catId);
  if (!cat) { $app.innerHTML = '<p class="muted">No such flashcard category. <a href="#/flashcards">Back to flashcards</a></p>'; return; }
  document.title = `${cat.title} flashcards · Luc Learning`;
  study(d, cat);
}
