---
title: Interactive Tutorials Implementation
inclusion: fileMatch
fileMatchPattern: "**/tutorial*.{ts,tsx,astro,md}"
---

# Interactive Tutorials - Development Guidelines

## Overview
This steering file provides context and guidelines for working with the Interactive Tutorials feature that teaches users how to effectively use components in 5 minutes.

## Architecture

### Tutorial Structure
Each tutorial follows a consistent 4-step pattern:
1. **Installation** - How to get the component
2. **First Task** - Quick win to build confidence
3. **Common Use Cases** - Real-world examples
4. **Pro Tips** - Advanced patterns and combinations

### Data Flow
1. User visits `/tutorials` hub page
2. Browses tutorials by category/difficulty
3. Clicks tutorial card → `/tutorials/[component]`
4. Reads content, copies examples, watches videos
5. Marks steps complete (stored in localStorage)
6. Progress tracked and displayed

### Key Files
- **Content**: `src/content/tutorials/*.md`
- **Components**: `src/components/tutorials/*.tsx`
- **Pages**: `src/pages/tutorials/*.astro`
- **Types**: `src/types/tutorial.ts`
- **Progress Tracking**: `src/lib/tutorial-progress.ts`

## File Structure

### Tutorial Content
```
src/content/tutorials/
├── frontend-developer.md
├── component-reviewer.md
├── test-command.md
├── security-auditor.md
└── ... (top 20 components)
```

### Components
```
src/components/tutorials/
├── TutorialLayout.tsx       # Main wrapper
├── TutorialStep.tsx         # Individual step
├── CodeBlock.tsx            # Code with copy button
├── PromptExample.tsx        # Example prompts
├── VideoPlayer.tsx          # Video embed
├── TutorialProgress.tsx     # Progress tracker
├── TutorialCard.tsx         # Hub listing card
└── TryItLive.tsx            # Interactive playground
```

### Pages
```
src/pages/tutorials/
├── index.astro              # Tutorial hub/listing
├── [component].astro        # Dynamic tutorial page
└── getting-started.astro    # General onboarding
```

## Tutorial Content Format

### Markdown Frontmatter
```yaml
---
component: frontend-developer
type: agent
difficulty: beginner
duration: 5 minutes
tags: [react, ui, components]
---
```

### Required Sections
1. **Title** - Component name
2. **Step 1: Installation** - How to install
3. **Step 2: Your First Task** - Quick example
4. **Step 3: Common Use Cases** - 3-4 real examples
5. **Step 4: Pro Tips** - Advanced patterns
6. **Common Pitfalls** - What to avoid
7. **Next Steps** - Related tutorials

### Example Structure
```markdown
# Frontend Developer Agent Tutorial

Learn how to use the Frontend Developer agent to build UI components faster.

## Step 1: Installation

Install the agent with this command:

\`\`\`bash
npx claude-code-templates@latest --agent frontend-developer
\`\`\`

## Step 2: Your First Task

**Try this prompt:**
```
@frontend-developer Create a responsive button component
```

## Step 3: Common Use Cases

### Building Forms
```
@frontend-developer Create a contact form
```

## Step 4: Pro Tips

💡 **Combine with component-reviewer**
```
@frontend-developer Create a card component
@component-reviewer Review the card component
```

## Common Pitfalls

❌ **Too vague:** "Make a component"
✅ **Specific:** "Create a responsive navbar"

## Next Steps

- Try the [component-reviewer tutorial](/tutorials/component-reviewer)
```

## Component Guidelines

### TutorialLayout Component
**Purpose**: Wraps tutorial content with header, progress, and navigation

**Props**:
- `component: string` - Component identifier
- `type: string` - agent/command/hook/mcp/skill
- `difficulty: 'beginner' | 'intermediate' | 'advanced'`
- `duration: string` - e.g., "5 minutes"
- `tags: string[]` - Category tags
- `children: React.ReactNode` - Tutorial content

**Implementation**:
```tsx
interface TutorialLayoutProps {
  component: string;
  type: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  tags: string[];
  children: React.ReactNode;
}

export default function TutorialLayout({
  component,
  type,
  difficulty,
  duration,
  tags,
  children
}: TutorialLayoutProps) {
  const difficultyColors = {
    beginner: 'bg-emerald-500/10 text-emerald-400',
    intermediate: 'bg-yellow-500/10 text-yellow-400',
    advanced: 'bg-red-500/10 text-red-400'
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 text-[12px] text-[#666]">
        <a href="/tutorials" className="hover:text-[#999] transition-colors">
          Tutorials
        </a>
        <span>/</span>
        <span className="text-[#999]">{component}</span>
      </div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
            {type}
          </span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full ${difficultyColors[difficulty]}`}>
            {difficulty}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#666]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {duration}
          </span>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[10px] rounded-full bg-[#0a0a0a] text-[#666]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Progress Tracker */}
      <TutorialProgress component={component} />

      {/* Content */}
      <div className="px-6 py-6">
        {children}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[#1f1f1f]">
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] rounded-lg text-[13px] font-medium text-[#999] transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-[13px] font-medium transition-all">
          Next
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

### TutorialStep Component
**Purpose**: Individual step with completion tracking

**Props**:
- `number: number` - Step number (1-4)
- `title: string` - Step title
- `children: React.ReactNode` - Step content
- `completed?: boolean` - Completion state

**Implementation**:
```tsx
interface TutorialStepProps {
  number: number;
  title: string;
  children: React.ReactNode;
  completed?: boolean;
  onComplete?: () => void;
}

export default function TutorialStep({
  number,
  title,
  children,
  completed = false,
  onComplete
}: TutorialStepProps) {
  return (
    <div className={`mb-8 ${completed ? 'opacity-75' : ''}`}>
      {/* Step Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-semibold transition-all ${
          completed 
            ? 'bg-emerald-500/10 text-emerald-400' 
            : 'bg-[#3b82f6]/10 text-[#3b82f6]'
        }`}>
          {completed ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            number
          )}
        </div>
        <h2 className="text-[15px] font-semibold text-[#ededed]">
          {title}
        </h2>
      </div>

      {/* Step Content */}
      <div className="ml-11 space-y-4">
        {children}
        
        {/* Complete Button */}
        {!completed && (
          <button
            onClick={onComplete}
            className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] rounded-lg text-[13px] font-medium text-[#999] hover:text-[#ededed] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark as Complete
          </button>
        )}
        
        {completed && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Completed
          </div>
        )}
      </div>
    </div>
  );
}
```

### CodeBlock Component
**Purpose**: Syntax-highlighted code with copy functionality

**Props**:
- `code: string` - Code content
- `language: string` - Syntax highlighting language
- `copyable?: boolean` - Show copy button (default: true)
- `runnable?: boolean` - Show run button (default: false)

**Implementation**:
```tsx
interface CodeBlockProps {
  code: string;
  language: string;
  copyable?: boolean;
  runnable?: boolean;
}

export default function CodeBlock({
  code,
  language,
  copyable = true,
  runnable = false
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f1f]">
        <span className="text-[11px] text-[#666] font-medium uppercase tracking-wider">
          {language}
        </span>
        <div className="flex items-center gap-2">
          {runnable && (
            <button className="flex items-center gap-1.5 px-2 py-1 bg-[#111] hover:bg-[#1a1a1a] rounded text-[11px] text-[#999] hover:text-[#ededed] transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run
            </button>
          )}
          {copyable && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2 py-1 bg-[#111] hover:bg-[#1a1a1a] rounded text-[11px] text-[#999] hover:text-[#ededed] transition-all"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Code */}
      <pre className="p-4 overflow-x-auto text-[12px] leading-relaxed">
        <code className={`language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
```

### PromptExample Component
**Purpose**: Copyable prompt examples with descriptions

**Props**:
- `prompt: string` - Example prompt text
- `description?: string` - What the prompt does
- `result?: string` - Expected output

**Implementation**:
```tsx
interface PromptExampleProps {
  prompt: string;
  description?: string;
  result?: string;
}

export default function PromptExample({
  prompt,
  description,
  result
}: PromptExampleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#3b82f6]/5 border-b border-[#1f1f1f]">
        <span className="text-[11px] text-[#3b82f6] font-medium">
          💡 Try this prompt
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 rounded text-[11px] text-[#3b82f6] transition-all"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Prompt */}
      <div className="p-3">
        <p className="text-[13px] text-[#ededed] leading-relaxed font-mono">
          {prompt}
        </p>
      </div>

      {/* Description */}
      {description && (
        <div className="px-3 pb-3">
          <p className="text-[12px] text-[#666] leading-relaxed">
            {description}
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border-t border-[#1f1f1f] bg-[#111] p-3">
          <div className="text-[11px] text-[#666] mb-2">What you'll get:</div>
          <p className="text-[12px] text-[#999] leading-relaxed">
            {result}
          </p>
        </div>
      )}
    </div>
  );
}
```

### TutorialProgress Component
**Purpose**: Visual progress indicator

**Implementation**:
```tsx
interface TutorialProgressProps {
  component: string;
}

export default function TutorialProgress({ component }: TutorialProgressProps) {
  const [progress, setProgress] = useState(0);
  const steps = [
    { label: 'Installation', icon: '📦' },
    { label: 'First Task', icon: '🎯' },
    { label: 'Use Cases', icon: '💼' },
    { label: 'Pro Tips', icon: '⚡' }
  ];

  useEffect(() => {
    // Load progress from localStorage
    const saved = localStorage.getItem(`tutorial_${component}`);
    if (saved) {
      const data = JSON.parse(saved);
      setProgress((data.stepsCompleted?.length || 0) * 25);
    }
  }, [component]);

  return (
    <div className="px-6 py-4 border-b border-[#1f1f1f]">
      {/* Progress Bar */}
      <div className="relative h-1 bg-[#1f1f1f] rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const isCompleted = progress > index * 25;
          const isCurrent = progress === index * 25;
          
          return (
            <div
              key={step.label}
              className={`flex flex-col items-center gap-1.5 transition-all ${
                isCompleted ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                isCompleted 
                  ? 'bg-emerald-500/10' 
                  : isCurrent 
                  ? 'bg-[#3b82f6]/10 ring-2 ring-[#3b82f6]/30' 
                  : 'bg-[#0a0a0a]'
              }`}>
                {isCompleted ? '✓' : step.icon}
              </div>
              <span className={`text-[10px] text-center transition-colors ${
                isCompleted || isCurrent ? 'text-[#999]' : 'text-[#666]'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Text */}
      <div className="text-center mt-3 text-[11px] text-[#666]">
        {progress === 100 ? (
          <span className="text-emerald-400">🎉 Tutorial completed!</span>
        ) : (
          <span>{progress}% complete</span>
        )}
      </div>
    </div>
  );
}
```

## Progress Tracking

### Local Storage Schema
```typescript
interface TutorialProgress {
  component: string;
  stepsCompleted: number[];
  completedAt?: Date;
  timeSpent: number;
}
```

### Storage Keys
```
tutorial_{component}
```

Examples:
- `tutorial_frontend-developer`
- `tutorial_component-reviewer`

### Functions
```typescript
// Save progress
saveProgress(component: string, step: number): void

// Get progress
getProgress(component: string): TutorialProgress

// Check completion
isCompleted(component: string): boolean

// Get all progress
getAllProgress(): TutorialProgress[]
```

## Top 20 Components Priority

### Priority 1 (Most Popular)
1. frontend-developer
2. component-reviewer
3. test (command)
4. security-auditor
5. deploy-vercel (command)

### Priority 2 (High Value)
6. react-expert
7. component-optimizer
8. api-developer
9. database-expert
10. component-tester

### Priority 3 (Specialized)
11. component-migrator
12. docusaurus-expert
13. linear-tracker
14. mcp-expert
15. simple-notifications (hook)

### Priority 4 (Advanced)
16. component-analytics
17. component-improver
18. blog-writer
19. cli-ui-designer
20. agent-expert

## Development Guidelines

### Adding New Tutorial
1. Create markdown file in `src/content/tutorials/`
2. Follow frontmatter schema
3. Include all required sections
4. Add 3-4 code examples
5. Document common pitfalls
6. Link to related tutorials
7. Test all code examples work

### Adding New Component
1. Create component in `src/components/tutorials/`
2. Define TypeScript interface
3. Add loading/error states
4. Ensure responsive design
5. Add accessibility attributes
6. Test on mobile devices
7. Document props and usage

### Testing Tutorials
```bash
# Start dev server
npm run dev

# Visit tutorial hub
open http://localhost:4321/tutorials

# Test specific tutorial
open http://localhost:4321/tutorials/frontend-developer

# Test progress tracking
# 1. Complete steps
# 2. Refresh page
# 3. Verify progress persists

# Test mobile responsive
# 1. Open DevTools
# 2. Toggle device toolbar
# 3. Test on various sizes
```

## Interactive Features

### Try It Live
Optional embedded playground to test prompts:
- Input prompt text
- Call Claude API
- Display result
- Copy result to clipboard

**Note**: Requires API integration and rate limiting

### Quiz/Assessment
Test understanding after tutorial:
- Multiple choice questions
- Instant feedback
- Score tracking
- Retry option

### Achievements/Badges
Gamification elements:
- First tutorial completed
- 5 tutorials completed
- All basics completed
- Advanced user badge

## Video Integration

### TutorialCard Component (for Hub Page)
```tsx
interface TutorialCardProps {
  component: string;
  title: string;
  description: string;
  type: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  tags: string[];
  popular?: boolean;
  completionRate?: number;
}

export default function TutorialCard({
  component,
  title,
  description,
  type,
  difficulty,
  duration,
  tags,
  popular = false,
  completionRate
}: TutorialCardProps) {
  const typeIcons: Record<string, string> = {
    agent: '🤖',
    command: '⚡',
    hook: '🪝',
    mcp: '🔌',
    skill: '🎯'
  };

  const difficultyColors = {
    beginner: 'bg-emerald-500/10 text-emerald-400',
    intermediate: 'bg-yellow-500/10 text-yellow-400',
    advanced: 'bg-red-500/10 text-red-400'
  };

  return (
    <a
      href={`/tutorials/${component}`}
      className="group block bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#111] rounded-xl p-4 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-xl shrink-0">
          {typeIcons[type] || '📄'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-[13px] font-semibold text-[#ededed] group-hover:text-[#fff] transition-colors line-clamp-1">
              {title}
            </h3>
            {popular && (
              <span className="flex-shrink-0 px-2 py-0.5 text-[10px] rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                🔥 Popular
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#666] line-clamp-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 text-[10px] rounded-full bg-[#0a0a0a] text-[#666]"
          >
            {tag}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="px-2 py-0.5 text-[10px] text-[#666]">
            +{tags.length - 3}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] rounded-full ${difficultyColors[difficulty]}`}>
            {difficulty}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#666]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {duration}
          </span>
        </div>
        {completionRate !== undefined && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {completionRate}% complete
          </div>
        )}
      </div>
    </a>
  );
}
```

## Video Integration

### Video Hosting
- **Recommended**: YouTube (free, unlimited)
- **Alternative**: Vimeo (free tier: 500MB/week)
- **Self-hosted**: Not recommended (bandwidth costs)

### Video Types
1. **Quick Start** (2 min) - Installation + first example
2. **Common Use Cases** (5 min) - Real-world examples
3. **Advanced Patterns** (8 min) - Complex scenarios

### Video Player Component
```tsx
<VideoPlayer
  videoUrl="https://youtube.com/embed/..."
  thumbnail="/thumbnails/frontend-developer.jpg"
  title="Frontend Developer Quick Start"
/>
```

## Performance Optimization

### Content Loading
- Static generation for tutorial pages
- Lazy load video players
- Code splitting for components
- Preload critical assets

### Progress Tracking
- Debounce localStorage writes
- Batch progress updates
- Async state updates
- Efficient re-renders

### Mobile Optimization
- Touch-friendly buttons (min 44px)
- Readable font sizes (16px+)
- Horizontal scroll for code
- Optimized images

## Responsive Design

### Breakpoints
```css
/* Mobile first */
.tutorial-layout {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .tutorial-layout {
    padding: 2rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .tutorial-layout {
    max-width: 800px;
    margin: 0 auto;
  }
}
```

### Mobile Considerations
- Single column layout
- Collapsible sections
- Sticky progress bar
- Bottom navigation
- Touch gestures

## Analytics Tracking

### Events to Track
- `tutorial_started` - User opens tutorial
- `tutorial_step_completed` - Step marked complete
- `tutorial_completed` - All steps done
- `code_copied` - Code block copied
- `prompt_copied` - Prompt example copied
- `video_played` - Video started
- `tutorial_abandoned` - User left early

### Implementation
```typescript
function trackTutorialEvent(event: string, data: any) {
  fetch('/api/track-website-events', {
    method: 'POST',
    body: JSON.stringify({
      event_type: `tutorial_${event}`,
      event_data: data
    })
  });
}
```

### Success Metrics
- Tutorial completion rate (target: 70%+)
- Average time per tutorial (target: 5-7 min)
- Step drop-off rate (identify problem areas)
- Component installation after tutorial
- User satisfaction rating (target: 4.5+/5)

## Design System

### Colors
```css
:root {
  --tutorial-primary: #3b82f6;
  --tutorial-success: #10b981;
  --tutorial-warning: #f59e0b;
  --tutorial-info: #06b6d4;
  --tutorial-bg: #f9fafb;
  --tutorial-surface: #ffffff;
  --tutorial-text: #111827;
  --tutorial-text-secondary: #6b7280;
}
```

### Typography
```css
.tutorial-content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.tutorial-content p {
  font-size: 1rem;
  line-height: 1.75;
}

.tutorial-content code {
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-family: 'Monaco', 'Courier New', monospace;
}
```

### Spacing
- Step spacing: 3rem
- Section spacing: 2rem
- Paragraph spacing: 1rem
- Code block margin: 1.5rem

## Accessibility

### Requirements
- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus indicators
- Color contrast ratios (WCAG AA)
- Screen reader friendly

### Implementation
```tsx
// Good example
<button
  aria-label="Mark step 1 as complete"
  onClick={handleComplete}
>
  Mark as Complete
</button>

// Code block with accessibility
<pre role="region" aria-label="Code example">
  <code>{codeContent}</code>
</pre>
```

## Error Handling

### Content Errors
- **Missing tutorial**: Show 404 with suggestions
- **Invalid frontmatter**: Log error, use defaults
- **Broken links**: Highlight in dev mode

### Progress Errors
- **localStorage full**: Clear old progress
- **Corrupted data**: Reset progress
- **Browser doesn't support**: Disable tracking

### Video Errors
- **Failed to load**: Show thumbnail + retry
- **Unsupported format**: Provide fallback
- **Network error**: Show offline message

## Common Tasks

### Add New Tutorial
1. Create `src/content/tutorials/component-name.md`
2. Add frontmatter with metadata
3. Write 4 steps + pitfalls + next steps
4. Add code examples and prompts
5. Test all examples work
6. Add to tutorial hub listing

### Update Tutorial Content
1. Edit markdown file
2. Verify frontmatter unchanged
3. Test code examples still work
4. Check links are valid
5. Preview in browser

### Add New Interactive Feature
1. Create component in `src/components/tutorials/`
2. Define TypeScript types
3. Implement functionality
4. Add to TutorialLayout
5. Test thoroughly
6. Document usage

### Debug Progress Tracking
```javascript
// Check localStorage
console.log(localStorage.getItem('tutorial_frontend-developer'));

// Clear all progress
Object.keys(localStorage)
  .filter(key => key.startsWith('tutorial_'))
  .forEach(key => localStorage.removeItem(key));

// Manually set progress
localStorage.setItem('tutorial_test', JSON.stringify({
  component: 'test',
  stepsCompleted: [1, 2],
  timeSpent: 300
}));
```

## Best Practices

### Content Writing
- Use clear, concise language
- Start with simplest example
- Build complexity gradually
- Show real-world use cases
- Anticipate common mistakes
- Link to related tutorials

### Code Examples
- Keep examples short (<20 lines)
- Use realistic variable names
- Add inline comments
- Show expected output
- Test before publishing

### Component Development
- Keep components focused
- Use TypeScript for safety
- Add prop validation
- Handle loading states
- Implement error boundaries
- Test edge cases

### Performance
- Minimize re-renders
- Debounce user input
- Lazy load heavy components
- Optimize images
- Cache static content

## Troubleshooting

### "Tutorial not found"
- Check filename matches URL
- Verify frontmatter is valid
- Ensure file is in correct directory
- Check for typos in component name

### "Progress not saving"
- Check localStorage is enabled
- Verify browser supports localStorage
- Check for quota exceeded errors
- Clear old progress data

### "Code examples not working"
- Test examples in isolation
- Check for syntax errors
- Verify dependencies installed
- Update to latest versions

### "Videos not loading"
- Check video URL is correct
- Verify video is public
- Test on different browsers
- Check network connection

## Documentation

### Full Documentation
- [Implementation Plan](../../../docs/plan/INTERACTIVE_TUTORIALS_IMPLEMENTATION.md)
- Tutorial content files in `src/content/tutorials/`
- Component documentation in code comments

## Future Enhancements

### Phase 2 Features
- Learning paths (curated tutorial sequences)
- Community examples (user-submitted)
- Tutorial search functionality
- Difficulty progression system
- Certificate generation
- Social sharing

### Advanced Features
- AI-powered personalization
- Interactive code playground
- Live collaboration
- Tutorial recommendations
- Progress sync across devices
- Offline mode support

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Create tutorial layout components
- Build tutorial hub page
- Write 5 tutorials (top components)
- Add progress tracking
- Test with users

### Phase 2: Content (Week 2)
- Write 10 more tutorials
- Record video walkthroughs
- Add interactive examples
- Create learning paths
- Add search functionality

### Phase 3: Enhancement (Week 3)
- Write remaining 5 tutorials
- Add quiz/assessment
- Create certificates
- Add community examples
- Implement feedback system

### Phase 4: Polish (Week 4)
- Improve UI/UX
- Add animations
- Optimize performance
- Mobile responsive
- Analytics tracking

## Cost Estimate

### Zero Cost
- Tutorial content (your time)
- Layout components (development)
- Progress tracking (localStorage)
- Video hosting (YouTube free tier)

### Optional Costs
- Professional video editing ($0-500)
- Screen recording software ($0-50)
- Video hosting premium ($10-20/month)

**Total: $0-570 one-time + $0-20/month**

