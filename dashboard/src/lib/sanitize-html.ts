import xss from 'xss';

// xss is CommonJS: Node's ESM loader only exposes its default export
const { FilterXSS, getDefaultWhiteList, escapeAttrValue } = xss;

/**
 * Sanitizer for HTML rendered from component markdown.
 *
 * Component content is contributor-written and is rendered on the same origin
 * as Clerk, so the output of `marked` must never reach `dangerouslySetInnerHTML`
 * unfiltered. `xss` is pure JS, so the same filter runs during SSR on the
 * Workers runtime and in the browser (DOMPurify needs a DOM and returns its
 * input unchanged during SSR).
 *
 * Keeps the formatting components actually use (tables, images, details,
 * figures, task lists) and strips scripts, event handlers and javascript: URLs.
 * Unknown tags such as the agents' <example>/<commentary> are dropped but their
 * text is kept, which is how the browser already showed them.
 */
const whiteList = getDefaultWhiteList();
for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
  whiteList[h] = [...(whiteList[h] || []), 'id'];
}
whiteList.input = ['type', 'checked', 'disabled'];

const filter = new FilterXSS({
  whiteList,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  onIgnoreTagAttr(_tag, name, value) {
    // Styling hooks emitted by our marked renderers (md-heading, md-code-block, language-*)
    if (name === 'class') return `class="${escapeAttrValue(value)}"`;
    return undefined;
  },
});

export function sanitizeHtml(html: string): string {
  return filter.process(html);
}

/** Escape text for use inside an HTML attribute or element body. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** First word of a fenced block's info string (`ts title="x"` -> `ts`), escaped. */
export function codeLang(lang?: string): string {
  return escapeHtml((lang || '').trim().split(/\s+/)[0] || '');
}

/**
 * JSON for an inline <script type="application/json|ld+json"> body. Plain
 * JSON.stringify leaves `</script>` intact, so contributor text in a component's
 * frontmatter could close the tag and inject markup.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
