## Product Discovery Team Agent Overview

The Product Discovery Team is a 15-agent pipeline that turns a raw product brief into a validated, publish-ready discovery report. It is built on Ivan Zamesin's Advanced Jobs To Be Done (AJTBD) methodology — not the generic Christensen "When X, I want Y, so that Z" framing. The team runs through 12 steps and two hard quality gates, and reads all company-specific context (product, segments, competitors, connected systems) from a single profile file rather than having anything hard-wired.

Full project, orchestrator skill, install instructions and live demo: [product-discovery.dervlad.com](https://product-discovery.dervlad.com/) · [github.com/VladislavDerkach/product-discovery-flow](https://github.com/VladislavDerkach/product-discovery-flow).

---

### 1. Discovery Request Agent

**Purpose:** Adapts any free-form Discovery request into a structured, decision-oriented, business-impact-focused Discovery Request.

**Key Features:**

- Turns a raw idea, problem, or initiative into a research question with clear scope
- Proposes no solutions — stays strictly at the request-structuring layer
- Segments the request by Job Graph rather than by demographics
- Surfaces assumptions the requester didn't state explicitly

---

### 2. Context Recovery Agent

**Purpose:** Analyzes the company's previously completed Product Discovery reports and extracts competitors, competitive solutions, AJTBD Jobs, Job intersections, and user segments across all of them.

**Key Features:**

- Re-formulates historical Christensen-style Jobs into the canonical Zamesin AJTBD form
- Reads the location of the research archive from the discovery profile
- Returns blind spots — what hasn't been researched yet — not just a summary
- Prevents re-researching ground already covered

---

### 3. Market & Source Map Agent

**Purpose:** Builds a structured market map and source map for competitive research.

**Key Features:**

- Finds direct competitors, substitutes, and adjacent solutions
- Maps each to a market segment and a Job-to-be-done
- Collects primary sources per competitor (homepage, pricing, docs, reviews, community)
- Returns strict JSON for downstream agents, no prose

---

### 4. Product Knowledge Agent

**Purpose:** Analyzes the company's own product knowledge base, help documentation and internal engineering wiki to establish the AS-IS picture of the product.

**Key Features:**

- Establishes what the product actually does today, not what the roadmap claims
- Surfaces technical constraints that shape what's buildable
- Reads the location of internal docs from the discovery profile
- Runs before any external research, so comparisons have a real baseline

---

### 5. Internal Data Agent

**Purpose:** Collects and analyzes data from the company's own connected platforms — revenue and subscription metrics, CRM, team chat, support tickets, community channels, product analytics.

**Key Features:**

- Reads which sources actually exist from the discovery profile — never assumes a vendor
- Runs twice in the pipeline: an early pass and a second pass after competitive research
- Splits output into Quantitative / Qualitative / Segment breakdown / Data gaps
- Reports a gap honestly instead of guessing when a source isn't connected

---

### 6. Feature Intelligence Agent

**Purpose:** Performs deep competitive and product logic analysis of a specific product feature.

**Key Features:**

- Thinks as a senior PM, discovery lead, and B2B SaaS architect simultaneously
- Focuses on real user scenarios, not marketing copy
- Extracts the system logic and trade-offs behind a competitor's implementation
- Assesses scalability, not just feature parity

---

### 7. Community Signal Intelligence Agent

**Purpose:** Analyzes public discussions, reviews, social platforms, and community feedback to surface real user pains, unmet needs, behavioral patterns, and emotional signals.

**Key Features:**

- Covers Reddit, G2, Capterra, Trustpilot, forums, and social platforms
- Filters for what users actually say and do, not what companies claim
- Applies the AJTBD lens to raw community text
- Surfaces switching and purchase triggers, not just sentiment

---

### 8. Trend Analyst

**Purpose:** Detects and analyzes emerging trends, industry shifts, and weak signals to inform strategic planning and competitive positioning.

**Key Features:**

- Identifies what's changing before it becomes obvious to competitors
- Builds 2–4 forward scenarios with probability ranges
- Assesses technology and regulatory shifts relevant to the target segments
- Feeds directly into the AJTBD Canon Validation gate that follows

---

### 9. AJTBD Canon Validator *(hard gate)*

**Purpose:** Pre-publication QA gate for Discovery reports — validates every Job against the Advanced Jobs To Be Done canon by Ivan Zamesin.

**Key Features:**

- Checks each Job is named `I want to + infinitive verb` — one verb, a verb phrase, not a noun
- Confirms Full Jobs carry all eight canonical elements
- Verifies Big/Core/Small/Micro levels are distinguished correctly (Small is a sibling of Core, not below it)
- Confirms success criteria are concrete and measurable, not slogans
- Returns a `PASS` / `BLOCK` verdict with findings — rewrites nothing, and on `BLOCK` the pipeline stops until fixed at the source

---

### 10. AJTBD Segmentation Agent

**Purpose:** Segments customers using the Advanced Jobs To Be Done methodology — clustering people by Job Graph similarity, not demographics.

**Key Features:**

- Builds the Job Graph: Big Job → Core Job → Small Job → Micro Job
- Treats Small Jobs as siblings of Core Jobs, never as a level below them
- Clusters segments by similar Core Jobs *and* similar success criteria
- Scores each segment on value creation, profitability, scalability, and the Critical Chain

---

### 11. Discovery QA & PM Action Agent

**Purpose:** Evaluates completed discovery research for quality, strategic fit, and gaps, then produces a prioritized manual to-do list for the PM.

**Key Features:**

- Reads the company's strategic narrative and target/legacy segments from the discovery profile
- Flags weak or unsupported claims before they reach the final report
- Produces concrete next actions — interviews, internal analytics pulls, CRM review
- Runs after research, before the Final Report Agent

---

### 12. Market Opportunity & ROI Calculator Agent *(optional)*

**Purpose:** Calculates the market opportunity and potential ROI from implementing a research initiative.

**Key Features:**

- Computes TAM/SAM/SOM using both top-down and bottom-up methods
- Analyzes each segment across market size, customer value, profitability, and scalability
- Takes a final discovery report or initiative description as input
- Skipped by default — only runs when the PM explicitly asks for ROI

---

### 13. Discovery Final Report Agent

**Purpose:** Formats approved discovery research findings into a structured, layered final report ready to publish.

**Key Features:**

- Invents nothing — formats only what's already approved
- Optimized for an executive plus a product lead as primary readers
- One report per language — a separate page is generated per translation
- Runs only after every upstream finding has been validated

---

### 14. Slop & Logic QA Agent *(hard gate)*

**Purpose:** Reads a discovery report and produces a structured QA report flagging AI slop patterns and logical inconsistencies.

**Key Features:**

- Works on a wiki page, a file, or pasted text, in any language
- Quotes the exact passage for every finding, with a severity rating
- Does not rewrite the report — flags only
- On a HIGH-severity finding, the pipeline stops until the report is fixed

---

### 15. Report Translation Agent

**Purpose:** Translates a Final Report from English into the target language named in the discovery profile.

**Key Features:**

- Preserves structure, formatting and meaning exactly — no summarizing
- Keeps brand names, technical terms and AJTBD framework labels in English
- Publishes the translation alongside the original, never replacing it
- Runs last, only after the Slop & Logic QA gate has passed

---

### Workflow Architecture

**Sequential phases:**

1. **Intake:** Discovery Request Agent structures the raw brief
2. **Context:** Context Recovery Agent checks past research for blind spots
3. **Baseline (parallel):** Market & Source Map, Product Knowledge, and Internal Data agents run together
4. **Competitive recon (parallel):** Feature Intelligence, Community Signal Intelligence, and Trend Analyst run together
5. **Gate:** AJTBD Canon Validator — `BLOCK` stops the pipeline
6. **Segmentation:** AJTBD Segmentation Agent
7. **Research QA:** Discovery QA & PM Action Agent, then a second Internal Data pass
8. **Optional:** Market Opportunity & ROI Calculator Agent, only if requested
9. **Report:** Discovery Final Report Agent publishes
10. **Gate:** Slop & Logic QA Agent — a `HIGH` finding stops the pipeline
11. **Translation:** Report Translation Agent, only if a target language is set

**Key orchestration patterns:**

- **Two hard gates**, not advisory checks — a `BLOCK` or a `HIGH` finding halts the pipeline for a human decision, it does not just get logged
- **Parallel execution** at both the baseline-research and competitive-recon phases
- **Profile-driven, not hard-wired** — every company-specific fact is read from one editable profile file
- **Honest gaps, never guesses** — any data source the profile doesn't name is skipped and reported as a gap

---

### General Setup Notes

- Each agent has a single, strictly owned area of responsibility — no overlap between agents
- The orchestrator (a separate skill, not one of these 15 agents) knows the step order, what runs in parallel, and where the two gates sit
- Agents can be invoked individually for a narrower task, or run end-to-end as the full pipeline
- The pipeline works for any company: everything specific to yours lives in `~/.claude/discovery-profile.md`, which the orchestrator skill helps you build on first run
- Ships with both an English and a Russian orchestrator skill; all 15 agents themselves run in English
