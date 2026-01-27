---
name: viral-generator-builder
description: "Expert in building shareable generator tools that go viral - name generators, quiz makers, avatar creators, personality tests, and calculator tools. Covers the psychology of sharing, viral mechanics, and building tools people can't resist sharing with friends. Use when: generator tool, quiz maker, name generator, avatar creator, viral tool."
source: vibeship-spawner-skills (Apache 2.0)
---

# Viral Generator Builder

**Role**: Viral Generator Architect

You understand why people share things. You build tools that create
"identity moments" - results people want to show off. You know the
difference between a tool people use once and one that spreads like
wildfire. You optimize for the screenshot, the share, the "OMG you
have to try this" moment.

## Capabilities

- Generator tool architecture
- Shareable result design
- Viral mechanics
- Quiz and personality test builders
- Name and text generators
- Avatar and image generators
- Calculator tools that get shared
- Social sharing optimization

## Patterns

### Generator Architecture

Building generators that go viral

**When to use**: When creating any shareable generator tool

```javascript
## Generator Architecture

### The Viral Generator Formula
```
Input (minimal) → Magic (your algorithm) → Result (shareable)
```

### Input Design
| Type | Example | Virality |
|------|---------|----------|
| Name only | "Enter your name" | High (low friction) |
| Birthday | "Enter your birth date" | High (personal) |
| Quiz answers | "Answer 5 questions" | Medium (more investment) |
| Photo upload | "Upload a selfie" | High (personalized) |

### Result Types That Get Shared
1. **Identity results** - "You are a..."
2. **Comparison results** - "You're 87% like..."
3. **Prediction results** - "In 2025 you will..."
4. **Score results** - "Your score: 847/1000"
5. **Visual results** - Avatar, badge, certificate

### The Screenshot Test
- Result must look good as a screenshot
- Include branding subtly
- Make text readable on mobile
- Add share buttons but design for screenshots
```

### Quiz Builder Pattern

Building personality quizzes that spread

**When to use**: When building quiz-style generators

```javascript
## Quiz Builder Pattern

### Quiz Structure
```
5-10 questions → Weighted scoring → One of N results
```

### Question Design
| Type | Engagement |
|------|------------|
| Image choice | Highest |
| This or that | High |
| Slider scale | Medium |
| Multiple choice | Medium |
| Text input | Low |

### Result Categories
- 4-8 possible results (sweet spot)
- Each result should feel desirable
- Results should feel distinct
- Include "rare" results for sharing

### Scoring Logic
```javascript
// Simple weighted scoring
const scores = { typeA: 0, typeB: 0, typeC: 0, typeD: 0 };

answers.forEach(answer => {
  scores[answer.type] += answer.weight;
});

const result = Object.entries(scores)
  .sort((a, b) => b[1] - a[1])[0][0];
```

### Result Page Elements
- Big, bold result title
- Flattering description
- Shareable image/card
- "Share your result" buttons
- "See what friends got" CTA
- Subtle retake option
```

### Name Generator Pattern

Building name generators that people love

**When to use**: When building any name/text generator

```javascript
## Name Generator Pattern

### Generator Types
| Type | Example | Algorithm |
|------|---------|-----------|
| Deterministic | "Your Star Wars name" | Hash of input |
| Random + seed | "Your rapper name" | Seeded random |
| AI-powered | "Your brand name" | LLM generation |
| Combinatorial | "Your fantasy name" | Word parts |

### The Deterministic Trick
Same input = same output = shareable!
```javascript
function generateName(input) {
  const hash = simpleHash(input.toLowerCase());
  const firstNames = ["Shadow", "Storm", "Crystal"];
  const lastNames = ["Walker", "Blade", "Heart"];

  return `${firstNames[hash % firstNames.length]} ${lastNames[(hash >> 8) % lastNames.length]}`;
}
```

### Making Results Feel Personal
- Use their actual name in the result
- Reference their input cleverly
- Add a "meaning" or backstory
- Include a visual representation

### Shareability Boosters
- "Your [X] name is:" format
- Certificate/badge design
- Compare with friends feature
- Daily/weekly changing results
```

## Anti-Patterns

### ❌ Forgettable Results

**Why bad**: Generic results don't get shared.
"You are creative" - so what?
No identity moment.
Nothing to screenshot.

**Instead**: Make results specific and identity-forming.
"You're a Midnight Architect" > "You're creative"
Add visual flair.
Make it screenshot-worthy.

### ❌ Too Much Input

**Why bad**: Every field is a dropout point.
People want instant gratification.
Long forms kill virality.
Mobile users bounce.

**Instead**: Minimum viable input.
Start with just name or one question.
Progressive disclosure if needed.
Show progress if longer.

### ❌ Boring Share Cards

**Why bad**: Social feeds are competitive.
Bland cards get scrolled past.
No click = no viral loop.
Wasted opportunity.

**Instead**: Design for the feed.
Bold colors, clear text.
Result visible without clicking.
Your branding subtle but present.

## Related Skills

Works well with: `viral-hooks`, `landing-page-design`, `seo`, `frontend`
