/**
 * The one canonical URL of a component page: /component/{plural type}/{path
 * without .md/.json}. The page route also answers singular types and bare
 * names (old links); it 301s those here, so every link should use this form.
 */
export function pluralType(type: string): string {
  if (!type) return '';
  return type.endsWith('s') ? type : `${type}s`;
}

export function componentPath(type: string, path: string): string {
  const clean = (path ?? '').replace(/\.(md|json)$/, '').replace(/^\/+|\/+$/g, '');
  return `/component/${pluralType(type)}/${clean}`;
}
