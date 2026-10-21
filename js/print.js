// Print edition: lays out one whole book as pages, ready to save as a PDF for a paperback.
// Opened by scripts/export-pdf.mjs as print.html?book=<id>&trim=7x10&gutter=0.625.
// Everything comes from the same data files as the site, so re-exporting picks up new content.
//
// Questions stay in the chapters; their answers, explanations and the worked solutions
// to the problems go in an answer key at the back. Interactive chapters point to the website.

import { lib, loadData } from './data.js';
import { renderBlocks } from './reader.js';
import { esc } from './util.js';
import { fmt } from './terms.js';

const SITE = 'https://lucwells.github.io/luc-learning/';
const TRIMS = { '6x9': [6, 9], '7x10': [7, 10], '8.5x11': [8.5, 11] };

const params = new URLSearchParams(location.search);
const status = { done: false, pages: 0, error: null };
window.printStatus = status;

const walk = (list, fn) => list.forEach((s) => { fn(s); walk(s.subs ?? [], fn); });
const para = (x) => `<p>${fmt(x)}</p>`;
const blocks = (x, ctx) => renderBlocks([].concat(x), fmt, ctx);
const isMC = (q) => q.wrong?.length >= 3;

// Same option order every export, so the letters in the answer key never drift.
function options(q) {
  let seed = 2166136261; // FNV-1a hash of the question seeds a mulberry32 generator
  for (const c of q.q) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const opts = [q.a, ...q.wrong];
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return opts;
}
const letter = (i) => String.fromCharCode(65 + i);

/* ---------- front matter ---------- */

function titlePage(b) {
  return `<section class="title-page">
    <p class="kicker">${esc(b.kicker ?? 'Textbook')}</p>
    <h1>${esc(b.title)}</h1>
    ${b.subtitle ? `<p class="subtitle">${fmt(b.subtitle)}</p>` : ''}
    ${b.author ? `<p class="author">${esc(b.author)}</p>` : ''}
    <p class="site">Interactive edition: ${esc(SITE)}</p>
  </section>
  <section class="copyright">
    <p>Copyright © ${new Date().getFullYear()}${b.author ? ` ${esc(b.author)}` : ''}. All rights reserved.</p>
    <p>The interactive edition of this book, with quizzes and reference tools, is at ${esc(SITE)}.</p>
    <p>Printed edition generated ${new Date().toISOString().slice(0, 10)}.</p>
  </section>`;
}

function contents(b, printed) {
  const row = (c) => `<li><a href="#ch-${esc(c.id)}"><span class="n">${c.number ?? ''}</span><span class="t">${fmt(c.title)}</span><span class="dots"></span></a></li>`;
  return `<section class="contents"><h1>Contents</h1>
    <ol>
      <li class="front"><a href="#preface"><span class="t">Preface</span><span class="dots"></span></a></li>
      ${b.front.filter(printed).map(row).join('')}
      ${b.parts.map((p) => `<li class="part"><a href="#part-${p.roman}"><span class="t">Part ${p.roman} · ${esc(p.title)}</span><span class="dots"></span></a></li>
        ${p.chapters.filter(printed).map(row).join('')}`).join('')}
      <li class="front"><a href="#answers"><span class="t">Answers and Solutions</span><span class="dots"></span></a></li>
    </ol></section>`;
}

function preface(b) {
  const online = b.chapters.filter((c) => c.view !== 'chapter');
  return `<section class="preface" id="preface"><h1>Preface</h1>
    ${[].concat(b.preface ?? []).map(para).join('')}
    <h2>How to use this book</h2>
    <p>Each section ends with questions to check your understanding, and each chapter ends with problems. Answers to every question, with explanations, and full worked solutions to every problem are in <b>Answers and Solutions</b> at the back of the book. Try each one before you look.</p>
    <p>The interactive edition at ${esc(SITE)} has the same chapters, plus quizzes that give instant feedback.</p>
    ${online.length ? `<p>These reference tools are online only:</p><ul>${online.map((c) => `<li>${fmt(c.title)}: ${esc(`${SITE}#/${b.id}/${c.id}`)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

/* ---------- chapters ---------- */

function checks(s) {
  if (!s.check?.length) return '';
  return `<div class="checks"><h4>Check your understanding</h4><ol>${s.check.map((q) => `<li><p>${fmt(q.q)}</p>
    ${isMC(q) ? `<ol class="opts">${options(q).map((o, i) => `<li><b>${letter(i)}.</b> ${fmt(o)}</li>`).join('')}</ol>` : ''}</li>`).join('')}</ol></div>`;
}

function section(s, depth, ctx) {
  const tag = depth === 0 ? 'h2' : 'h3';
  return `<section class="sec d${depth}">
    <${tag}><span class="num">${s.num}</span> ${fmt(s.title)}</${tag}>
    ${s.lead ? `<p class="lead">${fmt(s.lead)}</p>` : ''}
    ${renderBlocks(s.body ?? [], fmt, ctx)}
    ${(s.subs ?? []).map((t) => section(t, depth + 1, ctx)).join('')}
    ${checks(s)}
  </section>`;
}

function chapter(ch) {
  const head = `<p class="ch-label">${esc(ch.label)}</p><h1>${fmt(ch.title)}</h1>${ch.description ? `<p class="dek">${fmt(ch.description)}</p>` : ''}`;
  if (ch.view !== 'chapter') {
    return `<section class="chapter" id="ch-${esc(ch.id)}">${head}
      <p>This chapter is interactive. Use it online at ${esc(`${SITE}#/${ch.book.id}/${ch.id}`)}.</p></section>`;
  }
  ch.printCtx = { ch, Table: 0, Figure: 0 };
  return `<section class="chapter" id="ch-${esc(ch.id)}">${head}
    ${ch.overview.map(para).join('')}
    ${ch.objectives.length ? `<aside class="objectives"><div class="box-head">After this chapter you can</div><ul>${ch.objectives.map((o) => `<li>${fmt(o)}</li>`).join('')}</ul></aside>` : ''}
    ${ch.sections.map((s) => section(s, 0, ch.printCtx)).join('')}
    ${ch.summary.length ? `<section class="summary"><h2>Chapter summary</h2><ul>${ch.summary.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul></section>` : ''}
    ${ch.problems.length ? `<section class="problems"><h2>Problems</h2><ol>${ch.problems.map((p) => `<li>${blocks(p.q, ch.printCtx)}</li>`).join('')}</ol></section>` : ''}
  </section>`;
}

function part(p) {
  return `<section class="part" id="part-${p.roman}"><p class="part-label">Part ${p.roman}</p><h1>${esc(p.title)}</h1>
    ${p.blurb ? `<p class="dek">${fmt(p.blurb)}</p>` : ''}</section>`;
}

/* ---------- answer key ---------- */

function answers(chapters) {
  const answer = (q) => `<li>${isMC(q) ? `<b>${letter(options(q).indexOf(q.a))}.</b> ` : ''}${fmt(q.a)}${q.why ? ` <span class="why">${fmt(q.why)}</span>` : ''}</li>`;
  const body = chapters.filter((ch) => ch.view === 'chapter').map((ch) => {
    const secs = [];
    walk(ch.sections, (s) => { if (s.check?.length) secs.push(`<h3>${s.num} ${fmt(s.title)}</h3><ol>${s.check.map(answer).join('')}</ol>`); });
    const probs = ch.problems.length ? `<h3>Problems</h3><ol class="solutions">${ch.problems.map((p) => `<li>
      ${p.solution ? blocks(p.solution, ch.printCtx) : ''}<p><b>Answer:</b> ${fmt(p.a)}</p></li>`).join('')}</ol>` : '';
    if (!secs.length && !probs) return '';
    return `<section class="ans-chapter"><h2>${esc(ch.number ? `Chapter ${ch.number}` : ch.label)} · ${fmt(ch.title)}</h2>${secs.join('')}${probs}</section>`;
  }).join('');
  return `<section class="answers" id="answers"><h1>Answers and Solutions</h1>${body}</section>`;
}

/* ---------- pages ---------- */

// Page geometry goes in before Paged.js reads the stylesheets.
function pageStyle(b) {
  const [w, h] = TRIMS[params.get('trim')] ?? TRIMS['7x10'];
  const gutter = Number(params.get('gutter')) || 0.625;
  const outside = 0.6;
  const style = document.createElement('style');
  style.textContent = `
    @page { size: ${w}in ${h}in; margin: 0.8in ${outside}in 0.8in;
      @bottom-center { content: counter(page); } }
    @page :left { margin-left: ${outside}in; margin-right: ${gutter}in;
      @top-left { content: ${JSON.stringify(b.title)}; } }
    @page :right { margin-left: ${gutter}in; margin-right: ${outside}in;
      @top-right { content: string(chapter); } }
    @page :blank { @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }
    @page front { @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }
    @page chapter:first { @top-left { content: none; } @top-right { content: none; } }`;
  document.head.appendChild(style);
}

async function main() {
  await loadData();
  const b = lib.bookById.get(params.get('book'));
  if (!b) throw new Error(`No book "${params.get('book')}". Books: ${lib.books.map((x) => x.id).join(', ')}`);
  document.title = b.title;
  // Interactive reference pages are listed in the preface; numbered interactive chapters keep a stub page.
  const printed = (c) => c.view === 'chapter' || c.number;

  document.body.innerHTML = titlePage(b) + contents(b, printed) + preface(b)
    + b.front.filter(printed).map(chapter).join('')
    + b.parts.map((p) => part(p) + p.chapters.filter(printed).map(chapter).join('')).join('')
    + answers(b.chapters);
  pageStyle(b);
  await document.fonts.ready;

  class Progress extends window.Paged.Handler {
    afterPageLayout() { status.pages++; }
  }
  window.Paged.registerHandlers(Progress);
  const flow = await window.PagedPolyfill.preview();
  status.pages = flow.total;
  status.done = true;
}

main().catch((e) => { status.error = e.message; console.error(e); });
