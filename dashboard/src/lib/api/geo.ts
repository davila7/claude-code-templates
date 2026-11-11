/**
 * Visitor country from Cloudflare's `cf-ipcountry` header (ISO 3166-1 alpha-2).
 * `XX` means Cloudflare could not resolve the IP and is stored as null.
 */
export function getCountry(request: Request): string | null {
  const country = request.headers.get('cf-ipcountry');
  if (!country || country === 'XX') return null;
  return country;
}
