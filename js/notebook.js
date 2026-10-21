// Notebook-style exercises: type Python in the page and run it in the browser with Pyodide (WebAssembly).
// An exercise block in a chapter is rendered as static HTML by reader.js; mountExercises() makes it interactive.
// Nothing is sent to a server and nothing is saved.

import { esc } from './util.js';

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

let loading = null;    // promise of the Pyodide instance
const loaded = new Set();
const kernels = new Map(); // one shared namespace per chapter, like a notebook kernel

const HELPER = `
import sys, io, ast, traceback, base64

def _luc_run(code, ns):
    out = io.StringIO()
    old = (sys.stdout, sys.stderr)
    sys.stdout = sys.stderr = out
    err = None
    try:
        tree = ast.parse(code)
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, '<cell>', 'exec'), ns)
        if last is not None:
            v = eval(compile(last, '<cell>', 'eval'), ns)
            if v is not None:
                print(v.to_string() if hasattr(v, 'to_string') else repr(v))
    except BaseException:
        err = ''.join(traceback.format_exc(limit=-4).splitlines(True))
    finally:
        sys.stdout, sys.stderr = old
    figs = []
    if 'matplotlib.pyplot' in sys.modules:
        plt = sys.modules['matplotlib.pyplot']
        for n in plt.get_fignums():
            buf = io.BytesIO()
            plt.figure(n).savefig(buf, format='png', dpi=110, bbox_inches='tight')
            figs.append(base64.b64encode(buf.getvalue()).decode())
        plt.close('all')
    return [out.getvalue(), err, figs]
`;

function loadScript(src) {
  return new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => bad(new Error('Could not load Python from the network. Check your connection.'));
    document.head.appendChild(s);
  });
}

async function getPyodide(status) {
  if (!loading) {
    loading = (async () => {
      status('Loading Python (first run only, can take a minute)…');
      await loadScript(`${PYODIDE}pyodide.js`);
      const py = await window.loadPyodide({ indexURL: PYODIDE });
      py.runPython(HELPER);
      return py;
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

async function ensurePackages(py, pkgs, status) {
  const need = pkgs.filter((p) => !loaded.has(p));
  if (!need.length) return;
  status(`Loading ${need.join(', ')}…`);
  await py.loadPackage(need);
  need.forEach((p) => loaded.add(p));
  if (need.includes('matplotlib')) py.runPython("import matplotlib; matplotlib.use('agg')");
}

function kernel(py, key) {
  if (!kernels.has(key)) kernels.set(key, py.globals.get('dict')());
  return kernels.get(key);
}

function exec(py, code, ns) {
  const r = py.globals.get('_luc_run')(code, ns);
  const [out, err, figs] = r.toJs();
  r.destroy?.();
  return { out, err, figs };
}

// Runs the exercise's hidden setup once per kernel, then the learner's code. Returns { out, err, figs }.
async function run(ex, code, key, status) {
  const py = await getPyodide(status);
  await ensurePackages(py, ex.packages?.length ? ex.packages : ['numpy', 'pandas'], status);
  const ns = kernel(py, key);
  status('Running…');
  for (const [name, text] of Object.entries(ex.files ?? {})) py.FS.writeFile(name, text);
  if (ex.setup?.length) {
    const s = exec(py, [].concat(ex.setup).join('\n'), ns);
    if (s.err) return { out: '', err: `Exercise setup failed:\n${s.err}`, figs: [] };
  }
  return exec(py, code, ns);
}

async function check(ex, code, key, status) {
  const res = await run(ex, code, key, status);
  if (res.err) return { res, ok: false, msg: null };
  const py = await getPyodide(status);
  const c = exec(py, [].concat(ex.check).join('\n'), kernel(py, key));
  if (!c.err) return { res, ok: true, msg: null };
  const last = c.err.trim().split('\n').pop();
  const nm = last.match(/NameError: name '(.+)' is not defined/);
  if (nm) return { res, ok: false, msg: `Your code needs to define a variable named ${nm[1]}. Run the earlier steps first if it comes from one.` };
  return { res, ok: false, msg: last.replace(/^AssertionError:?\s*/, '') || 'Not quite. Check your result against the prompt.' };
}

// For authors: runs the solution and check of one exercise in a fresh kernel. Used by the page console and tests.
export async function selfTest(ex) {
  const status = () => {};
  const key = `selftest-${ex.id}-${Math.random()}`;
  const r = await check(ex, [].concat(ex.solution).join('\n'), key, status);
  return { id: ex.id, ok: r.ok, msg: r.msg, err: r.res.err };
}
// Runs a list of exercises in order in one kernel (project steps depend on earlier steps).
export async function selfTestChain(list) {
  const key = `chain-${Math.random()}`;
  const out = [];
  for (const ex of list) {
    const r = await check(ex, [].concat(ex.solution).join('\n'), key, () => {});
    out.push({ id: ex.id, ok: r.ok, msg: r.msg, err: r.res.err });
  }
  return out;
}
window.__lucSelfTest = selfTest;
window.__lucSelfTestChain = selfTestChain;

function showResult(box, res, verdict) {
  const out = box.querySelector('.ex-out');
  out.hidden = false;
  const figs = res.figs.map((b) => `<img alt="Plot output" src="data:image/png;base64,${b}">`).join('');
  out.innerHTML = `${res.out ? `<pre>${esc(res.out)}</pre>` : ''}${res.err ? `<pre class="ex-err">${esc(res.err)}</pre>` : ''}${figs}${verdict ?? ''}`;
  if (!res.out && !res.err && !figs && !verdict) out.innerHTML = '<span class="muted">Ran with no output. Use print(...) or end with a value to see it.</span>';
}

export function mountExercises(root) {
  root.querySelectorAll('.exercise').forEach((box) => {
    const ex = JSON.parse(box.dataset.ex);
    const key = box.closest('.chapter')?.dataset.key ?? 'page';
    const starter = [].concat(ex.starter ?? []).join('\n');
    const pre = box.querySelector('.ex-starter');
    const ta = document.createElement('textarea');
    ta.className = 'ex-code'; ta.spellcheck = false; ta.autocapitalize = 'off'; ta.value = starter;
    ta.rows = Math.max(7, starter.split('\n').length + 3);
    ta.setAttribute('aria-label', 'Python code');
    pre.replaceWith(ta);

    const bar = box.querySelector('.ex-bar');
    bar.hidden = false;
    const status = box.querySelector('.ex-status');
    const setStatus = (t) => { status.textContent = t; };
    const btns = bar.querySelectorAll('button');
    const busy = (b) => btns.forEach((x) => { x.disabled = b; });

    const go = async (mode) => {
      busy(true); setStatus('');
      try {
        if (mode === 'run') showResult(box, await run(ex, ta.value, key, setStatus));
        else {
          const r = await check(ex, ta.value, key, setStatus);
          const verdict = r.ok
            ? '<p class="ex-ok">✓ Correct. Your code does what the exercise asks.</p>'
            : (r.msg ? `<p class="ex-no">✗ ${esc(r.msg)}</p>` : '');
          showResult(box, r.res, verdict);
        }
      } catch (e) {
        showResult(box, { out: '', err: String(e.message ?? e), figs: [] });
      }
      setStatus(''); busy(false);
    };
    bar.querySelector('[data-act=run]').onclick = () => go('run');
    bar.querySelector('[data-act=check]').onclick = () => go('check');
    bar.querySelector('[data-act=reset]').onclick = () => { ta.value = starter; };
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: a, selectionEnd: b } = ta;
        ta.setRangeText('    ', a, b, 'end');
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go('run'); }
    });
  });
}
