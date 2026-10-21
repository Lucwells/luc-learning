// Job Search Guide: a page built from data/job-search.json (skills and study plan only, no application details).

import { $app, nav, esc, layout } from './util.js';
import { fmt } from './terms.js';

let cache = null;
const load = () => (cache ??= fetch('data/job-search.json').then((r) => {
  if (!r.ok) throw new Error(`job-search.json: ${r.status}`);
  return r.json();
}));

const list = (items) => `<ul>${items.map((t) => `<li>${fmt(t)}</li>`).join('')}</ul>`;

const track = (t) => `<section class="job-card">
  <h3>${esc(t.title)}</h3>
  <p class="job-roles">${t.roles.map((r) => `<span>${esc(r)}</span>`).join('')}</p>
  <h4>What postings ask for</h4>
  ${list(t.asks)}
  ${t.study.length ? `<h4>Learn it here</h4><ul class="job-study">${t.study.map((s) => `<li><a href="${esc(s.href)}">${esc(s.label)}</a></li>`).join('')}</ul>` : ''}
  ${t.coming ? `<p class="muted job-coming">${esc(t.coming)}</p>` : ''}
</section>`;

export async function viewJobSearch() {
  layout('page');
  nav.here = null;
  document.title = 'Job Search Guide · Luc Learning';
  $app.innerHTML = '<p class="muted">Loading…</p>';
  let d;
  try { d = await load(); } catch (e) { $app.innerHTML = `<p class="muted">Could not load the job search guide. ${esc(e.message)}</p>`; return; }
  $app.innerHTML = `
    <nav class="crumbs"><a href="#/">Library</a> › <span>${esc(d.title)}</span></nav>
    <header class="cover" style="--book:#7a4e9e">
      <p class="eyebrow">Career</p>
      <h1>${esc(d.title)}</h1>
      <p class="dek">${esc(d.dek)}</p>
      ${d.intro.map((p) => `<p>${fmt(p)}</p>`).join('')}
    </header>
    <section class="toc-part"><h2>Target tracks</h2><div class="job-grid">${d.tracks.map(track).join('')}</div></section>
    <section class="toc-part"><h2>Gaps, ranked</h2>
      <ol class="job-gaps">${d.gaps.map((g) => `<li><b>${esc(g.title)}.</b> ${fmt(g.detail)}</li>`).join('')}</ol>
    </section>
    <section class="toc-part"><h2>Ready for an interview when you can</h2>${list(d.ready)}</section>`;
}
