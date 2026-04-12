import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import { encode } from 'gpt-tokenizer';

interface Slide {
  type: 'title' | 'content';
  title: string;
  body: string;
  html: string;
  metadata?: Record<string, string>;
}

interface SkillSlideViewProps {
  content: string;
  skillName: string;
}

// ─── YAML frontmatter parsing ─────────────────────────────────────
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  let currentKey = '';
  let currentValue = '';

  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\S[\w-]*)\s*:\s*(.*)/);
    if (kv) {
      if (currentKey) meta[currentKey] = currentValue.trim();
      currentKey = kv[1];
      currentValue = kv[2].replace(/^["']|["']$/g, '');
    } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentValue += ' ' + line.trim();
    }
  }
  if (currentKey) meta[currentKey] = currentValue.trim();

  return { meta, body: match[2] || '' };
}

// ─── Markdown rendering ───────────────────────────────────────────
function renderSlideMarkdown(md: string): string {
  marked.setOptions({ gfm: true, breaks: false });
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    const tag = `h${Math.min(depth + 1, 6)}`;
    return `<${tag} class="slide-heading">${text}</${tag}>`;
  };
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    return `<div class="slide-code-block"><div class="slide-code-lang">${lang || ''}</div><pre><code class="language-${lang || ''}">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
  };
  return marked.parse(md, { renderer }) as string;
}

// ─── Slide building ───────────────────────────────────────────────
function buildSlides(content: string, skillName: string): Slide[] {
  const { meta, body } = parseFrontmatter(content);
  const slides: Slide[] = [];

  // Title slide
  const titleName = meta.name || skillName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // Get the first H1 for subtitle if available
  const h1Match = body.match(/^#\s+(.+)$/m);
  const subtitle = h1Match ? h1Match[1] : '';

  // Build description - truncate if too long
  let desc = meta.description || '';
  if (desc.length > 300) {
    desc = desc.slice(0, 300).replace(/\s+\S*$/, '') + '...';
  }
  // Remove <example> blocks from description for cleaner display
  desc = desc.replace(/<example>[\s\S]*?<\/example>/g, '').trim();

  const metaFields: Record<string, string> = {};
  if (meta.version) metaFields['Version'] = meta.version;
  if (meta.tools) metaFields['Tools'] = meta.tools;
  if (meta['allowed-tools']) metaFields['Tools'] = meta['allowed-tools'];
  if (meta.model) metaFields['Model'] = meta.model;
  if (meta.color) metaFields['Color'] = meta.color;
  if (meta.author) metaFields['Author'] = meta.author;
  if (meta.license) metaFields['License'] = meta.license;

  slides.push({
    type: 'title',
    title: titleName,
    body: subtitle ? `${subtitle}\n\n${desc}` : desc,
    html: '',
    metadata: metaFields,
  });

  // Split body by H2 sections
  const bodyWithoutH1 = body.replace(/^#\s+.+$/m, '').trim();
  const sections = bodyWithoutH1.split(/(?=^##\s)/m).filter((s) => s.trim());

  for (const section of sections) {
    const headingMatch = section.match(/^##\s+(.+)$/m);
    if (!headingMatch) {
      // Content before first H2 — add as intro slide if substantial
      if (section.trim().length > 50) {
        slides.push({
          type: 'content',
          title: 'Introduction',
          body: section.trim(),
          html: renderSlideMarkdown(section.trim()),
        });
      }
      continue;
    }

    const title = headingMatch[1].replace(/[*_`\[\]]/g, '').trim();
    const sectionBody = section.replace(/^##\s+.+$/m, '').trim();

    slides.push({
      type: 'content',
      title,
      body: sectionBody,
      html: renderSlideMarkdown(sectionBody),
    });
  }

  // If no H2 sections found, create a single content slide with full body
  if (slides.length === 1 && bodyWithoutH1.trim()) {
    slides.push({
      type: 'content',
      title: 'Content',
      body: bodyWithoutH1.trim(),
      html: renderSlideMarkdown(bodyWithoutH1.trim()),
    });
  }

  return slides;
}

// ─── Main Component ───────────────────────────────────────────────
const SLIDE_HEIGHT = '32rem';

export default function SkillSlideView({ content, skillName }: SkillSlideViewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slides = useMemo(() => buildSlides(content, skillName), [content, skillName]);
  const totalSlides = slides.length;

  // Token counting
  const totalTokens = useMemo(() => encode(content).length, [content]);
  const slideTokens = useMemo(() => slides.map((s) => encode(s.body).length), [slides]);

  const goTo = useCallback((idx: number) => {
    setCurrentSlide(Math.max(0, Math.min(idx, totalSlides - 1)));
  }, [totalSlides]);

  const goNext = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const goPrev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); goTo(totalSlides - 1); }
      else if (e.key === 'Escape' && isFullscreen) { toggleFullscreen(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [goNext, goPrev, goTo, totalSlides, isFullscreen]);

  // Fullscreen API
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const slide = slides[currentSlide];
  if (!slide) return null;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${isFullscreen ? 'bg-[#0d0d0f] h-screen' : ''}`}
    >
      {/* Slide area */}
      <div className={`relative bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col ${isFullscreen ? 'flex-1 rounded-none border-0' : ''}`}>
        {/* Slide content */}
        <div
          className={`${isFullscreen ? 'flex-1 px-16 py-12 overflow-y-auto' : 'px-8 py-8'}`}
          style={!isFullscreen && !expanded ? { height: SLIDE_HEIGHT, overflow: 'hidden' } : undefined}
        >
          {slide.type === 'title' ? (
            <TitleSlide slide={slide} isFullscreen={isFullscreen} totalTokens={totalTokens} />
          ) : (
            <ContentSlide slide={slide} isFullscreen={isFullscreen} />
          )}
        </div>

        {/* Show more / Collapse */}
        {!isFullscreen && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-[var(--color-accent-400)] hover:text-[var(--color-text-primary)] border-t border-[var(--color-border)] hover:bg-[var(--color-surface-3)] transition-colors"
          >
            {expanded ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
                Collapse
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                Show full document
              </>
            )}
          </button>
        )}

        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]/50 backdrop-blur-sm">
          {/* Left: prev button + token info */}
          <div className="flex items-center gap-3">
            <button
              onClick={goPrev}
              disabled={currentSlide === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <div className="hidden sm:flex items-center gap-1.5 font-mono">
              <span title="Tokens in this slide" className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-accent-400)]/10 text-[var(--color-accent-400)] text-[10px] font-bold">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                {slideTokens[currentSlide]?.toLocaleString()}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-[9px]">/</span>
              <span title="Total tokens" className="text-[10px] text-[var(--color-text-tertiary)] font-medium">{totalTokens.toLocaleString()}</span>
            </div>
          </div>

          {/* Center: slide dots + counter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentSlide
                      ? 'w-6 h-1.5 bg-[var(--color-accent-400)]'
                      : 'w-1.5 h-1.5 bg-[var(--color-text-tertiary)]/40 hover:bg-[var(--color-text-tertiary)]'
                  }`}
                  title={`Slide ${i + 1}: ${slides[i].title}`}
                />
              ))}
            </div>
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-mono tabular-nums">
              {currentSlide + 1} / {totalSlides}
            </span>
          </div>

          {/* Right: next + fullscreen */}
          <div className="flex items-center gap-1">
            <button
              onClick={goNext}
              disabled={currentSlide === totalSlides - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors"
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="flex justify-center gap-3 mt-3 text-[10px] text-[var(--color-text-tertiary)]">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)] font-mono text-[9px]">&larr;</kbd>
          <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)] font-mono text-[9px]">&rarr;</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)] font-mono text-[9px]">Home</kbd>
          <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)] font-mono text-[9px]">End</kbd>
          First / Last
        </span>
      </div>
    </div>
  );
}

// ─── Title Slide ──────────────────────────────────────────────────
function TitleSlide({ slide, isFullscreen, totalTokens }: { slide: Slide; isFullscreen: boolean; totalTokens: number }) {
  const metaEntries = Object.entries(slide.metadata || {});
  const allBadges = [...metaEntries, ['Tokens', totalTokens.toLocaleString()]];

  return (
    <div className={`flex flex-col items-center justify-center text-center h-full min-h-[20rem] ${isFullscreen ? 'min-h-[60vh]' : ''}`}>
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: 'rgba(213, 116, 85, 0.15)' }}>
        <svg className="w-8 h-8" style={{ color: 'var(--color-accent-400)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </div>

      {/* Title */}
      <h1 className={`font-bold text-[var(--color-text-primary)] mb-3 leading-tight ${isFullscreen ? 'text-4xl' : 'text-2xl'}`}>
        {slide.title}
      </h1>

      {/* Description */}
      {slide.body && (
        <p className={`text-[var(--color-text-secondary)] leading-relaxed max-w-2xl ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
          {slide.body}
        </p>
      )}

      {/* Metadata badges */}
      {allBadges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2.5 mt-8">
          {allBadges.map(([key, value]) => {
            const isTokens = key === 'Tokens';
            return (
              <div
                key={key}
                className={`flex flex-col items-center px-4 py-2.5 rounded-xl border text-center min-w-[5rem] ${
                  isTokens
                    ? 'bg-[var(--color-accent-400)]/10 border-[var(--color-accent-400)]/25'
                    : 'bg-[var(--color-surface-3)]/60 border-[var(--color-border)]'
                }`}
              >
                <span className={`text-[10px] uppercase tracking-widest font-semibold mb-0.5 ${
                  isTokens ? 'text-[var(--color-accent-400)]' : 'text-[var(--color-text-tertiary)]'
                }`}>{key}</span>
                <span className={`text-sm font-bold font-mono ${
                  isTokens ? 'text-[var(--color-accent-400)]' : 'text-[var(--color-text-primary)]'
                }`}>{value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Content Slide ────────────────────────────────────────────────
function ContentSlide({ slide, isFullscreen }: { slide: Slide; isFullscreen: boolean }) {
  return (
    <div className={`h-full ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
      {/* Slide title */}
      <h2 className={`font-bold text-[var(--color-text-primary)] mb-6 pb-3 border-b border-[var(--color-border)] ${isFullscreen ? 'text-3xl' : 'text-xl'}`}>
        {slide.title}
      </h2>

      {/* Rendered markdown content */}
      <div
        className={`slide-md-content ${isFullscreen ? 'text-base' : 'text-sm'}`}
        dangerouslySetInnerHTML={{ __html: slide.html }}
      />

      {/* Inline styles for slide markdown content */}
      <style>{`
        .slide-md-content {
          color: var(--color-text-secondary);
          line-height: 1.7;
        }
        .slide-md-content .slide-heading {
          color: var(--color-text-primary);
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .slide-md-content h3.slide-heading { font-size: 1.1em; }
        .slide-md-content h4.slide-heading { font-size: 1em; }
        .slide-md-content p { margin-bottom: 0.75rem; }
        .slide-md-content ul, .slide-md-content ol {
          margin-bottom: 0.75rem;
          padding-left: 1.5rem;
        }
        .slide-md-content li { margin-bottom: 0.25rem; }
        .slide-md-content ul li { list-style: disc; }
        .slide-md-content ol li { list-style: decimal; }
        .slide-md-content strong { color: var(--color-text-primary); font-weight: 600; }
        .slide-md-content code {
          background: var(--color-surface-3);
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: ui-monospace, monospace;
          color: var(--color-accent-400, #f97316);
        }
        .slide-md-content .slide-code-block {
          background: var(--color-surface-1, #0d0d0f);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          margin: 0.75rem 0;
          overflow: hidden;
        }
        .slide-md-content .slide-code-lang {
          padding: 0.35rem 0.75rem;
          font-size: 0.7em;
          color: var(--color-text-tertiary);
          border-bottom: 1px solid var(--color-border);
          font-family: ui-monospace, monospace;
        }
        .slide-md-content .slide-code-lang:empty { display: none; }
        .slide-md-content pre {
          padding: 0.75rem;
          overflow-x: auto;
          font-size: 0.85em;
          line-height: 1.6;
        }
        .slide-md-content pre code {
          background: none;
          padding: 0;
          border-radius: 0;
          color: var(--color-text-primary);
        }
        .slide-md-content a {
          color: var(--color-accent-400, #f97316);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .slide-md-content blockquote {
          border-left: 3px solid var(--color-border);
          padding-left: 1rem;
          margin: 0.75rem 0;
          color: var(--color-text-tertiary);
          font-style: italic;
        }
        .slide-md-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.75rem 0;
          font-size: 0.9em;
        }
        .slide-md-content th, .slide-md-content td {
          border: 1px solid var(--color-border);
          padding: 0.4rem 0.75rem;
          text-align: left;
        }
        .slide-md-content th {
          background: var(--color-surface-3);
          color: var(--color-text-primary);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
