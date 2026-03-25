import { ICONS } from '../lib/icons';

/**
 * Renders a type icon SVG inline.
 * Safe to use dangerouslySetInnerHTML here because ICONS are hardcoded
 * SVG strings defined in icons.ts — not user-supplied data.
 */
export default function TypeIcon({ type, size = 16, className = '' }: { type: string; size?: number; className?: string }) {
  const svg = ICONS[type];
  if (!svg) return <span className={className} />;

  const sized = svg.replace(/width="16"/, `width="${size}"`).replace(/height="16"/, `height="${size}"`);

  return <span className={className} dangerouslySetInnerHTML={{ __html: sized }} />;
}
