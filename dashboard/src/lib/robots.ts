/**
 * Paths that must stay out of Google's index.
 *
 * They used to be `Disallow`ed in public/robots.txt, which stops crawling but
 * not indexing: Google still indexes a blocked URL it finds linked (the
 * sidebar links /my-components on every page), and since it can never fetch
 * it, it never sees a noindex either. Search Console reports that as
 * "Indexed, though blocked by robots.txt". So robots.txt lets them be crawled
 * and the middleware answers them with `X-Robots-Tag: noindex`.
 *
 * /api/v1/ (the public Catalog API) is static, so the middleware never runs
 * for it; it is not listed here.
 */
export const NOINDEX_HEADER = 'noindex, nofollow';

const NOINDEX_BASES = ['/api', '/my-components', '/github-callback'];

export function isNoindexPath(pathname: string): boolean {
  return NOINDEX_BASES.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}
