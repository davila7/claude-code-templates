// Headings for a component's "On this page" outline. Shared by the component page
// (Overview TOC) and the Files explorer so both list the same entries.

export interface MarkdownHeading {
  level: number;
  text: string;
  id: string;
}

const FRONTMATTER = /^---\s*\n[\s\S]*?\n---\s*\n?/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^(#{1,4})\s+(.+)$/;

export function headingId(text: string): string {
  return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
}

export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER, '');
}

/**
 * Calls `visit` for each line with whether it sits inside a fenced code block,
 * so a `# comment` or a heading-shaped line in a template is never a heading.
 */
export function forEachMarkdownLine(content: string, visit: (line: string, inFence: boolean) => void): void {
  let fence: string | null = null;
  for (const line of stripFrontmatter(content).split('\n')) {
    const m = line.match(FENCE);
    if (m) {
      const marker = m[1];
      // CommonMark: a backtick fence's info string has no backticks, so a line like
      // ```inline``` is an inline code span, not the start of a block.
      const info = line.slice(line.indexOf(marker) + marker.length);
      const opens = marker[0] === '~' || !info.includes('`');
      if (fence === null) {
        if (opens) { fence = marker; visit(line, true); continue; }
        visit(line, false); continue;
      }
      if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) {
        fence = null; visit(line, true); continue;
      }
    }
    visit(line, fence !== null);
  }
}

export function parseHeadingLine(line: string): MarkdownHeading | null {
  const m = line.match(HEADING);
  if (!m) return null;
  const text = m[2].replace(/[*_`\[\]]/g, '').replace(/\s+#+\s*$/, '').trim();
  return text ? { level: m[1].length, text, id: headingId(text) } : null;
}

export function extractHeadings(content: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  forEachMarkdownLine(content, (line, inFence) => {
    if (inFence) return;
    const h = parseHeadingLine(line);
    if (h) headings.push(h);
  });
  return headings;
}
