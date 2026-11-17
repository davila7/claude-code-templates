// In-page checks for check_ui.mjs. Playwright serializes each function and runs
// it inside the page, so they must not reference anything outside their body.

// Runs in the page: static DOM heuristics.
export function auditDom() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const describe = (el) => {
    let tag = el.tagName.toLowerCase();
    if (el.id) tag += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) {
      tag += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return '<' + tag + '>' + (text ? ' "' + text + '"' : '');
  };
  const accName = (el) => {
    const by = el.getAttribute('aria-labelledby');
    if (by) return by.split(/\s+/).map((i) => document.getElementById(i)?.textContent || '').join(' ').trim();
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.labels && el.labels.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
    const imgAlt = [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ');
    return ((el.textContent || '') + ' ' + imgAlt + ' ' + (el.getAttribute('title') || '')).trim();
  };
  const issues = [];
  const interactive = 'button, a[href], [role="button"], [role="link"], [role="tab"], [role="menuitem"], summary';
  const named = new Map();
  for (const el of document.querySelectorAll(interactive)) {
    if (!visible(el)) continue;
    const name = accName(el);
    if (!name) issues.push('no accessible name: ' + describe(el));
    else named.set(name, (named.get(name) || 0) + 1);
  }
  for (const [name, n] of named) {
    if (n > 2 && name.length < 25) {
      issues.push(n + ' controls share the name "' + name + '" (say which item each one acts on)');
    }
  }
  for (const el of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
    if (!visible(el)) continue;
    const label = accName(el);
    if (!label || label === (el.getAttribute('title') || '').trim()) {
      issues.push('input without label: ' + describe(el) + ' (placeholder is not a label)');
    }
    const standalone = ['checkbox', 'radio', 'search', 'range'].includes(el.type);
    if (el.tagName === 'INPUT' && !el.closest('form') && !standalone) {
      issues.push('input outside a <form> (Enter will not submit): ' + describe(el));
    }
  }
  for (const img of document.querySelectorAll('img')) {
    if (!img.hasAttribute('alt')) issues.push('img without alt: ' + img.getAttribute('src'));
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      issues.push('img without width/height (layout shift): ' + img.getAttribute('src'));
    }
  }
  const nativeOk = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY|OPTION)$/;
  for (const el of document.querySelectorAll('body *')) {
    if (nativeOk.test(el.tagName) || el.closest('a,button,label,summary')) continue;
    if (el.getAttribute('role') || el.hasAttribute('tabindex')) continue;
    if (getComputedStyle(el).cursor === 'pointer' && visible(el)) {
      issues.push('clickable-looking non-interactive element (use <button> or <a>): ' + describe(el));
      if (issues.length > 60) break;
    }
  }
  const h1 = document.querySelectorAll('h1').length;
  if (h1 !== 1) issues.push(h1 + ' <h1> elements on the page (expected 1)');
  const doc = document.documentElement;
  const overflowPx = doc.scrollWidth - doc.clientWidth;
  const wide = [];
  if (overflowPx > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > doc.clientWidth + 1 && visible(el)) wide.push(describe(el) + ' ends at ' + Math.round(r.right) + 'px');
      if (wide.length >= 5) break;
    }
  }
  return { overflowPx, overflowingElements: wide, issues };
}

// Runs in the page: describes the focused element.
export function focusStop() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
  const ring = outline || (s.boxShadow && s.boxShadow !== 'none');
  const raw = el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '';
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 50);
  const key = el.tagName + '|' + name + '|' + Math.round(el.getBoundingClientRect().top);
  const role = el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : '';
  return { key, el: el.tagName.toLowerCase() + role, name, visibleFocus: !!ring };
}
