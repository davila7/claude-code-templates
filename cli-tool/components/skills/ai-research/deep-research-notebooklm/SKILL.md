---
name: deep-research-notebooklm
description: "Deep research skill powered by NotebookLM MCP. Conducts structured multi-source research (market analysis, competitive intel, trend analysis, prospect research) using Google NotebookLM as the research engine, then delivers formatted briefs and optional studio artifacts (slides, audio podcasts, videos, infographics, reports, mind maps)."
---

# Deep Research via NotebookLM

Research **$ARGUMENTS** deeply using the NotebookLM MCP server and deliver a structured research brief. Optionally generate studio artifacts (slides, audio podcasts, videos, infographics, reports, mind maps) from the research.

## Prerequisites

- **NotebookLM MCP server** must be configured. Install via: `nlm setup add claude-code`
- If NotebookLM MCP tools are not available, tell the user to run the setup command and restart their session.

## Research Workflow

### Step 1: Define Scope

Determine the **research type** based on the user's request:

| Type | Focus |
|------|-------|
| **Market Research** | Industry trends, market sizing, opportunities, TAM/SAM/SOM |
| **Competitive Intel** | Competitor analysis, positioning gaps, feature comparisons |
| **Client/Prospect Research** | Company background, pain points, decision makers, recent news |
| **Trend Analysis** | Technology trends, adoption patterns, forecasts, emerging players |
| **Proposal Research** | Background for proposals, sector-specific data, case studies |
| **Academic/Technical** | Papers, frameworks, methodologies, state of the art |

Tell the user what you plan to research and confirm the angle:

> "I'll research [topic]. My angle: [specific focus]. I'll investigate: [2-3 specific questions]. Sound right, or should I adjust?"

Wait for confirmation before proceeding.

### Step 2: Create NotebookLM Notebook

Use `notebook_create` to create a notebook named:
`Research: [Topic] - [YYYY-MM-DD]`

### Step 3: Add Context Sources

Use `source_add` to seed the notebook with relevant context:
- Add any URLs the user provides (articles, company pages, reports)
- Add any documents or files the user references
- Add text summaries of relevant background if no URLs are available
- If researching a company, add their website, LinkedIn, recent press

### Step 4: Run Research

Use `research_start` with a well-crafted query based on the topic and context.

**Mode selection:**
- Default: `"fast"` (~60 seconds, ~10 sources) -- good for most queries
- Use `"deep"` only if the user explicitly asks for exhaustive research (can take 10+ minutes and may stall at 0 sources)

**Tip:** Run direct `WebSearch` calls in parallel with NotebookLM for faster initial data gathering while the research engine works.

Poll `research_status` until complete. Use the `query` parameter as fallback matching -- task IDs can change between `research_start` and `research_status` calls.

### Step 5: Import Discovered Sources

Use `research_import` to bring discovered sources into the notebook for deeper analysis.

### Step 6: Query for Insights

Use `notebook_query` to ask 3-5 targeted questions based on the research type:

1. **Overview**: "What are the key findings about [topic]?"
2. **Opportunities**: "What opportunities or gaps exist in this space?"
3. **Actions**: "What are the most actionable insights from this research?"
4. **Risks**: "What are the main risks, challenges, or counterarguments?"
5. **Custom**: A question specific to the research type (e.g., "Who are the top 5 competitors and how do they differentiate?" for competitive intel)

### Step 7: Write Research Brief

Save the findings to a local file using the research brief template:

**File path:** `research/[topic-slug]-[YYYY-MM-DD].md`

Use the template from [research-brief-template.md](research-brief-template.md) to structure the output. Create the `research/` directory if it does not exist.

### Step 8: Present Takeaways

After saving, present the user with:
- **3-5 headline findings** (bullets, direct, no filler)
- **1-2 recommended actions** connected to the user's stated goals
- **Surprises or contrarian findings** -- anything that challenges assumptions
- **The file path** where the full brief is saved
- **The NotebookLM notebook URL** so the user can explore sources directly

### Step 9 (Optional): Generate Studio Artifacts

Ask the user: "Want me to generate any artifacts from this research? Options: slides, audio (podcast), video, infographic, report, mind map."

If yes, use `studio_create` with the notebook_id from Step 2.

**Available artifact types and recommended settings:**

| Type | Key params | Best for |
|------|-----------|----------|
| `slide_deck` | `slide_format`: `detailed_deck` or `presenter_slides`; `slide_length`: `short` or `default` | Executive presentations, client pitches |
| `audio` | `audio_format`: `deep_dive`, `brief`, `critique`, or `debate`; `audio_length`: `short`, `default`, `long` | Podcast-style deep dives, learning on the go |
| `video` | `video_format`: `explainer`, `brief`, `cinematic`; `visual_style`: `auto_select`, `classic`, `whiteboard`, etc. | Visual explainers, social media content |
| `infographic` | `orientation`: `landscape`, `portrait`, `square`; `infographic_style`: `professional`, `bento_grid`, etc. | One-pagers, social sharing |
| `report` | `report_format`: `Briefing Doc`, `Study Guide`, `Blog Post`, `Create Your Own` | Written deliverables, summaries |
| `mind_map` | `title` | Visual knowledge mapping |

**Common params for all artifact types:**
- `language`: Set to the user's preferred language (e.g., `"en"`, `"es"`, `"pt"`)
- `focus_prompt`: A clear directive about what to emphasize in the artifact
- `confirm`: Must be `true` to proceed with generation

**After creating an artifact:**
1. Poll `studio_status` until `completed` (audio/video: 5-15 min; slides/infographics: 2-5 min)
2. Use `download_artifact` to save locally if needed
3. Provide the notebook URL so the user can access artifacts directly

**Tips:**
- `audio` with `deep_dive` format produces the best podcast-style analysis
- `slide_deck` with `detailed_deck` format works best for standalone reading; `presenter_slides` is better when accompanied by speaker notes
- Audio status may show `"unknown"` once completed -- check for `audio_url` presence instead of waiting for a `"completed"` status

## Notes

- Fast mode is recommended as the default. Deep mode is powerful but can take 10+ minutes and occasionally stalls.
- Always confirm the research scope with the user before starting -- a well-scoped query produces dramatically better results.
- The research brief template ensures consistent, actionable output across all research types.

## Additional Resources

- [research-brief-template.md](research-brief-template.md) -- Template for structuring research brief output
