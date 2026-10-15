import { $app, ui, esc, shuffle, slug, layout, navigate } from './util.js';
import { rich } from './terms.js';
import { runQuiz, pickCards } from './quiz.js';
import { crumbs } from './reader.js';
import { chapterHref } from './data.js';

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

// Explanation of one attribute: summary, optional bullet points, optional term list.
const attrBody = (a) => {
  const seen = new Set();
  const R = (t) => rich(t, { seen, sup: true });
  return `<p>${R(a.summary)}</p>
    ${a.points ? `<ul>${a.points.map((p) => `<li>${R(p)}</li>`).join('')}</ul>` : ''}
    ${a.items ? `<dl class="terms">${a.items.map((t) => `<dt>${esc(t.term)}</dt><dd>${R(t.text)}</dd>`).join('')}</dl>` : ''}`;
};

export function viewPeriodicTable(d, parts, openSymbol) {
  layout('wide');
  const cell = (el) => {
    const { r, c } = gridPos(el);
    return `<button class="el fam-${slug(el.category)}" style="grid-row:${r};grid-column:${c}" data-sym="${esc(el.symbol)}" title="${esc(el.name)}">
      <small>${el.number}</small><b>${esc(el.symbol)}</b><span>${esc(el.name)}</span></button>`;
  };

  $app.innerHTML = `
    ${crumbs(d)}
    <div class="hero">
      <div><h1>${esc(d.title)}</h1><p class="muted">Click an element for details.</p></div>
      <button class="primary" id="openquiz">Quiz</button>
    </div>
    ${ptGrid(d.items, cell)}
    <div class="legend">${FAMILY_ORDER.map((f) => `<span><i class="sw fam-${slug(f)}"></i>${f}</span>`).join('')}</div>
    ${d.attributes ? `<section class="guide"><h2>What each attribute means</h2>${d.attributes.map((a) => `<details><summary>${esc(a.label)}</summary>${attrBody(a)}</details>`).join('')}</section>` : ''}`;

  $app.querySelectorAll('.el').forEach((b) => { b.onclick = () => { fromTable = true; navigate(`${chapterHref(d)}/${b.dataset.sym}`); }; });
  $app.querySelector('#openquiz').onclick = () => { ui.stopModal(); openQuizOptions(d, parts); };
  if (openSymbol) openElement(d, parts, openSymbol);
}

let fromTable = false; // true when the element card was opened by clicking the table

function openElement(d, parts, symbol) {
  const i = d.items.findIndex((e) => e.symbol === symbol);
  if (i < 0) return;
  const el = d.items[i];
  const back = chapterHref(d);
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
    <div class="row"><a class="btn" href="${back}/${esc(neighbour(-1))}" data-replace>← Previous</a><a class="btn" href="${back}/${esc(neighbour(1))}" data-replace>Next →</a></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('.info').forEach((b) => {
    b.onclick = () => {
      const box = modal.querySelector(`.explain[data-for="${b.dataset.attr}"]`);
      box.hidden = !box.hidden;
      b.setAttribute('aria-expanded', String(!box.hidden));
    };
  });

  const close = () => { if (fromTable) { fromTable = false; history.back(); } else navigate(back, { replace: true }); };
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('.close').onclick = close;
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') navigate(`${back}/${neighbour(-1)}`, { replace: true });
    else if (e.key === 'ArrowRight') navigate(`${back}/${neighbour(1)}`, { replace: true });
  };
  window.addEventListener('keydown', onKey);
  ui.stopModal = () => { window.removeEventListener('keydown', onKey); modal.remove(); ui.stopModal = () => {}; };
  modal.querySelector('.close').focus();
}

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

  const close = () => { ui.stopModal(); };
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('.close').onclick = close;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);
  ui.stopModal = () => { window.removeEventListener('keydown', onKey); modal.remove(); ui.stopModal = () => {}; };

  modal.querySelector('#start').onclick = () => {
    const type = modal.querySelector('input[name=qt]:checked').value;
    const items = pool();
    const n = Math.min(items.length, Math.max(1, Number(modal.querySelector('#cnt').value) || 20));
    const exit = () => viewPeriodicTable(d, parts);
    ui.stopModal();
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
