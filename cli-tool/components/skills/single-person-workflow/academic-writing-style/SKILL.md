---
name: academic-writing-style
description: "Personalized academic writing assistant for university assignments in Chinese and English. Use when users need help writing/revising academic reports, project docs, technical analyses, research reviews, or case studies. Produces natural prose avoiding AI markers. Triggers: academic writing, assignment, report, technical analysis, research review, case study. | 个性化学术写作助手，适用于中英文大学作业。触发词：学术写作、作业、报告、技术分析、研究综述、案例研究、项目文档。"
---

# Academic Writing Style

Transform provided information into well-written academic assignments that match the user's natural writing style, avoiding obvious AI patterns while maintaining professional quality.

## Core Approach

Generate content that reads naturally and fluently, with:
- Clear chapter organization using descriptive headings
- Natural topic progression without rigid "firstly...secondly...finally" structures
- Moderate use of first-person perspective appropriate to assignment type
- Specific examples and details rather than generic statements
- Mixed sentence lengths without excessive complexity
- Proper punctuation for target language (Chinese or English)

## Before Writing

1. **Clarify assignment requirements:**
   - Assignment type (technical analysis, research review, case study, etc.)
   - Target language (Chinese, English, or both)
   - Expected length or scope
   - Specific topics or concepts to cover
   - Any special requirements

2. **Load appropriate references:**
   - For Chinese assignments: read `references/chinese-examples.md`
   - For English assignments: read `references/english-examples.md`
   - Always read `references/writing-guidelines.md` for core principles

3. **Assess personalization level:**
   - Technical analyses: More objective, minimal first-person
   - Research reviews: Moderate personal voice
   - Case studies: Higher personalization appropriate with reflections

## Writing Process

### Structure Development

Create descriptive chapter headings that preview content rather than generic labels:
- Instead of "Introduction" → "Docker and the Container Revolution: A Practical Perspective"
- Instead of "Analysis" → "从繁琐到简洁：Spring Boot如何改变Java开发"
- Instead of "Conclusion" → "Migrating a Production Database: Lessons from a Zero-Downtime PostgreSQL Switch"

Organize content by natural topic flow, allowing chapters to build on each other through content connections rather than explicit transitions.

### Paragraph Construction

Integrate information into flowing paragraphs instead of lists. When information naturally forms a list, embed it in prose:

**Avoid:**
The key advantages include:
- Performance improvement
- Cost reduction
- Scalability enhancement

**Prefer:**
The optimization brought three main benefits: performance improved significantly with response times dropping by 60%, costs decreased through more efficient resource usage, and the architecture gained better scalability for future growth.

### Transitions and Flow

Connect paragraphs through:
- **Topic extension:** Last concept of previous paragraph continues in next
- **Natural contrast:** Present contrasting ideas without heavy transition words
- **Implicit questions:** Address unstated questions the content raises
- **Chapter breaks:** Use chapter divisions to signal major topic shifts

Avoid mechanical transitions like "however", "furthermore", "in addition" in favor of letting content flow naturally.

### Incorporating Examples and Details

Make writing concrete through:
- Specific metrics: "response time dropped from 8 seconds to 2 seconds"
- Real cases: "Netflix split their monolith into hundreds of microservices over several years"
- Technical details: "the query involved 7 table joins and generated N+1 query problems"
- Personal observations: "in my experience, this approach works well for..." (use sparingly)

### Language Calibration

**For Chinese writing:**
- Use proper Chinese punctuation: ，。：""
- Keep technical terms in English where appropriate: "Spring Boot", "Docker"
- Maintain natural Chinese sentence rhythm and flow
- Avoid direct English-to-Chinese translation patterns

**For English writing (IELTS 6.0 level):**
- Prefer common over complex vocabulary: "use" instead of "utilize"
- Keep sentences under 30 words typically
- Use clear, direct constructions
- Define acronyms on first use: "Object-Relational Mapping (ORM)"
- Mix sentence lengths for readability

### First-Person Usage

Use first-person perspective strategically:
- Describing practical experience: "笔者在项目中遇到过..." / "from my experience..."
- Expressing informed opinions: "我认为..." / "I found that..."
- Case study reflections: "如果重新设计，我会..." / "looking back, I would..."

Maintain objectivity for:
- Technical explanations of principles
- Literature review content
- Pure technical analysis

## Quality Verification

Before finalizing, verify:
- No "firstly...secondly...finally" structures present
- Minimal use of bullet points (only when absolutely necessary)
- Paragraphs connect naturally through content
- Specific examples and details included throughout
- Chapter headings are descriptive and informative
- First-person usage is appropriate and not excessive
- Punctuation matches target language conventions
- Sentence variety present (mix of long and short)
- Language avoids obvious AI markers
- Technical terminology used accurately and consistently

## Special Considerations

**For bilingual assignments (both Chinese and English versions needed):**
- Write each version independently, not as direct translation
- Adapt examples and phrasing to each language's natural patterns
- Maintain consistent technical accuracy across both versions
- Adjust formality level appropriately for each language context

**For technical analysis:**
- Reduce personal voice, increase objectivity
- Focus on technical accuracy and detailed explanation
- Use concrete examples from real systems or projects
- Balance accessibility with technical precision

**For research reviews:**
- Synthesize sources into narrative rather than listing them
- Show connections and evolution of ideas
- Acknowledge debates and different perspectives
- Maintain critical but balanced tone

**For case studies:**
- Provide rich contextual details
- Include specific challenges encountered
- Reflect on lessons learned (appropriate place for first-person)
- Balance description with analysis

## File Output Convention

### Output Directory Convention

**Recommended Approach (Following Claude Code Official Standards):**

Save all academic writing outputs to `outputs/<project-name>/writing/`:

```
outputs/
└── <project-name>/              # Project name (e.g., cloud-computing-analysis)
    └── writing/
        ├── technical-analysis.md    # Technical analysis report
        ├── research-review.md       # Research review document
        ├── case-study.md            # Case study report
        └── project-documentation.md # Project documentation
```

**Example:**
```
outputs/
├── cloud-computing-analysis/
│   └── writing/
│       └── technical-analysis.md
├── ai-ethics-research/
│   └── writing/
│       └── research-review.md
└── database-optimization-case/
    └── writing/
        └── case-study.md
```

**Alternative Approach (Traditional Project Structure):**

If your project has an existing directory structure, you can also use:

```
project-root/
└── docs/
    ├── technical-analysis.md
    ├── research-review.md
    └── case-study.md
```

### Output File List

Generate documents based on assignment type:

**Technical Analysis:**
- `technical-analysis.md` - Technical analysis report

**Research Review:**
- `research-review.md` - Research review document

**Case Study:**
- `case-study.md` - Case study report

**Project Documentation:**
- `project-documentation.md` - Project documentation

### File Naming Convention

- Use kebab-case: `cloud-computing-technical-analysis.md`
- Include version/date when needed: `research-review-v1.0.md`
- Use descriptive names: `database-optimization-case-study.md`
- Specify language if bilingual: `technical-analysis-en.md`, `technical-analysis-zh.md`

### Delivery Summary

After generating the document, provide a brief summary:
- Document type and target language
- Word count and chapter structure
- Key topics covered
- Writing style characteristics applied
- File save location confirmation

## References

Detailed examples and guidelines available in:
- `references/chinese-examples.md` - Comprehensive Chinese writing examples
- `references/english-examples.md` - Comprehensive English writing examples
- `references/writing-guidelines.md` - Core writing principles and techniques
