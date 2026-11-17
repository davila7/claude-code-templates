import xss from 'xss';

// xss is CommonJS: Node's ESM loader only exposes its default export
const { FilterXSS, getDefaultWhiteList, escapeAttrValue, safeAttrValue } = xss;

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

/** Where a document's relative links point: raw files for images, the repo page for links. */
export interface DocBase {
  raw: string;
  blob: string;
}

/**
 * A README read on aitmpl.com would resolve `docs/x.svg` against aitmpl.com (and
 * the filter drops such relative URLs anyway), so its images break and its links
 * go nowhere. With a base, relative `src`/`href` resolve against the component's
 * source: raw files for images, the GitHub page for links. Absolute URLs,
 * protocol-relative and root-relative paths, and `#anchors` stay as they are.
 */
export function resolveDocUrl(value: string, root: string): string {
  if (!value || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(value.trim())) return value;
  try {
    return new URL(value.trim(), root.endsWith('/') ? root : `${root}/`).href;
  } catch {
    return value;
  }
}

const options = {
  whiteList,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  onIgnoreTagAttr(_tag: string, name: string, value: string) {
    // Styling hooks emitted by our marked renderers (md-heading, md-code-block, language-*)
    if (name === 'class') return `class="${escapeAttrValue(value)}"`;
    return undefined;
  },
};
const filter = new FilterXSS(options);

export function sanitizeHtml(html: string, base?: DocBase | null): string {
  if (!base) return filter.process(html);
  return new FilterXSS({
    ...options,
    safeAttrValue(tag: string, name: string, value: string, cssFilter: unknown) {
      if (name === 'src' || name === 'href') {
        value = resolveDocUrl(value, tag === 'img' || name === 'src' ? base.raw : base.blob);
      }
      return safeAttrValue(tag, name, value, cssFilter as never);
    },
  }).process(html);
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

/**
 * A component page has one <h1>, its name. Raw <h1> tags written in a document
 * (READMEs with `<h1 align="center">`) become <h2>; markdown `#` headings are
 * already rendered one level down by the viewers' heading renderer.
 */
export function demoteH1(html: string): string {
  return html.replace(/<(\/?)h1(?=[\s>])/gi, '<$1h2');
}
