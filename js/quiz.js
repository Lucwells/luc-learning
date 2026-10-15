import { $app, ui, esc, shuffle, norm, check, layout } from './util.js';

export const pickCards = (cards, n) => shuffle(cards).slice(0, n);

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


export function runQuiz({ cards, format, onExit }) {
  let i = 0;
  let score = 0;
  const missed = [];

  layout('page');
  const show = () => {
    ui.stopKeys();
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
      ui.stopKeys = () => window.removeEventListener('keydown', onKey);
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

export function runFlashcards({ cards, onExit }) {
  layout('page');
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
