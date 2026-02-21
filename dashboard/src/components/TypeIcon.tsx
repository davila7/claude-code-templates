import { useRef, useEffect } from 'react';
import { ICONS } from '../lib/icons';

/**
 * Safely renders a type icon SVG without dangerouslySetInnerHTML.
 * Parses the SVG string via DOMParser and only inserts valid SVG elements.
 */
export default function TypeIcon({ type, size = 16, className = '' }: { type: string; size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const svgStr = ICONS[type];
    if (!svgStr) return;

    const doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    el.innerHTML = '';
    if (svg && !doc.querySelector('parsererror')) {
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      el.appendChild(document.importNode(svg, true));
    }
  }, [type, size]);

  return <span ref={ref} className={className} />;
}
