// The reading side of the site: shelf of books, a book's contents, and chapters laid out like a textbook.

import { $app, ui, nav, esc, shuffle, layout, navigate } from './util.js';
import { lib, chapterHref, bookHref } from './data.js';
import { inline, fmt } from './terms.js';
import { runQuiz, runFlashcards, pickCards } from './quiz.js';
import { mountExercises } from './notebook.js';

export function crumbs(ch, last) {
  const parts = ['<a href="#/">Library</a>', `<a href="${bookHref(ch.book)}">${esc(ch.book.title)}</a>`];
  parts.push(last ? `<a href="${chapterHref(ch)}">${esc(ch.title)}</a>` : `<span>${esc(ch.title)}</span>`);
  if (last) parts.push(`<span>${esc(last)}</span>`);
  return `<nav class="crumbs">${parts.join(' › ')}</nav>`;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const chapterLabel = (c) => (c.number ? `${c.number}. ${c.title}` : c.title);

/* ---------- shelf and book contents ---------- */

export function viewShelf() {
  layout('page');
  nav.here = null;
  $app.innerHTML = `
    <header class="shelf-head">
      <h1>Library</h1>
      <p class="muted">Textbooks written chapter by chapter. Pick a book.</p>
    </header>
    <div class="shelf">${lib.books.map((b) => `
      <a class="book" href="${bookHref(b)}" style="--book:${esc(b.color ?? '#003262')}">
        <div class="book-cover">
          <span class="book-kicker">${esc(b.kicker ?? 'Study notes')}</span>
          <h2>${esc(b.title)}</h2>
          <p>${esc(b.subtitle ?? '')}</p>
        </div>
        <span class="book-meta">${[b.parts.length && plural(b.chapters.filter((c) => c.number).length, 'chapter'), b.front.length && plural(b.front.length, 'reference page')].filter(Boolean).join(' · ')}</span>
      </a>`).join('')}
    </div>
    <p><a class="btn" href="#/quiz">Quiz across all books</a></p>`;
}

const tocRow = (c) => `<li><a href="${chapterHref(c)}">
  <span class="n">${c.number ?? '★'}</span>
  <span class="t"><b>${esc(c.title)}</b>${c.description ? `<span>${esc(c.description)}</span>` : ''}</span>
  ${c.view !== 'chapter' ? '<em class="tag">Interactive</em>' : ''}
</a></li>`;

export function viewBook(b) {
  layout('page');
  nav.here = null;
  const first = b.chapters.find((c) => c.number) ?? b.chapters[0];
  const nChapters = b.chapters.filter((c) => c.number).length;
  $app.innerHTML = `
    <nav class="crumbs"><a href="#/">Library</a> › <span>${esc(b.title)}</span></nav>
    <header class="cover" style="--book:${esc(b.color ?? '#003262')}">
      <p class="eyebrow">${esc(b.kicker ?? 'Textbook')}</p>
      <h1>${esc(b.title)}</h1>
      ${b.subtitle ? `<p class="dek">${esc(b.subtitle)}</p>` : ''}
      ${[].concat(b.preface ?? []).map((p) => `<p>${fmt(p)}</p>`).join('')}
      <div class="row">
        ${first ? `<a class="btn primary" href="${chapterHref(first)}">Start reading</a>` : ''}
        <a class="btn" href="#/quiz/${esc(b.id)}">Quiz this book</a>
        <span class="muted">${plural(nChapters, 'chapter')}</span>
      </div>
    </header>
    ${b.front.length ? `<section class="toc-part"><h2>Reference</h2><ol class="toc-list">${b.front.map(tocRow).join('')}</ol></section>` : ''}
    ${b.parts.map((p) => `<section class="toc-part">
      <h2><span>Part ${p.roman}</span> ${esc(p.title)}</h2>
      ${p.blurb ? `<p class="muted">${esc(p.blurb)}</p>` : ''}
      <ol class="toc-list">${p.chapters.map(tocRow).join('')}</ol></section>`).join('')}`;
}

/* ---------- chapter ---------- */

export function renderBlocks(list, R, ctx) {
  const kind = { key: ['Key idea', 'key'], warn: ['Common mistake', 'warn'], tip: ['In practice', 'tip'], note: ['Note', 'note'] };
  const content = (x) => (typeof x === 'string' ? `<p>${R(x)}</p>` : renderBlocks([].concat(x), R, ctx));
  const num = (kind) => `<b>${kind} ${ctx.ch.number ? `${ctx.ch.number}.` : ''}${++ctx[kind]}.</b> `;
  return list.map((b) => {
    if (typeof b === 'string') return `<p>${R(b)}</p>`;
    if (b.h) return `<h4 class="run">${fmt(b.h)}</h4>`;
    if (b.eq) return `<div class="eq">${[].concat(b.eq).map((l) => `<div>${fmt(l)}</div>`).join('')}${b.note ? `<span class="eq-note">${fmt(b.note)}</span>` : ''}</div>`;
    if (b.code != null) return `<figure class="code"><pre><code>${esc([].concat(b.code).join('\n'))}</code></pre>${b.caption ? `<figcaption>${fmt(b.caption)}</figcaption>` : ''}</figure>`;
    if (b.exercise) {
      const x = b.exercise;
      const lines = (v) => esc([].concat(v ?? []).join('\n'));
      return `<div class="exercise" data-ex="${esc(JSON.stringify(x))}">
        <div class="box-head">Try it${x.title ? ` · ${fmt(x.title)}` : ''}</div>
        <div class="ex-prompt">${[].concat(x.prompt).map((t) => `<p>${R(t)}</p>`).join('')}</div>
        <pre class="ex-starter"><code>${lines(x.starter)}</code></pre>
        <div class="ex-bar" hidden><button class="btn primary" data-act="run">Run</button><button class="btn" data-act="check">Check</button><button class="btn" data-act="reset">Reset</button><span class="ex-status muted"></span></div>
        <div class="ex-out" hidden></div>
        ${x.hint ? `<details class="ex-hint"><summary>Hint</summary><p>${R(x.hint)}</p></details>` : ''}
        <details class="ex-sol"><summary>Show a solution</summary><pre><code>${lines(x.solution)}</code></pre></details>
      </div>`;
    }
    if (b.list) { const t = b.ordered ? 'ol' : 'ul'; return `<${t}>${b.list.map((x) => `<li>${R(x)}</li>`).join('')}</${t}>`; }
    if (b.facts) return `<dl class="terms">${b.facts.map(([k, v]) => `<dt>${fmt(k)}</dt><dd>${R(v)}</dd>`).join('')}</dl>`;
    if (b.eqs) return `<ul class="eqs">${b.eqs.map(([e, n]) => `<li><span class="eq-line">${fmt(e)}</span>${n ? ` <span class="muted">· ${R(n)}</span>` : ''}</li>`).join('')}</ul>`;
    if (b.def) return `<div class="def"><b>${fmt(b.def[0])}</b> ${R(b.def[1])}</div>`;
    if (b.table) {
      const t = b.table;
      return `<figure class="tbl"><table>${t.head ? `<thead><tr>${t.head.map((h) => `<th>${fmt(h)}</th>`).join('')}</tr></thead>` : ''}
        <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${R(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${t.caption ? `<figcaption>${num('Table')}${fmt(t.caption)}</figcaption>` : ''}</figure>`;
    }
    if (b.svg) return `<figure class="fig">${b.svg}${b.caption ? `<figcaption>${num('Figure')}${fmt(b.caption)}</figcaption>` : ''}</figure>`;
    if (b.example) {
      const e = b.example;
      return `<div class="example"><div class="box-head">Worked example${e.title ? ` · ${fmt(e.title)}` : ''}</div>
        <div class="ex-problem">${content(e.problem)}</div>
        <div class="ex-solution"><b class="sol">Solution</b>${content(e.solution)}</div></div>`;
    }
    for (const k of Object.keys(kind)) {
      if (b[k] != null) return `<aside class="callout ${kind[k][1]}"><div class="box-head">${esc(b.title ?? kind[k][0])}</div>${content(b[k])}</aside>`;
    }
    return '';
  }).join('');
}

function questionHtml(q) {
  const opts = q.wrong?.length >= 3 ? shuffle([q.a, ...q.wrong]) : null;
  const answer = `<div class="cq-fb" hidden><p><b>Answer:</b> ${fmt(q.a)}</p>${q.why ? `<p>${fmt(q.why)}</p>` : ''}</div>`;
  return `<div class="cq"><p class="cq-q">${fmt(q.q)}</p>
    ${opts
      ? `<div class="cq-opts">${opts.map((o) => `<button class="cq-opt" data-ok="${o === q.a ? 1 : 0}">${fmt(o)}</button>`).join('')}</div>`
      : '<button class="cq-show">Show answer</button>'}
    ${answer}</div>`;
}

function sectionHtml(s, depth, ctx) {
  const tag = depth === 0 ? 'h2' : 'h3';
  const R = (t) => inline(t, { self: s.key, seen: ctx.seen });
  return `<section class="sec d${depth}" id="s-${esc(s.id)}">
    <${tag}><span class="num">${s.num}</span> ${fmt(s.title)}</${tag}>
    ${s.lead ? `<p class="lead">${R(s.lead)}</p>` : ''}
    ${renderBlocks(s.body ?? [], R, ctx)}
    ${(s.subs ?? []).map((t) => sectionHtml(t, depth + 1, ctx)).join('')}
    ${s.check?.length ? `<details class="check"><summary>Check your understanding <span class="muted">· ${plural(s.check.length, 'question')}</span></summary>${s.check.map(questionHtml).join('')}</details>` : ''}
  </section>`;
}

function tocHtml(ch) {
  const b = ch.book;
  const row = (c) => (c === ch
    ? `<li class="cur"><a href="${chapterHref(c)}">${esc(chapterLabel(c))}</a>
        <ol class="secs">${c.sections.map((s) => `<li><a href="${s.href}" data-sec="s-${esc(s.id)}"><span>${s.num}</span> ${fmt(s.title)}</a></li>`).join('')}</ol></li>`
    : `<li><a href="${chapterHref(c)}">${esc(chapterLabel(c))}</a></li>`);
  return `<a class="toc-book" href="${bookHref(b)}">‹ ${esc(b.title)}</a>
    ${b.front.length ? `<h4>Reference</h4><ol>${b.front.map(row).join('')}</ol>` : ''}
    ${b.parts.map((p) => `<details ${p === ch.part ? 'open' : ''}><summary>Part ${p.roman} · ${esc(p.title)}</summary><ol>${p.chapters.map(row).join('')}</ol></details>`).join('')}`;
}

export function viewChapter(ch, sectionId, restoreY) {
  layout('reader');
  nav.here = ch.title;
  const nums = { ch, Table: 0, Figure: 0, seen: new Set() };
  const ctxFor = () => { nums.seen = new Set(); return nums; }; // links are limited to one per target per top-level section
  const fromBtn = nav.from ? `<button class="backpill" id="backpill">← Back to ${esc(nav.from.label)}</button>` : '';
  const pn = (c, dir) => (c ? `<a class="pn ${dir}" href="${chapterHref(c)}"><small>${dir === 'prev' ? '← Previous' : 'Next →'}</small><b>${esc(chapterLabel(c))}</b></a>` : '<span></span>');

  $app.innerHTML = `
    <div class="reader-layout">
      <nav class="toc" id="toc" aria-label="Contents">${tocHtml(ch)}</nav>
      <article class="chapter" data-key="${esc(ch.book.id)}/${esc(ch.id)}">
        <nav class="crumbs"><a href="#/">Library</a> › <a href="${bookHref(ch.book)}">${esc(ch.book.title)}</a>${ch.part ? ` › <span>Part ${ch.part.roman}: ${esc(ch.part.title)}</span>` : ''}</nav>
        <header class="ch-head">
          <p class="eyebrow">${esc(ch.label)}</p>
          <h1>${fmt(ch.title)}</h1>
          ${ch.description ? `<p class="dek">${fmt(ch.description)}</p>` : ''}
        </header>
        ${ch.overview.length ? `<div class="overview">${ch.overview.map((p) => `<p>${inline(p, { self: `${ch.book.id}/${ch.id}` })}</p>`).join('')}</div>` : ''}
        ${ch.objectives.length ? `<aside class="objectives"><div class="box-head">After this chapter you can</div><ul>${ch.objectives.map((o) => `<li>${fmt(o)}</li>`).join('')}</ul></aside>` : ''}
        ${ch.sections.map((s) => sectionHtml(s, 0, ctxFor())).join('')}
        ${ch.summary.length ? `<section class="summary"><h2>Chapter summary</h2><ul>${ch.summary.map((x) => `<li>${inline(x, { book: ch.book.id })}</li>`).join('')}</ul></section>` : ''}
        ${ch.problems.length ? `<section class="problems"><h2>Problems</h2><ol>${ch.problems.map((p, i) => `<li>
            <div class="prob-q">${renderBlocks([].concat(p.q), (t) => inline(t, { book: ch.book.id }), nums)}</div>
            <details><summary>Solution</summary>${p.solution ? renderBlocks([].concat(p.solution), (t) => inline(t, { book: ch.book.id }), nums) : ''}<p><b>Answer:</b> ${fmt(p.a)}</p></details></li>`).join('')}</ol></section>` : ''}
        <footer class="ch-foot">
          ${ch.cards.length ? `<a class="btn" href="#/quiz/${esc(ch.book.id)}/${esc(ch.id)}">Quiz this chapter</a>` : ''}
          <div class="pns">${pn(ch.prev, 'prev')}${pn(ch.next, 'next')}</div>
        </footer>
      </article>
      <button class="toc-toggle" id="toc-toggle" aria-label="Contents">☰ Contents</button>
    </div>${fromBtn}`;

  wireChapter(ch);

  if (sectionId) {
    const el = $app.querySelector(`#s-${CSS.escape(sectionId)}`);
    if (el) {
      el.scrollIntoView();
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1800);
      return;
    }
  }
  window.scrollTo(0, restoreY ?? 0);
}

function wireChapter(ch) {
  const toc = $app.querySelector('#toc');
  $app.querySelector('#toc-toggle').onclick = () => toc.classList.toggle('open');
  toc.addEventListener('click', (e) => { if (e.target.closest('a')) toc.classList.remove('open'); });
  $app.querySelector('#backpill')?.addEventListener('click', () => history.back());

  mountExercises($app);

  // Check-your-understanding questions
  $app.querySelectorAll('.cq').forEach((box) => {
    const fb = box.querySelector('.cq-fb');
    box.querySelectorAll('.cq-opt').forEach((btn) => {
      btn.onclick = () => {
        const ok = btn.dataset.ok === '1';
        box.querySelectorAll('.cq-opt').forEach((o) => { o.disabled = true; if (o.dataset.ok === '1') o.classList.add('right'); });
        if (!ok) btn.classList.add('wrong');
        fb.hidden = false;
        fb.classList.add(ok ? 'good' : 'bad');
        fb.querySelector('p').insertAdjacentHTML('afterbegin', ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ');
      };
    });
    box.querySelector('.cq-show')?.addEventListener('click', (e) => { e.target.hidden = true; fb.hidden = false; });
  });

  // Highlight the section being read in the contents
  const links = new Map([...toc.querySelectorAll('a[data-sec]')].map((a) => [a.dataset.sec, a]));
  if (!links.size || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      links.forEach((a) => a.classList.remove('on'));
      links.get(en.target.id)?.classList.add('on');
    }
  }, { rootMargin: '-10% 0px -80% 0px' });
  $app.querySelectorAll('.sec.d0').forEach((s) => obs.observe(s));
  ui.stopKeys = () => { obs.disconnect(); ui.stopKeys = () => {}; };
}

/* ---------- quiz scope ---------- */

export function viewQuiz(bookId, chapterId) {
  layout('page');
  nav.here = null;
  const books = bookId ? lib.books.filter((b) => b.id === bookId) : lib.books;
  if (!books.length) return viewShelf();
  const only = chapterId ? books[0].chapters.find((c) => c.id === chapterId) : null;
  const label = only ? only.title : books.length === 1 ? books[0].title : 'all books';
  const group = (title, chapters) => {
    const cs = chapters.filter((c) => c.cards.length);
    return cs.length ? `<div class="scope-group"><h3>${esc(title)}</h3><div class="checks">${cs.map((c) => `
      <label><input type="checkbox" name="ch" value="${esc(c.book.id)}/${esc(c.id)}" ${!only || only === c ? 'checked' : ''}> ${esc(chapterLabel(c))} <span class="muted">(${c.cards.length})</span></label>`).join('')}</div></div>` : '';
  };

  $app.innerHTML = `
    <nav class="crumbs"><a href="#/">Library</a>${books.length === 1 ? ` › <a href="${bookHref(books[0])}">${esc(books[0].title)}</a>` : ''}${only ? ` › <a href="${chapterHref(only)}">${esc(only.title)}</a>` : ''} › <span>Quiz</span></nav>
    <h1>Quiz</h1>
    <p class="muted">Questions come from what is written in ${esc(label)}. Choose what to include.</p>
    <div class="panel">
      <div class="row"><button class="small" id="all">Select all</button><button class="small" id="none">Select none</button></div>
      ${books.map((b) => `${books.length > 1 ? `<h2 class="scope-book">${esc(b.title)}</h2>` : ''}
        ${group('Reference', b.front)}${b.parts.map((p) => group(`Part ${p.roman} · ${p.title}`, p.chapters)).join('')}`).join('')}
      <p><label>Format
        <select id="fmt"><option value="type">Type the answer</option><option value="mc">Multiple choice</option></select></label>
        <label>Questions <input type="number" id="cnt" min="1" max="200" value="${only ? Math.min(10, only.cards.length) : 20}"></label>
        <span class="muted" id="pool"></span></p>
      <div class="row"><button class="primary" id="go">Start quiz</button><button id="flash">Flashcards</button></div>
    </div>`;

  const pool = () => {
    const picked = new Set([...$app.querySelectorAll('input[name=ch]:checked')].map((x) => x.value));
    return lib.chapters.filter((c) => picked.has(`${c.book.id}/${c.id}`)).flatMap((c) => c.cards);
  };
  const refresh = () => {
    const n = pool().length;
    $app.querySelector('#pool').textContent = `${plural(n, 'question')} available`;
    $app.querySelector('#go').disabled = $app.querySelector('#flash').disabled = n === 0;
  };
  refresh();
  $app.querySelectorAll('input[name=ch]').forEach((x) => { x.onchange = refresh; });
  const setAll = (v) => { $app.querySelectorAll('input[name=ch]').forEach((x) => { x.checked = v; }); refresh(); };
  $app.querySelector('#all').onclick = () => setAll(true);
  $app.querySelector('#none').onclick = () => setAll(false);

  const count = () => Math.max(1, Number($app.querySelector('#cnt').value) || 20);
  const back = () => viewQuiz(bookId, chapterId);
  $app.querySelector('#go').onclick = () => {
    const cards = pickCards(pool(), count());
    if (cards.length) runQuiz({ cards, format: $app.querySelector('#fmt').value, onExit: back });
  };
  $app.querySelector('#flash').onclick = () => {
    const cards = pickCards(pool(), count());
    if (cards.length) runFlashcards({ cards, onExit: back });
  };
}

export const notFound = () => {
  layout('page');
  $app.innerHTML = '<p>Not found. <a href="#/">Back to the library</a></p>';
};
