import { $app, ui, esc, norm, shuffle, slug, layout } from './util.js';
import { runQuiz, pickCards } from './quiz.js';
import { crumbs } from './reader.js';

/* ---------- world map ---------- */

const MAP_REGIONS = ['Global', 'North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];
let mapData = null;
let mapRegion = 'Global';
let pendingFind = 0; // question count to start a map quiz with after a clean re-render

export async function viewWorldMap(d, parts) {
  layout('wide');
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
    ${crumbs(d)}
    <div class="hero">
      <div><h1>${esc(d.title)}</h1>
        <p class="muted">${items.length} countries · ${region === 'Global' ? 'whole world' : esc(region)}. Click a country for details; scroll to zoom, drag to pan.</p></div>
    </div>
    <div class="panel quizbar">
      <b>Quiz</b>
      <button class="primary" data-mode="country-capital">Country → Capital</button>
      <button class="primary" data-mode="flag-country">Flag → Country</button>
      <button class="primary" data-mode="clues-country">Clues → Country</button>
      <button class="primary" id="mq">Find on the map</button>
      <label>Format <select id="fmt"><option value="type">Type the answer</option><option value="mc">Multiple choice</option></select></label>
      <label>Questions <input type="number" id="mcnt" min="1" max="${items.length}" value="${Math.min(20, items.length)}"></label>
    </div>
    <div class="tabs">${MAP_REGIONS.map((r) => `<button class="tab${r === region ? ' on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    <div class="row finder" id="finder">
      <input id="find" list="countrylist" placeholder="Jump to a country…" autocomplete="off">
      <datalist id="countrylist">${items.map((it) => `<option value="${esc(it.name)}">`).join('')}</datalist>
    </div>
    <details class="tiny" id="tiny"><summary>Tiny countries (${items.filter((it) => it.name in m.points).length})</summary>
      <div class="row">${items.filter((it) => it.name in m.points).map((it) => `<button class="chip" data-n="${esc(it.name)}">${esc(it.name)}</button>`).join('')}</div></details>
    <div class="mapwrap">
      <svg id="wmap" viewBox="${vb0.join(' ')}" role="img" aria-label="World map">
        <rect class="sea" x="-300" y="-200" width="1700" height="900"/>${(m.background ?? []).map((p) => `<path class="bg" d="${p}"/>`).join('')}${shapes}${markers}</svg>
      <div class="zoom"><button id="zi" aria-label="Zoom in">+</button><button id="zo" aria-label="Zoom out">−</button><button id="zr" aria-label="Reset view">⟲</button></div>
      <div class="tip" id="tip" hidden></div>
    </div>
    <div class="panel" id="minfo"></div>
`;

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
  const prevStop = ui.stopKeys;
  ui.stopKeys = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); ui.stopKeys = () => {}; prevStop(); };

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
    $app.querySelector('#tiny').hidden = false;
    info.querySelector('#again').onclick = () => { pendingFind = items.length ? Math.min(20, items.length) : 0; home(); };
    info.querySelector('#done').onclick = home;
  };
  const start = (n) => {
    const count = Math.min(items.length, Math.max(1, n || 20));
    quiz = { queue: shuffle(items.map((it) => it.name)).slice(0, count), i: 0, score: 0, missed: [] };
    $app.querySelector('#finder').hidden = true;
    $app.querySelector('#tiny').hidden = true;
    vb = [...vb0];
    setView();
    ask();
  };
  $app.querySelector('#mq').onclick = () => {
    const n = Number($app.querySelector('#mcnt').value);
    if (svg.querySelector('.ok, .miss, .sel')) { pendingFind = n || 20; home(); } else start(n);
  };
  if (pendingFind) { const n = pendingFind; pendingFind = 0; start(n); }

  $app.querySelectorAll('[data-mode]').forEach((b) => {
    b.onclick = () => {
      const n = Math.max(1, Number($app.querySelector('#mcnt').value) || 20);
      const cards = pickCards(rd.cards.filter((c) => c.mode.id === b.dataset.mode), n);
      if (cards.length) runQuiz({ cards, format: $app.querySelector('#fmt').value, onExit: home });
    };
  });
}
