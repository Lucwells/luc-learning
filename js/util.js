// Shared helpers and UI plumbing.
export const $app = document.getElementById('app');

// Teardown hooks for the current screen (key listeners, open modal). Replaced by the screens that need them.
export const ui = { stopKeys: () => {}, stopModal: () => {} };

export const layout = (name) => { $app.dataset.layout = name; };

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const slug = (c) => c.toLowerCase().replace(/[^a-z]+/g, '-');

// Lowercase, strip accents/punctuation, so "Washington, D.C." == "washington dc".
export const norm = (s) => String(s)
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[.'’ʻ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\bst\b/g, 'saint')
  .replace(/^the /, '');

export function lev(a, b) {
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

export function check(card, input) {
  const n = norm(input);
  if (!n) return false;
  return [card.a, ...card.alts].some((ans) => {
    const m = norm(ans);
    return n === m || (m.length >= 7 && lev(n, m) <= 1); // forgive one typo on longer answers
  });
}

export function mountModal(html, { onKey, onClose } = {}) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  const close = onClose ?? (() => ui.stopModal());
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('.close').onclick = close;
  const key = (e) => { if (e.key === 'Escape') close(); else onKey?.(e); };
  window.addEventListener('keydown', key);
  ui.stopModal = () => { window.removeEventListener('keydown', key); modal.remove(); ui.stopModal = () => {}; };
  return modal;
}

/* ---------- navigation ---------- */
// Hash routes, but links are handled here so scroll position survives Back/Forward
// and a term link can offer a "back to where you were" button.

export const nav = { idx: 0, memo: new Map(), from: null, route: () => {} };

export function navigate(href, { replace = false, from = null } = {}) {
  const target = href.startsWith('#') ? href : `#${href}`;
  if (target === location.hash) return;
  nav.memo.set(nav.idx, window.scrollY);
  nav.from = from;
  if (replace) history.replaceState({ i: nav.idx }, '', target);
  else history.pushState({ i: ++nav.idx }, '', target);
  nav.route();
}
