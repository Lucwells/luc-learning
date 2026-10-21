// Export a book as a print-ready PDF for a paperback (Amazon KDP or any print-on-demand service).
//
//   npm run pdf -- chemistry              -> dist/chemistry-7x10.pdf
//   npm run pdf -- chemistry --trim 6x9   (6x9, 7x10 or 8.5x11)
//
// Lays the book out with print.html in a headless Edge or Chrome, then saves the pages.
// The inside margin (gutter) has to grow with the page count, so the book is laid out
// again whenever the count lands in a different KDP band. Set BROWSER to a Chrome or
// Edge executable if neither is found. Needs internet access for the fonts and Paged.js.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../serve.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const TRIMS = ['6x9', '7x10', '8.5x11'];
const MAX_PAGES = 828; // KDP's paperback limit for black-and-white interiors; some trims allow fewer

// KDP's minimum inside margin by page count, plus 1/8 in so text never runs into the spine.
const gutterFor = (pages) => 0.125 + (pages <= 150 ? 0.375 : pages <= 300 ? 0.5 : pages <= 500 ? 0.625 : pages <= 700 ? 0.75 : 0.875);

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : fallback; };
const trim = flag('--trim', '7x10');
const book = args[0];
if (!book || !TRIMS.includes(trim)) {
  console.error(`Usage: npm run pdf -- <book> [--trim ${TRIMS.join('|')}]`);
  process.exit(1);
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

function findBrowser() {
  const candidates = [
    process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome or Edge found. Set BROWSER to its executable.');
  return found;
}

// Minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error(`cannot connect to ${url}`)); });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.exceptionThrown') console.error('  page error:', msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') console.error('  page console:', msg.params.args.map((a) => a.value ?? a.description).join(' '));
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.fail(new Error(msg.error.message)); else p.ok(msg.result);
  };
  return {
    send: (method, params = {}) => new Promise((ok, fail) => { pending.set(++id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); }),
    close: () => ws.close(),
  };
}

async function launch() {
  const profile = await mkdtemp(join(tmpdir(), 'luc-print-'));
  const proc = spawn(findBrowser(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((ok, fail) => {
    let log = '';
    proc.stderr.on('data', (d) => { log += d; const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); });
    proc.on('exit', (code) => fail(new Error(`browser exited (${code}): ${log.slice(-500)}`)));
    setTimeout(() => fail(new Error('browser did not start within 30 s')), 30_000);
  });
  const targets = await (await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json/list`)).json();
  const page = await connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  const stop = async () => { page.close(); proc.kill(); await sleep(500); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  return { page, stop };
}

// Lay the book out and wait for Paged.js to finish. Returns the page count.
async function layOut(page, url) {
  await page.send('Page.navigate', { url });
  const started = Date.now();
  let last = -1;
  for (;;) {
    await sleep(1000);
    const { result } = await page.send('Runtime.evaluate', { expression: 'JSON.stringify(window.printStatus ?? null)', returnByValue: true });
    const s = JSON.parse(result.value ?? 'null');
    if (s?.error) throw new Error(s.error);
    if (s?.done) return s.pages;
    if (s && s.pages !== last && s.pages % 50 === 0 && s.pages) process.stdout.write(`  ${s.pages} pages…\n`);
    last = s?.pages ?? last;
    if (Date.now() - started > 20 * 60_000) throw new Error('layout took longer than 20 minutes');
  }
}

async function savePdf(page, file) {
  const { stream } = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, transferMode: 'ReturnAsStream' });
  const chunks = [];
  for (;;) {
    const r = await page.send('IO.read', { handle: stream, size: 4 << 20 });
    chunks.push(Buffer.from(r.data, r.base64Encoded ? 'base64' : 'utf8'));
    if (r.eof) break;
  }
  await page.send('IO.close', { handle: stream });
  const pdf = Buffer.concat(chunks);
  await writeFile(file, pdf);
  return pdf.length;
}

const server = await serve(0, '127.0.0.1');
const { page, stop } = await launch();
try {
  await page.send('Runtime.enable');
  const base = `http://127.0.0.1:${server.address().port}/print.html?book=${encodeURIComponent(book)}&trim=${trim}`;

  let gutter = 0.75;
  let pages;
  for (let pass = 1; pass <= 3; pass++) {
    console.log(`Laying out ${book} (${trim} in, gutter ${gutter} in), pass ${pass}…`);
    pages = await layOut(page, `${base}&gutter=${gutter}`);
    console.log(`  ${pages} pages`);
    if (gutterFor(pages) === gutter) break;
    gutter = gutterFor(pages);
  }

  await mkdir(join(root, 'dist'), { recursive: true });
  const file = join(root, 'dist', `${book}-${trim}.pdf`);
  const bytes = await savePdf(page, file);
  console.log(`Saved ${file} (${pages} pages, ${(bytes / 1e6).toFixed(1)} MB)`);
  if (pages > MAX_PAGES) console.warn(`Warning: ${pages} pages is over KDP's ${MAX_PAGES}-page paperback limit. Split the book into volumes.`);
  if (pages < 24) console.warn('Warning: KDP paperbacks need at least 24 pages.');
} finally {
  await stop();
  server.close();
}
