// Luc Learning: static study app, no build step.
// Data lives in data/**/*.json (see README for the deck format).

const $app = document.getElementById('app');

let decks = [];

/* ---------- helpers ---------- */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Lowercase, strip accents/punctuation, so "Washington, D.C." == "washington dc".
const norm = (s) => String(s)
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[.'’ʻ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\bst\b/g, 'saint')
  .replace(/^the /, '');

function lev(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

function check(card, input) {
  const n = norm(input);
  if (!n) return false;
  return [card.a, ...card.alts].some((ans) => {
    const m = norm(ans);
    return n === m || (m.length >= 7 && lev(n, m) <= 1); // forgive one typo on longer answers
  });
}

/* ---------- data ---------- */

async function loadData() {
  const manifest = await (await fetch('data/manifest.json')).json();
  decks = await Promise.all(manifest.decks.map(async (path) => {
    const d = await (await fetch(`data/${path}`)).json();
    d.id = path.replace(/\.json$/, '');
    d.category = d.category?.length ? d.category : ['Misc'];
    if (d.view === 'articles') { d.items = d.entries; d.modes = []; d.cards = articleCards(d); return d; }
    d.modes = d.modes ?? [{ id: 'qa', label: 'Question → Answer', question: '{q}', answer: 'a', grade: 'self' }];
    d.cards = buildCards(d);
    return d;
  }));
  buildTerms();
}

function buildCards(d) {
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

const pickCards = (cards, n) => shuffle(cards).slice(0, n);

function choices(card) {
  const pool = [...new Set(card.deck.items.map((it) => it[card.mode.answer]).filter((v) => v != null).map(String))];
  const taken = new Set([card.a, ...card.alts].map(norm));
  const wrong = shuffle(pool.filter((v) => !taken.has(norm(v)))).slice(0, 3);
  return wrong.length < 3 ? null : shuffle([card.a, ...wrong]);
}

/* ---------- quiz engine ---------- */

// Cards can show an image in the question (mode.qImage) or use images as the answer choices (mode.aImage).
const qImg = (c) => (c.mode.qImage ? `<img class="flag" src="${esc(c.item[c.mode.qImage])}" alt="">` : '');
const ansHtml = (c) => (c.mode.aImage ? `<img class="flag sm" src="${esc(c.a)}" alt="">` : `<b>${esc(c.a)}</b>`);
const optHtml = (c, o) => (c.mode.aImage ? `<img class="flag" src="${esc(o)}" alt="">` : esc(o));

let stopKeys = () => {};

function runQuiz({ cards, format, onExit }) {
  let i = 0;
  let score = 0;
  const missed = [];

  const show = () => {
    stopKeys();
    if (i >= cards.length) return summary();
    const c = cards[i];
    const self = c.mode.grade === 'self';
    const opts = !self && (format === 'mc' || c.mode.mcOnly) ? (c.wrong ? shuffle([c.a, ...c.wrong]) : choices(c)) : null;
    const typed = !self && !opts;

    $app.innerHTML = `<div class="quiz">
      <div class="meta">${i + 1} / ${cards.length} · ${esc(c.deck.title)} · ${esc(c.mode.label)}</div>
      ${qImg(c)}<h2 class="q">${esc(c.q)}</h2>
      ${opts ? `<div class="opts">${opts.map((o, k) => `<button class="opt" data-v="${esc(o)}"><kbd>${k + 1}</kbd>${optHtml(c, o)}</button>`).join('')}</div>` : ''}
      ${typed ? `<form id="f"><input id="in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer" autofocus><button class="primary">Check</button><button type="button" id="skip">Skip</button></form>` : ''}
      ${self ? '<button class="primary" id="reveal">Show answer</button>' : ''}
      <div id="fb"></div>
    </div>`;

    const fb = $app.querySelector('#fb');
    let answered = false;
    const advance = () => { i++; show(); };

    const finish = (ok, picked) => {
      if (answered) return;
      answered = true;
      if (ok) score++; else missed.push(c);
      $app.querySelectorAll('.opt').forEach((b) => {
        b.disabled = true;
        if (norm(b.dataset.v) === norm(c.a) || c.alts.some((x) => norm(x) === norm(b.dataset.v))) b.classList.add('right');
        else if (b === picked) b.classList.add('wrong');
      });
      $app.querySelector('#in')?.setAttribute('disabled', '');
      fb.innerHTML = `<p class="${ok ? 'good' : 'bad'}">${ok ? 'Correct!' : 'Not quite.'}</p>
        ${ok ? '' : `<p>Answer: ${ansHtml(c)}</p>`}
        <button class="primary" id="next">${i + 1 === cards.length ? 'Finish' : 'Next'}</button>`;
      const next = fb.querySelector('#next');
      next.onclick = advance;
      next.focus();
    };

    $app.querySelectorAll('.opt').forEach((b) => { b.onclick = () => finish(norm(b.dataset.v) === norm(c.a), b); });

    if (typed) {
      $app.querySelector('#f').onsubmit = (e) => {
        e.preventDefault();
        const v = $app.querySelector('#in').value;
        if (v.trim()) finish(check(c, v));
      };
      $app.querySelector('#skip').onclick = () => finish(false);
      $app.querySelector('#in').focus();
    }

    if (self) {
      $app.querySelector('#reveal').onclick = (e) => {
        e.target.remove();
        fb.innerHTML = `<p>Answer: ${ansHtml(c)}</p>
          <div class="row"><button class="primary" id="knew">I knew it</button><button id="missed">Missed it</button></div>`;
        const grade = (ok) => { if (ok) score++; else missed.push(c); advance(); };
        fb.querySelector('#knew').onclick = () => grade(true);
        fb.querySelector('#missed').onclick = () => grade(false);
      };
    }

    if (opts) {
      const onKey = (e) => {
        const b = $app.querySelectorAll('.opt')[Number(e.key) - 1];
        if (b && !answered) b.click();
      };
      window.addEventListener('keydown', onKey);
      stopKeys = () => window.removeEventListener('keydown', onKey);
    }
  };

  const summary = () => {
    const pct = cards.length ? Math.round((score / cards.length) * 100) : 0;
    $app.innerHTML = `<div class="quiz">
      <h2>${score} / ${cards.length} <span class="muted">(${pct}%)</span></h2>
      ${missed.length
        ? `<h3>Review</h3><ul class="review">${missed.map((c) => `<li>${esc(c.q)} ${ansHtml(c)}</li>`).join('')}</ul>`
        : '<p class="good">Perfect run.</p>'}
      <div class="row">
        ${missed.length ? '<button class="primary" id="retry">Retry missed</button>' : ''}
        <button id="done">Done</button>
      </div></div>`;
    $app.querySelector('#retry')?.addEventListener('click', () => runQuiz({ cards: shuffle(missed), format, onExit }));
    $app.querySelector('#done').onclick = onExit;
  };

  show();
}

function runFlashcards({ cards, onExit }) {
  const queue = [...cards];
  const total = queue.length;
  let done = 0;

  const show = () => {
    if (!queue.length) {
      $app.innerHTML = `<div class="quiz"><h2>Round complete</h2><p class="muted">${total} cards.</p><button class="primary" id="done">Done</button></div>`;
      $app.querySelector('#done').onclick = onExit;
      return;
    }
    const c = queue[0];
    $app.innerHTML = `<div class="quiz">
      <div class="meta">${done} / ${total} learned · ${esc(c.deck.title)} · ${esc(c.mode.label)}</div>
      ${qImg(c)}<h2 class="q">${esc(c.q)}</h2>
      <button class="primary" id="reveal">Show answer</button>
      <div id="fb"></div></div>`;
    $app.querySelector('#reveal').onclick = (e) => {
      e.target.remove();
      const fb = $app.querySelector('#fb');
      fb.innerHTML = `<p>Answer: ${ansHtml(c)}</p>
        <div class="row"><button class="primary" id="got">Got it</button><button id="again">Again</button></div>`;
      fb.querySelector('#got').onclick = () => { queue.shift(); done++; show(); };
      fb.querySelector('#again').onclick = () => { queue.push(queue.shift()); show(); };
      fb.querySelector('#got').focus();
    };
    $app.querySelector('#reveal').focus();
  };
  show();
}

/* ---------- views ---------- */

function buildTree() {
  const root = { name: '', path: [], kids: new Map(), decks: [] };
  for (const d of decks) {
    let n = root;
    for (const c of d.category) {
      if (!n.kids.has(c)) n.kids.set(c, { name: c, path: [...n.path, c], kids: new Map(), decks: [] });
      n = n.kids.get(c);
    }
    n.decks.push(d);
  }
  return root;
}

const findNode = (parts) => parts.reduce((n, p) => n?.kids.get(p), buildTree());
const nodeDecks = (n) => [...n.decks, ...[...n.kids.values()].flatMap(nodeDecks)];
const pathHref = (parts) => parts.map(encodeURIComponent).join('/');

const crumbs = (parts, last) => {
  const links = parts.map((p, i) => `<a href="#/c/${pathHref(parts.slice(0, i + 1))}">${esc(p)}</a>`);
  if (buildTree().kids.size !== 1) links.unshift('<a href="#/">Library</a>'); // single root is the home page
  if (last) links.push(`<span>${esc(last)}</span>`);
  return `<nav class="crumbs">${links.join(' › ')}</nav>`;
};

const deckCard = (d) => `<a class="deck" href="#/deck/${d.id}">
  <b>${esc(d.title)}</b><span>${d.items.length} items</span></a>`;

function categoryCard(n) {
  const ds = nodeDecks(n);
  const items = ds.reduce((s, d) => s + d.items.length, 0);
  const subs = n.kids.size ? ` · ${n.kids.size} subtopic${n.kids.size > 1 ? 's' : ''}` : '';
  return `<a class="deck cat-card" href="#/c/${pathHref(n.path)}">
    <b>${esc(n.name)}</b><span>${ds.length} deck${ds.length === 1 ? '' : 's'}${subs} · ${items} items</span></a>`;
}

function viewHome() {
  const root = buildTree();
  // A single top-level category is the start page.
  if (root.kids.size === 1) return viewCategory([...root.kids.keys()]);
  $app.innerHTML = `
    <div class="hero">
      <div><h1>Library</h1><p class="muted">${decks.length} decks</p></div>
      <a class="btn" href="#/mixed/all">Quiz everything</a>
    </div>
    <div class="decks">${[...root.kids.values()].map(categoryCard).join('')}</div>`;
}

function viewCategory(parts) {
  const n = findNode(parts);
  if (!n) return notFound();
  const special = n.decks.find((d) => VIEWS[d.view]);
  if (special && !n.kids.size && n.decks.length === 1) return VIEWS[special.view](special, parts);
  const ds = nodeDecks(n);
  $app.innerHTML = `
    ${crumbs(parts)}
    <div class="hero">
      <div><h1>${esc(n.name)}</h1>
        <p class="muted">${ds.length} deck${ds.length === 1 ? '' : 's'} · ${ds.reduce((s, d) => s + d.items.length, 0)} items</p></div>
      <a class="btn" href="#/mixed/${pathHref(parts)}">Quiz this category</a>
    </div>
    ${n.kids.size ? `<h3 class="muted">Subtopics</h3><div class="decks">${[...n.kids.values()].map(categoryCard).join('')}</div>` : ''}
    ${n.decks.length ? `<h3 class="muted">Decks</h3><div class="decks">${n.decks.map(deckCard).join('')}</div>` : ''}`;
}

function quizOptionsHtml(defaultCount) {
  return `<label>Format
      <select id="fmt"><option value="mc">Multiple choice</option><option value="type">Type the answer</option></select></label>
    <label>Questions <input type="number" id="cnt" min="1" max="200" value="${defaultCount}"></label>`;
}

const practiceHtml = (d) => `<details class="panel">
  <summary>Practice this deck</summary>
  <div class="checks">${d.modes.map((m) => `<label><input type="checkbox" name="mode" value="${esc(m.id)}" checked> ${esc(m.label)}</label>`).join('')}</div>
  <p>${quizOptionsHtml(Math.min(20, d.cards.length))}</p>
  <div class="row"><button class="primary" id="quiz">Start quiz</button><button id="flash">Flashcards</button></div>
</details>`;

function wirePractice(d, exit) {
  const selected = () => {
    const ids = new Set([...$app.querySelectorAll('input[name=mode]:checked')].map((x) => x.value));
    return d.cards.filter((c) => ids.has(c.mode.id));
  };
  const opts = () => ({ format: $app.querySelector('#fmt').value, n: Math.max(1, Number($app.querySelector('#cnt').value) || 10) });
  $app.querySelector('#quiz').onclick = () => {
    const { format, n } = opts();
    const cards = pickCards(selected(), n);
    if (cards.length) runQuiz({ cards, format, onExit: exit });
  };
  $app.querySelector('#flash').onclick = () => {
    const cards = pickCards(selected(), opts().n);
    if (cards.length) runFlashcards({ cards, onExit: exit });
  };
}

function viewDeck(id) {
  const d = decks.find((x) => x.id === id);
  if (!d) return notFound();

  $app.innerHTML = `
    ${crumbs(d.category, d.title)}
    <div class="hero">
      <div><h1>${esc(d.title)}</h1>
        <p class="muted">${d.items.length} items</p></div>
    </div>
    ${d.description ? `<p>${esc(d.description)}</p>` : ''}
    ${practiceHtml(d)}`;

  wirePractice(d, () => viewDeck(id));
}

/* ---------- periodic table ---------- */

const slug = (c) => c.toLowerCase().replace(/[^a-z]+/g, '-');
const FAMILY_ORDER = ['Alkali metal', 'Alkaline earth metal', 'Transition metal', 'Post-transition metal', 'Metalloid', 'Reactive nonmetal', 'Halogen', 'Noble gas', 'Lanthanide', 'Actinide'];

// Row/column in the 18-column grid. Lanthanides and actinides sit in two detached rows.
function gridPos(el) {
  const z = el.number;
  if (z >= 57 && z <= 71) return { r: 9, c: z - 57 + 3 };
  if (z >= 89 && z <= 103) return { r: 10, c: z - 89 + 3 };
  return { r: el.period, c: el.group };
}

const fmtTemp = (k) => (typeof k === 'number' ? `${k} K (${Math.round((k - 273.15) * 10) / 10} °C)` : k);
const fmtDensity = (d) => (d < 0.01 ? `${+(d * 1000).toPrecision(4)} g/L` : `${d} g/cm³`);
const fmtMass = (m) => (Number.isInteger(m) ? `(${m})` : String(m)); // brackets: mass number of longest-lived isotope
const fmtConfig = (c) => esc(c).replace(/([spdf])(\d+)/g, '$1<sup>$2</sup>');

let stopModal = () => {};

// Explanation of one attribute: summary, optional bullet points, optional term list.
const attrBody = (a) => {
  const seen = new Set();
  const R = (t) => rich(t, { seen, sup: true });
  return `<p>${R(a.summary)}</p>
    ${a.points ? `<ul>${a.points.map((p) => `<li>${R(p)}</li>`).join('')}</ul>` : ''}
    ${a.items ? `<dl class="terms">${a.items.map((t) => `<dt>${esc(t.term)}</dt><dd>${R(t.text)}</dd>`).join('')}</dl>` : ''}`;
};

function viewPeriodicTable(d, parts, openSymbol) {
  const cell = (el) => {
    const { r, c } = gridPos(el);
    return `<button class="el fam-${slug(el.category)}" style="grid-row:${r};grid-column:${c}" data-sym="${esc(el.symbol)}" title="${esc(el.name)}">
      <small>${el.number}</small><b>${esc(el.symbol)}</b><span>${esc(el.name)}</span></button>`;
  };

  $app.innerHTML = `
    ${crumbs(parts)}
    <div class="hero">
      <div><h1>${esc(parts[parts.length - 1])}</h1><p class="muted">Click an element for details.</p></div>
      <button class="primary" id="openquiz">Quiz</button>
    </div>
    ${ptGrid(d.items, cell)}
    <div class="legend">${FAMILY_ORDER.map((f) => `<span><i class="sw fam-${slug(f)}"></i>${f}</span>`).join('')}</div>
    ${d.attributes ? `<section class="guide"><h2>What each attribute means</h2>${d.attributes.map((a) => `<details><summary>${esc(a.label)}</summary>${attrBody(a)}</details>`).join('')}</section>` : ''}`;

  $app.querySelectorAll('.el').forEach((b) => { b.onclick = () => { location.hash = `#/element/${b.dataset.sym}`; }; });
  $app.querySelector('#openquiz').onclick = () => { stopModal(); openQuizOptions(d, parts); };
  if (openSymbol) openElement(d, parts, openSymbol);
}

function openElement(d, parts, symbol) {
  const i = d.items.findIndex((e) => e.symbol === symbol);
  if (i < 0) return;
  const el = d.items[i];
  const back = `#/c/${pathHref(parts)}`;
  const facts = [
    ['symbol', el.symbol],
    ['number', el.number],
    ['mass', el.mass != null ? `${fmtMass(el.mass)} u` : null],
    ['category', el.category],
    ['group', el.group ?? (el.number >= 89 ? 'Actinide series' : 'Lanthanide series')],
    ['period', el.period],
    ['block', el.block],
    ['config', el.config ? fmtConfig(el.config) : null, true],
    ['state', el.state],
    ['melt', el.melt != null ? fmtTemp(el.melt) : null],
    ['boil', el.boil != null ? fmtTemp(el.boil) : null],
    ['density', el.density != null ? fmtDensity(el.density) : null],
    ['eneg', el.eneg != null ? `${el.eneg} (Pauling)` : null],
    ['discovered', el.discovered],
  ];
  const attr = (key) => d.attributes?.find((a) => a.key === key);
  const neighbour = (k) => d.items[(i + k + d.items.length) % d.items.length].symbol;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="card" role="dialog" aria-label="${esc(el.name)}">
    <button class="close" aria-label="Close">×</button>
    <div class="card-head">
      <div class="tile fam-${slug(el.category)}"><small>${el.number}</small><b>${esc(el.symbol)}</b><span>${esc(el.name)}</span></div>
      <div><h2>${esc(el.name)}</h2><p class="muted">${esc(el.category)}</p></div>
    </div>
    <p class="muted hint">Click a label to see what it means.</p>
    <dl class="facts">${facts.map(([k, v, raw]) => {
      const a = attr(k);
      const val = v == null || v === '' ? '<span class="muted">Unknown</span>' : raw ? v : esc(v);
      return `<dt>${a ? `<button class="info" data-attr="${k}" aria-expanded="false">${esc(a.label)}</button>` : esc(k)}</dt><dd>${val}</dd>
        ${a ? `<dd class="explain" data-for="${k}" hidden>${attrBody(a)}</dd>` : ''}`;
    }).join('')}</dl>
    <div class="row"><a class="btn" href="#/element/${esc(neighbour(-1))}">← Previous</a><a class="btn" href="#/element/${esc(neighbour(1))}">Next →</a></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('.info').forEach((b) => {
    b.onclick = () => {
      const box = modal.querySelector(`.explain[data-for="${b.dataset.attr}"]`);
      box.hidden = !box.hidden;
      b.setAttribute('aria-expanded', String(!box.hidden));
    };
  });

  const close = () => closeTo(back);
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('.close').onclick = close;
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') location.hash = `#/element/${neighbour(-1)}`;
    else if (e.key === 'ArrowRight') location.hash = `#/element/${neighbour(1)}`;
  };
  window.addEventListener('keydown', onKey);
  stopModal = () => { window.removeEventListener('keydown', onKey); modal.remove(); stopModal = () => {}; };
  modal.querySelector('.close').focus();
}

/* ---------- linked terms ---------- */

// Terms that have their own page (concepts, processes, reaction types) become links wherever they appear.
let termMap = new Map();
let termRe = null;
let returnTo = null; // where to go back to after reading a linked term

function buildTerms() {
  termMap = new Map();
  const add = (term, key, href) => {
    const t = esc(term.trim()).toLowerCase();
    if (t && !termMap.has(t)) termMap.set(t, { key, href });
  };
  for (const d of decks) {
    if (d.view === 'articles') {
      for (const e of d.entries) [e.name, ...(e.terms ?? [])].forEach((t) => add(t, `entry:${d.id}/${e.id}`, `#/entry/${d.id}/${e.id}`));
    } else if (d.view === 'reaction-types') {
      for (const t of d.types) [t.name, ...(t.aka ?? '').split(',')].forEach((n) => add(n, `reaction:${t.id}`, `#/reaction/${t.id}`));
    }
  }
  const alts = [...termMap.keys()].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\/* ---------- reaction types ---------- */'));
  termRe = alts.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
}

// Escape text and link known terms. Each target is linked once per `seen` set, and never links to itself.
function rich(text, { self, seen = new Set(), sup = false } = {}) {
  let html = esc(text);
  if (sup) html = html.replace(/(\d)([spdf])(\d+)/g, '$1$2<sup>$3</sup>');
  if (!termRe) return html;
  return html.replace(termRe, (m) => {
    const t = termMap.get(m.toLowerCase());
    if (!t || t.key === self || seen.has(t.key)) return m;
    seen.add(t.key);
    return `<a class="term" href="${t.href}">${m}</a>`;
  });
}

document.addEventListener('click', (e) => { if (e.target.closest?.('a.term')) returnTo = location.hash; });

const closeTo = (fallback) => {
  const to = returnTo ?? fallback;
  returnTo = null;
  location.hash = to;
};

/* ---------- article decks (concepts, processes) ---------- */

function articleCards(d) {
  return d.entries.flatMap((e) => (e.quiz ?? []).map((qz, i) => ({
    key: `${d.id}#${e.id}#${i}`, deck: d, item: e,
    mode: { id: 'quiz', label: e.name, mcOnly: true },
    q: qz.q, a: qz.a, alts: [], wrong: qz.wrong,
  })));
}

function viewArticles(d, parts, openId) {
  const groups = new Map();
  d.entries.forEach((e) => {
    const g = e.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  });
  $app.innerHTML = `
    ${crumbs(parts)}
    <div class="hero">
      <div><h1>${esc(d.title)}</h1><p class="muted">${d.entries.length} topics</p></div>
      ${d.cards.length ? '<button class="primary" id="openquiz">Quiz</button>' : ''}
    </div>
    ${d.description ? `<p>${esc(d.description)}</p>` : ''}
    ${[...groups].map(([g, es]) => `${g ? `<h3 class="muted">${esc(g)}</h3>` : ''}
      <div class="decks">${es.map((e) => `<a class="deck" href="#/entry/${d.id}/${e.id}"><b>${esc(e.name)}</b><span>${esc(e.tagline)}</span></a>`).join('')}</div>`).join('')}`;
  $app.querySelector('#openquiz')?.addEventListener('click', () => { stopModal(); openArticleQuiz(d, parts); });
  if (openId) openEntry(d, parts, openId);
}

function openEntry(d, parts, id) {
  const i = d.entries.findIndex((e) => e.id === id);
  if (i < 0) return;
  const e = d.entries[i];
  const R = (t) => rich(t, { self: `entry:${d.id}/${e.id}`, seen });
  const seen = new Set();
  const go = (k) => `#/entry/${d.id}/${d.entries[(i + k + d.entries.length) % d.entries.length].id}`;
  const section = (s) => `${s.h ? `<h3>${esc(s.h)}</h3>` : ''}
    ${s.equations ? s.equations.map((q) => `<p class="big-eq">${esc(q)}</p>`).join('') : ''}
    ${s.text ? `<p>${R(s.text)}</p>` : ''}
    ${s.facts ? `<dl class="terms">${s.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${R(v)}</dd>`).join('')}</dl>` : ''}
    ${s.points ? `<ul>${s.points.map((p) => `<li>${R(p)}</li>`).join('')}</ul>` : ''}`;

  const modal = mountModal(`<div class="card wide" role="dialog" aria-label="${esc(e.name)}">
    <button class="close" aria-label="Close">×</button>
    <h2>${esc(e.name)}</h2>
    <p class="muted">${R(e.tagline)}</p>
    ${e.sections.map(section).join('')}
    <div class="row"><a class="btn" href="${go(-1)}">← Previous</a><a class="btn" href="${go(1)}">Next →</a></div>
  </div>`, {
    onClose: () => closeTo(`#/c/${pathHref(parts)}`),
    onKey: (ev) => {
      if (ev.key === 'ArrowLeft') location.hash = go(-1);
      else if (ev.key === 'ArrowRight') location.hash = go(1);
    },
  });
  modal.querySelector('.close').focus();
}

function openArticleQuiz(d, parts) {
  const groups = [...new Set(d.entries.map((e) => e.group).filter(Boolean))];
  const modal = mountModal(`<div class="card" role="dialog" aria-label="Quiz options">
    <button class="close" aria-label="Close">×</button>
    <h2>Quiz</h2>
    <p class="muted">Multiple choice questions from ${esc(d.title)}.</p>
    ${groups.length > 1 ? `<fieldset class="checks"><legend>Topics</legend>
      ${groups.map((g) => `<label><input type="checkbox" name="grp" value="${esc(g)}" checked> ${esc(g)}</label>`).join('')}
      <div class="row"><button type="button" class="small" id="g-all">All</button><button type="button" class="small" id="g-none">None</button></div>
    </fieldset>` : ''}
    <p><label>Questions <input type="number" id="cnt" min="1" value="10"></label> <span class="muted" id="pool"></span></p>
    <div class="row"><button class="primary" id="start">Start quiz</button></div>
  </div>`);
  const cardsFor = () => {
    if (groups.length < 2) return d.cards;
    const sel = new Set([...modal.querySelectorAll('input[name=grp]:checked')].map((x) => x.value));
    return d.cards.filter((c) => sel.has(c.item.group));
  };
  const refresh = () => {
    const n = cardsFor().length;
    modal.querySelector('#pool').textContent = `${n} question${n === 1 ? '' : 's'} available`;
    modal.querySelector('#start').disabled = n === 0;
  };
  refresh();
  modal.querySelectorAll('input[name=grp]').forEach((x) => { x.onchange = refresh; });
  const setAll = (v) => { modal.querySelectorAll('input[name=grp]').forEach((x) => { x.checked = v; }); refresh(); };
  modal.querySelector('#g-all')?.addEventListener('click', () => setAll(true));
  modal.querySelector('#g-none')?.addEventListener('click', () => setAll(false));
  modal.querySelector('#start').onclick = () => {
    const cards = cardsFor();
    const n = Math.min(cards.length, Math.max(1, Number(modal.querySelector('#cnt').value) || 10));
    stopModal();
    runQuiz({ cards: pickCards(cards, n), format: 'mc', onExit: () => viewArticles(d, parts) });
  };
  modal.querySelector('#start').focus();
}

/* ---------- reaction types ---------- */

function mountModal(html, { onKey, onClose } = {}) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  const close = onClose ?? (() => stopModal());
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('.close').onclick = close;
  const key = (e) => { if (e.key === 'Escape') close(); else onKey?.(e); };
  window.addEventListener('keydown', key);
  stopModal = () => { window.removeEventListener('keydown', key); modal.remove(); stopModal = () => {}; };
  return modal;
}

function viewReactionTypes(d, parts, openId) {
  $app.innerHTML = `
    ${crumbs(parts)}
    <div class="hero">
      <div><h1>${esc(parts[parts.length - 1])}</h1><p class="muted">Click a reaction type for details.</p></div>
      <button class="primary" id="openquiz">Quiz</button>
    </div>
    ${d.description ? `<p>${esc(d.description)}</p>` : ''}
    <div class="decks">${d.types.map((t) => `<a class="deck rx" href="#/reaction/${t.id}">
      <b>${esc(t.name)}</b><span class="eq">${esc(t.form)}</span><span>${esc(t.summary.split('. ')[0].replace(/\.$/, ''))}.</span></a>`).join('')}</div>`;
  $app.querySelector('#openquiz').onclick = () => { stopModal(); openReactionQuiz(d, parts); };
  if (openId) openReaction(d, parts, openId);
}

function openReaction(d, parts, id) {
  const i = d.types.findIndex((t) => t.id === id);
  if (i < 0) return;
  const t = d.types[i];
  const examples = d.items.filter((it) => it.type === t.name);
  const go = (k) => d.types[(i + k + d.types.length) % d.types.length].id;
  const seen = new Set();
  const R = (x) => rich(x, { self: `reaction:${t.id}`, seen });
  const list = (xs) => `<ul>${xs.map((x) => `<li>${R(x)}</li>`).join('')}</ul>`;

  const modal = mountModal(`<div class="card" role="dialog" aria-label="${esc(t.name)}">
    <button class="close" aria-label="Close">×</button>
    <h2>${esc(t.name)}</h2>
    ${t.aka ? `<p class="muted">Also called: ${esc(t.aka)}</p>` : ''}
    <p class="big-eq">${esc(t.form)}</p>
    <p>${R(t.summary)}</p>
    <h3>How to recognize it</h3>${list(t.recognize)}
    ${examples.length ? `<h3>Examples</h3><ul class="eqs">${examples.map((e) => `<li><span class="eq">${esc(e.equation)}</span>${e.note ? ` <span class="muted">· ${esc(e.note)}</span>` : ''}</li>`).join('')}</ul>` : ''}
    <h3>In the real world</h3>${list(t.realWorld)}
    <div class="row"><a class="btn" href="#/reaction/${go(-1)}">← Previous</a><a class="btn" href="#/reaction/${go(1)}">Next →</a></div>
  </div>`, {
    onClose: () => closeTo(`#/c/${pathHref(parts)}`),
    onKey: (e) => {
      if (e.key === 'ArrowLeft') location.hash = `#/reaction/${go(-1)}`;
      else if (e.key === 'ArrowRight') location.hash = `#/reaction/${go(1)}`;
    },
  });
  modal.querySelector('.close').focus();
}

function openReactionQuiz(d, parts) {
  const quizTypes = d.types.filter((t) => t.quiz !== false);
  const modal = mountModal(`<div class="card" role="dialog" aria-label="Quiz options">
    <button class="close" aria-label="Close">×</button>
    <h2>Quiz</h2>
    <fieldset class="checks"><legend>Quiz type</legend>
      <label><input type="radio" name="qt" value="equation" checked> Equation → reaction type <span class="muted">· classify a balanced equation</span></label>
      <label><input type="radio" name="qt" value="form"> General form → reaction type <span class="muted">· match a pattern like A + BC → AC + B</span></label>
    </fieldset>
    <fieldset class="checks"><legend>Reaction types</legend>
      ${quizTypes.map((t) => `<label><input type="checkbox" name="rt" value="${esc(t.name)}" checked> ${esc(t.name)}</label>`).join('')}
      <div class="row"><button type="button" class="small" id="rt-all">All</button><button type="button" class="small" id="rt-none">None</button></div>
    </fieldset>
    <p><label>Questions <input type="number" id="cnt" min="1" value="10"></label> <span class="muted" id="pool"></span></p>
    <div class="row"><button class="primary" id="start">Start quiz</button></div>
  </div>`);

  const selected = () => new Set([...modal.querySelectorAll('input[name=rt]:checked')].map((x) => x.value));
  const cardsFor = () => {
    const form = modal.querySelector('input[name=qt]:checked').value === 'form';
    const sel = selected();
    const cards = d.cards.filter((c) => c.mode.id === (form ? 'form-type' : 'equation-type') && sel.has(c.item.type));
    // the pattern question is the same for every example of a type, so ask it once per type
    return form ? cards.filter((c, k) => cards.findIndex((x) => x.item.type === c.item.type) === k) : cards;
  };
  const refresh = () => {
    const n = cardsFor().length;
    modal.querySelector('#pool').textContent = `${n} question${n === 1 ? '' : 's'} available`;
    modal.querySelector('#start').disabled = n === 0;
  };
  refresh();
  modal.querySelectorAll('input[name=rt],input[name=qt]').forEach((x) => { x.onchange = refresh; });
  const setAll = (v) => { modal.querySelectorAll('input[name=rt]').forEach((x) => { x.checked = v; }); refresh(); };
  modal.querySelector('#rt-all').onclick = () => setAll(true);
  modal.querySelector('#rt-none').onclick = () => setAll(false);

  modal.querySelector('#start').onclick = () => {
    const cards = cardsFor();
    const n = Math.min(cards.length, Math.max(1, Number(modal.querySelector('#cnt').value) || 10));
    stopModal();
    runQuiz({ cards: pickCards(cards, n), format: 'mc', onExit: () => viewReactionTypes(d, parts) });
  };
  modal.querySelector('#start').focus();
}

/* ---------- world map ---------- */

const MAP_REGIONS = ['Global', 'North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];
let mapData = null;
let mapRegion = 'Global';
let pendingFind = 0; // question count to start a map quiz with after a clean re-render

async function viewWorldMap(d, parts) {
  const hash = location.hash;
  mapData ??= await (await fetch(`data/${d.mapFile}`)).json();
  if (location.hash !== hash) return; // navigated away while loading
  const m = mapData;
  const region = mapRegion;
  const inRegion = (it) => region === 'Global' || it.continent === region;
  const items = d.items.filter(inRegion);
  const byName = new Map(d.items.map((it) => [it.name, it]));
  const rd = { ...d, items, cards: d.cards.filter((c) => inRegion(c.item)) };
  const home = () => viewWorldMap(d, parts);

  const attrs = (n, extra = '') => {
    const it = byName.get(n);
    return `data-n="${esc(n)}" class="ctry${extra} c-${slug(it.continent)}${inRegion(it) ? '' : ' dim'}"`;
  };
  const shapes = Object.entries(m.shapes).map(([n, p]) => `<path ${attrs(n)} d="${p}"/>`).join('');
  const markers = Object.entries(m.points).map(([n, p]) => {
    const [x, y] = region === 'Oceania' && m.wrap[n] ? m.wrap[n] : p;
    return `<circle ${attrs(n, ' mk')} cx="${x}" cy="${y}" r="3"/><circle ${attrs(n, ' hit')} cx="${x}" cy="${y}" r="8"/>`;
  }).join('');
  const vb0 = m.regions[region];

  $app.innerHTML = `
    ${crumbs(parts)}
    <div class="hero">
      <div><h1>${esc(parts[parts.length - 1])}</h1>
        <p class="muted">${items.length} countries · ${region === 'Global' ? 'whole world' : esc(region)}. Click a country for details; scroll to zoom, drag to pan.</p></div>
      <div class="row"><label>Questions <input type="number" id="mcnt" min="1" max="${items.length}" value="${Math.min(20, items.length)}"></label>
        <button class="primary" id="mq">Find them on the map</button></div>
    </div>
    <div class="tabs">${MAP_REGIONS.map((r) => `<button class="tab${r === region ? ' on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    <div class="row finder" id="finder">
      <input id="find" list="countrylist" placeholder="Jump to a country…" autocomplete="off">
      <datalist id="countrylist">${items.map((it) => `<option value="${esc(it.name)}">`).join('')}</datalist>
      <span class="muted">Tiny countries:</span>
      ${items.filter((it) => it.name in m.points).map((it) => `<button class="chip" data-n="${esc(it.name)}">${esc(it.name)}</button>`).join('')}
    </div>
    <div class="mapwrap">
      <svg id="wmap" viewBox="${vb0.join(' ')}" role="img" aria-label="World map">
        <rect class="sea" x="-300" y="-200" width="1700" height="900"/>${(m.background ?? []).map((p) => `<path class="bg" d="${p}"/>`).join('')}${shapes}${markers}</svg>
      <div class="zoom"><button id="zi" aria-label="Zoom in">+</button><button id="zo" aria-label="Zoom out">−</button><button id="zr" aria-label="Reset view">⟲</button></div>
      <div class="tip" id="tip" hidden></div>
    </div>
    <div class="panel" id="minfo"></div>
    ${rd.cards.length ? practiceHtml(rd) : ''}`;

  const svg = $app.querySelector('#wmap');
  const info = $app.querySelector('#minfo');
  const tip = $app.querySelector('#tip');
  let quiz = null;
  let vb = [...vb0];

  const setView = () => {
    svg.setAttribute('viewBox', vb.map((v) => Math.round(v * 10) / 10).join(' '));
    const box = svg.getBoundingClientRect();
    const px = Math.max(vb[2] / (box.width || 1000), vb[3] / (box.height || 520)); // user units per screen pixel
    svg.querySelectorAll('.mk').forEach((c) => c.setAttribute('r', 3.5 * px));
    svg.querySelectorAll('.hit').forEach((c) => c.setAttribute('r', 8 * px));
  };
  setView();

  const byN = (n) => svg.querySelectorAll(`[data-n="${CSS.escape(n)}"]`);
  const showInfo = (n) => {
    const it = byName.get(n);
    svg.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel'));
    byN(n).forEach((e) => e.classList.add('sel'));
    const num = (v) => v.toLocaleString('en', { maximumFractionDigits: 0 });
    const pop = it.population >= 1e6 ? `${+(it.population / 1e6).toPrecision(3)} million` : num(it.population);
    info.innerHTML = `<div class="country">
      <img class="flag lg" src="${esc(it.flag)}" alt="Flag of ${esc(it.name)}">
      <div><h2>${esc(it.name)}</h2>
        <dl class="facts">
          <dt>Capital</dt><dd>${esc(it.capital)}</dd>
          <dt>Continent</dt><dd>${esc(it.continent)}</dd>
          <dt>Area</dt><dd>${num(it.area)} km² <span class="muted">(${num(it.area * 0.386102)} sq mi)</span></dd>
          <dt>Population</dt><dd>${pop} <span class="muted">(approx.)</span></dd>
          <dt>Founded</dt><dd>${esc(it.founded)}</dd>
        </dl></div></div>
      <h3>How to recognise it</h3><ul class="clues">${it.clues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`;
  };
  info.innerHTML = '<span class="muted">Select a country on the map.</span>';

  $app.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { mapRegion = b.dataset.r; home(); }; });

  // Zoom and pan
  const zoomBy = (f, cx = 0.5, cy = 0.5) => {
    const w = Math.min(vb0[2] * 1.5, Math.max(30, vb[2] * f));
    const k = w / vb[2];
    vb = [vb[0] + vb[2] * cx * (1 - k), vb[1] + vb[3] * cy * (1 - k), vb[2] * k, vb[3] * k];
    setView();
  };
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoomBy(e.deltaY > 0 ? 1.2 : 1 / 1.2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, { passive: false });
  $app.querySelector('#zi').onclick = () => zoomBy(1 / 1.4);
  $app.querySelector('#zo').onclick = () => zoomBy(1.4);
  $app.querySelector('#zr').onclick = () => { vb = [...vb0]; setView(); };
  svg.addEventListener('dblclick', (e) => {
    const r = svg.getBoundingClientRect();
    zoomBy(0.5, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });

  const focusCountry = (n) => {
    if (quiz || !byName.has(n)) return;
    const p = n in m.points ? (region === 'Oceania' && m.wrap[n] ? m.wrap[n] : m.points[n]) : m.centroids[n];
    const w = Math.min(vb0[2], n in m.points ? 50 : 170);
    const h = w * vb0[3] / vb0[2];
    vb = [p[0] - w / 2, p[1] - h / 2, w, h];
    setView();
    showInfo(n);
    flash(n, 'pulse', 1300);
  };
  const find = $app.querySelector('#find');
  find.onchange = () => {
    const v = norm(find.value);
    const it = items.find((x) => norm(x.name) === v || (x.alts?.name ?? []).some((a) => norm(a) === v));
    if (it) { focusCountry(it.name); find.value = ''; }
  };
  $app.querySelectorAll('.chip').forEach((b) => { b.onclick = () => focusCountry(b.dataset.n); });

  let drag = null;
  let moved = false;
  svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vb: [...vb] }; moved = false; });
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) moved = true;
    if (!moved) return;
    const r = svg.getBoundingClientRect();
    const s = Math.max(drag.vb[2] / r.width, drag.vb[3] / r.height);
    vb = [drag.vb[0] - dx * s, drag.vb[1] - dy * s, drag.vb[2], drag.vb[3]];
    setView();
  };
  const onUp = () => { drag = null; };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  const prevStop = stopKeys;
  stopKeys = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); stopKeys = () => {}; prevStop(); };

  // Hover name (hidden during the quiz so it doesn't give answers away)
  svg.addEventListener('pointermove', (e) => {
    const t = e.target.closest('[data-n]');
    if (!t || quiz || t.classList.contains('dim')) { tip.hidden = true; return; }
    const r = svg.parentElement.getBoundingClientRect();
    tip.textContent = t.dataset.n;
    tip.style.left = `${e.clientX - r.left + 12}px`;
    tip.style.top = `${e.clientY - r.top + 12}px`;
    tip.hidden = false;
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });

  svg.addEventListener('click', (e) => {
    if (moved) return;
    const t = e.target.closest('[data-n]');
    if (!t || t.classList.contains('dim')) return;
    if (quiz) answer(t); else showInfo(t.dataset.n);
  });

  // "Find them on the map" quiz
  const flash = (n, cls, ms) => {
    const els = byN(n);
    els.forEach((x) => x.classList.add(cls));
    setTimeout(() => els.forEach((x) => x.classList.remove(cls)), ms);
  };
  const mark = (n, cls) => byN(n).forEach((x) => x.classList.add(cls));

  const ask = () => {
    if (quiz.i >= quiz.queue.length) return finish();
    quiz.tries = 0;
    quiz.busy = false;
    info.innerHTML = `<div class="meta">${quiz.i + 1} / ${quiz.queue.length} · ${quiz.score} correct first try</div>
      <h2 class="q">Click on: ${esc(quiz.queue[quiz.i])}</h2>
      <div class="row"><button id="skip">Skip</button><button id="quit">Stop quiz</button></div>`;
    info.querySelector('#skip').onclick = giveUp;
    info.querySelector('#quit').onclick = home;
  };
  const next = () => { quiz.i++; ask(); };
  const giveUp = () => {
    if (quiz.busy) return;
    quiz.busy = true;
    const n = quiz.queue[quiz.i];
    quiz.missed.push(n);
    mark(n, 'miss');
    flash(n, 'pulse', 1200);
    setTimeout(next, 1300);
  };
  const answer = (t) => {
    if (quiz.busy) return;
    const target = quiz.queue[quiz.i];
    const n = t.dataset.n;
    if (n === target) {
      quiz.busy = true;
      if (quiz.tries === 0) { quiz.score++; mark(n, 'ok'); } else { quiz.missed.push(n); mark(n, 'miss'); }
      setTimeout(next, 400);
    } else {
      quiz.tries++;
      flash(n, 'wrong', 600);
      if (quiz.tries >= 2) giveUp();
    }
  };
  const finish = () => {
    const missed = quiz.missed;
    info.innerHTML = `<h2>${quiz.score} / ${quiz.queue.length} first try</h2>
      ${missed.length ? `<h3>Review</h3><ul class="review">${missed.map((n) => `<li>${esc(n)} <span class="muted">· ${esc(byName.get(n).capital)}</span></li>`).join('')}</ul>` : '<p class="good">Perfect.</p>'}
      <div class="row"><button class="primary" id="again">Try again</button><button id="done">Back to the map</button></div>`;
    quiz = null;
    $app.querySelector('#finder').hidden = false;
    info.querySelector('#again').onclick = () => { pendingFind = items.length ? Math.min(20, items.length) : 0; home(); };
    info.querySelector('#done').onclick = home;
  };
  const start = (n) => {
    const count = Math.min(items.length, Math.max(1, n || 20));
    quiz = { queue: shuffle(items.map((it) => it.name)).slice(0, count), i: 0, score: 0, missed: [] };
    $app.querySelector('#finder').hidden = true;
    vb = [...vb0];
    setView();
    ask();
  };
  $app.querySelector('#mq').onclick = () => {
    const n = Number($app.querySelector('#mcnt').value);
    if (svg.querySelector('.ok, .miss, .sel')) { pendingFind = n || 20; home(); } else start(n);
  };
  if (pendingFind) { const n = pendingFind; pendingFind = 0; start(n); }

  if (rd.cards.length) wirePractice(rd, home);
}

const VIEWS = { 'world-map': viewWorldMap, 'periodic-table': viewPeriodicTable, 'reaction-types': viewReactionTypes, articles: viewArticles };

/* ---------- periodic table quizzes ---------- */

const ptGrid = (items, cellHtml) => `<div class="pt-scroll"><div class="pt">
  ${items.map(cellHtml).join('')}
  <div class="el-gap" style="grid-row:6;grid-column:3">57–71</div>
  <div class="el-gap" style="grid-row:7;grid-column:3">89–103</div>
</div></div>`;

function openQuizOptions(d, parts) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="card" role="dialog" aria-label="Quiz options">
    <button class="close" aria-label="Close">×</button>
    <h2>Quiz</h2>
    <fieldset class="checks"><legend>Quiz type</legend>
      <label><input type="radio" name="qt" value="find" checked> Find it on the table <span class="muted">· given a name, click its spot on the blank table</span></label>
      <label><input type="radio" name="qt" value="number"> Atomic number → name <span class="muted">· type the element's name</span></label>
    </fieldset>
    <fieldset class="checks"><legend>Families</legend>
      ${FAMILY_ORDER.map((f) => `<label><input type="checkbox" name="fam" value="${esc(f)}" checked> <i class="sw fam-${slug(f)}"></i>${esc(f)}</label>`).join('')}
      <div class="row"><button type="button" class="small" id="fam-all">All</button><button type="button" class="small" id="fam-none">None</button></div>
    </fieldset>
    <p><label>Questions <input type="number" id="cnt" min="1" value="20"></label> <span class="muted" id="pool"></span></p>
    <div class="row"><button class="primary" id="start">Start quiz</button></div>
  </div>`;
  document.body.appendChild(modal);

  const families = () => new Set([...modal.querySelectorAll('input[name=fam]:checked')].map((x) => x.value));
  const pool = () => d.items.filter((e) => families().has(e.category));
  const refresh = () => {
    const n = pool().length;
    modal.querySelector('#pool').textContent = `${n} element${n === 1 ? '' : 's'} in selection`;
    modal.querySelector('#start').disabled = n === 0;
  };
  refresh();
  modal.querySelectorAll('input[name=fam]').forEach((x) => { x.onchange = refresh; });
  const setAll = (v) => { modal.querySelectorAll('input[name=fam]').forEach((x) => { x.checked = v; }); refresh(); };
  modal.querySelector('#fam-all').onclick = () => setAll(true);
  modal.querySelector('#fam-none').onclick = () => setAll(false);

  const close = () => { stopModal(); };
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('.close').onclick = close;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);
  stopModal = () => { window.removeEventListener('keydown', onKey); modal.remove(); stopModal = () => {}; };

  modal.querySelector('#start').onclick = () => {
    const type = modal.querySelector('input[name=qt]:checked').value;
    const items = pool();
    const n = Math.min(items.length, Math.max(1, Number(modal.querySelector('#cnt').value) || 20));
    const exit = () => viewPeriodicTable(d, parts);
    stopModal();
    if (type === 'find') {
      runFindQuiz({ d, items: shuffle(items).slice(0, n), onExit: exit });
    } else {
      const fam = new Set(items.map((e) => e.category));
      const cards = d.cards.filter((c) => c.mode.id === 'number-name' && fam.has(c.item.category));
      runQuiz({ cards: pickCards(cards, n), format: 'type', onExit: exit });
    }
  };
  modal.querySelector('#start').focus();
}

// Blank table: name shown, click where it belongs. Answered cells fill in as you go.
function runFindQuiz({ d, items, onExit }) {
  let i = 0;
  let score = 0;
  const missed = [];
  const filled = new Map(); // symbol -> 'right' | 'wrong'

  const cell = (el) => {
    const { r, c } = gridPos(el);
    const st = filled.get(el.symbol);
    const body = st ? `<small>${el.number}</small><b>${esc(el.symbol)}</b><span>${esc(el.name)}</span>` : '';
    return `<button class="el ${st ? `fam-${slug(el.category)} ${st}` : 'blank'}" style="grid-row:${r};grid-column:${c}" data-sym="${esc(el.symbol)}" ${st ? 'disabled' : ''}>${body}</button>`;
  };

  const show = (last) => {
    if (i >= items.length) return summary();
    const target = items[i];
    $app.innerHTML = `<div class="meta">${i + 1} / ${items.length} · ${score} correct</div>
      <h2 class="q">Where is <b>${esc(target.name)}</b>?</h2>
      <div id="fb">${last ?? ''}</div>
      ${ptGrid(d.items, cell)}`;
    let answered = false;
    $app.querySelectorAll('.el.blank').forEach((b) => {
      b.onclick = () => {
        if (answered) return;
        answered = true;
        const ok = b.dataset.sym === target.symbol;
        if (ok) score++; else missed.push(target);
        filled.set(target.symbol, ok ? 'right' : 'wrong');
        const t = $app.querySelector(`.el[data-sym="${target.symbol}"]`);
        t.className = `el fam-${slug(target.category)} ${ok ? 'right' : 'wrong'}`;
        t.innerHTML = `<small>${target.number}</small><b>${esc(target.symbol)}</b><span>${esc(target.name)}</span>`;
        if (!ok) b.classList.add('miss');
        $app.querySelectorAll('.el.blank').forEach((x) => { x.disabled = true; });
        const fb = $app.querySelector('#fb');
        fb.innerHTML = `<p class="${ok ? 'good' : 'bad'}">${ok ? 'Correct!' : `Not quite. ${esc(target.name)} is highlighted.`}</p>
          <button class="primary" id="next">${i + 1 === items.length ? 'Finish' : 'Next'}</button>`;
        const next = fb.querySelector('#next');
        next.onclick = () => { i++; show(); };
        next.focus();
      };
    });
  };

  const summary = () => {
    const pct = Math.round((score / items.length) * 100);
    $app.innerHTML = `<div class="quiz">
      <h2>${score} / ${items.length} <span class="muted">(${pct}%)</span></h2>
      ${missed.length
        ? `<h3>Review</h3><ul class="review">${missed.map((e) => `<li>${esc(e.name)} <b>${esc(e.symbol)}</b> · #${e.number} · period ${e.period}${e.group ? `, group ${e.group}` : ''}</li>`).join('')}</ul>`
        : '<p class="good">Perfect run.</p>'}
      <div class="row">
        ${missed.length ? '<button class="primary" id="retry">Retry missed</button>' : ''}
        <button id="done">Done</button>
      </div></div>`;
    $app.querySelector('#retry')?.addEventListener('click', () => runFindQuiz({ d, items: shuffle(missed), onExit }));
    $app.querySelector('#done').onclick = onExit;
  };

  show();
}

function viewMixed(scopeParts) {
  const scope = scopeParts.join('/');
  const inScope = (d) => scope === 'all' || scope === '' || d.category.join('/') === scope || d.category.join('/').startsWith(`${scope}/`);
  const byCat = new Map();
  for (const d of decks) {
    const k = d.category.join(' › ');
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k).push(d);
  }
  const label = scope === 'all' || !scope ? 'Everything' : scope.split('/').join(' › ');

  $app.innerHTML = `
    ${crumbs(scopeParts[0] === "all" ? [] : scopeParts, "Quiz")}
    <h1>Quiz</h1>
    <p class="muted">Scope: ${esc(label)}. </p>
    <div class="panel">
      ${[...byCat].map(([cat, ds]) => `<div class="scope-group"><h3>${esc(cat)}</h3><div class="checks">
        ${ds.map((d) => `<label><input type="checkbox" name="deck" value="${esc(d.id)}" ${inScope(d) ? 'checked' : ''}> ${esc(d.title)} <span class="muted">(${d.cards.length})</span></label>`).join('')}
      </div></div>`).join('')}
      <p>${quizOptionsHtml(20)}</p>
      <div class="row"><button class="primary" id="go">Start</button></div>
    </div>`;

  $app.querySelector('#go').onclick = () => {
    const ids = new Set([...$app.querySelectorAll('input[name=deck]:checked')].map((x) => x.value));
    const pool = decks.filter((d) => ids.has(d.id)).flatMap((d) => d.cards);
    const format = $app.querySelector('#fmt').value;
    const n = Math.max(1, Number($app.querySelector('#cnt').value) || 20);
    const cards = pickCards(pool, n);
    if (cards.length) runQuiz({ cards, format, onExit: () => viewMixed(scopeParts) });
  };
}

const notFound = () => { $app.innerHTML = '<p>Not found. <a href="#/">Home</a></p>'; };

/* ---------- router ---------- */

function route() {
  stopKeys();
  stopModal();
  if (!['entry', 'reaction', 'element'].includes(location.hash.replace(/^#\/?/, '').split('/')[0])) returnTo = null;
  const [page, ...rest] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const id = rest.join('/');
  if (page !== 'element') window.scrollTo(0, 0);
  switch (page) {
    case 'deck': return viewDeck(id);
    case 'c': return viewCategory(rest);
    case 'element': {
      const d = decks.find((x) => x.view === 'periodic-table');
      return d ? viewPeriodicTable(d, d.category, id) : notFound();
    }
    case 'reaction': {
      const d = decks.find((x) => x.view === 'reaction-types');
      return d ? viewReactionTypes(d, d.category, id) : notFound();
    }
    case 'entry': {
      const d = decks.find((x) => x.id === rest.slice(0, -1).join('/'));
      return d?.view === 'articles' ? viewArticles(d, d.category, rest[rest.length - 1]) : notFound();
    }
    case 'mixed': return viewMixed(rest);
    default: return viewHome();
  }
}

window.addEventListener('hashchange', route);
loadData().then(route).catch((err) => {
  $app.innerHTML = `<p class="bad">Could not load data: ${esc(err.message)}</p>
    <p class="muted">Serve this folder over HTTP (<code>npm start</code>) instead of opening the file directly.</p>`;
});
