---
name: ship-learn-next
description: Transform learning content (like YouTube transcripts, articles, tutorials) into actionable implementation plans using the Ship-Learn-Next framework. Use when user wants to turn advice, lessons, or educational content into concrete action steps, reps, or a learning quest.
allowed-tools:
  - Read
  - Write
---

# Ship-Learn-Next Action Planner

This skill helps transform passive learning content into actionable **Ship-Learn-Next cycles** - turning advice and lessons into concrete, shippable iterations.

## When to Use This Skill

Activate when the user:
- Has a transcript/article/tutorial and wants to "implement the advice"
- Asks to "turn this into a plan" or "make this actionable"
- Wants to extract implementation steps from educational content
- Needs help breaking down big ideas into small, shippable reps
- Says things like "I watched/read X, now what should I do?"

## Core Framework: Ship-Learn-Next

Every learning quest follows three repeating phases:

1. **SHIP** - Create something real (code, content, product, demonstration)
2. **LEARN** - Honest reflection on what happened
3. **NEXT** - Plan the next iteration based on learnings

**Key principle**: 100 reps beats 100 hours of study. Learning = doing better, not knowing more.

## How This Skill Works

### Step 1: Read the Content

Read the file the user provides (transcript, article, notes):

```bash
# User provides path to file
FILE_PATH="/path/to/content.txt"
```

Use the Read tool to analyze the content.

### Step 2: Extract Core Lessons

Identify from the content:
- **Main advice/lessons**: What are the key takeaways?
- **Actionable principles**: What can actually be practiced?
- **Skills being taught**: What would someone learn by doing this?
- **Examples/case studies**: Real implementations mentioned

**Do NOT**:
- Summarize everything (focus on actionable parts)
- List theory without application
- Include "nice to know" vs "need to practice"

### Step 3: Define the Quest

Help the user frame their learning goal:

Ask:
1. "Based on this content, what do you want to achieve in 4-8 weeks?"
2. "What would success look like? (Be specific)"
3. "What's something concrete you could build/create/ship?"

**Example good quest**: "Ship 10 cold outreach messages and get 2 responses"
**Example bad quest**: "Learn about sales" (too vague)

### Step 4: Design Rep 1 (The First Iteration)

Break down the quest into the **smallest shippable version**:

Ask:
- "What's the smallest version you could ship THIS WEEK?"
- "What do you need to learn JUST to do that?" (not everything)
- "What would 'done' look like for rep 1?"

**Make it:**
- Concrete and specific
- Completable in 1-7 days
- Produces real evidence/artifact
- Small enough to not be intimidating
- Big enough to learn something meaningful

### Step 5: Create the Rep Plan

Structure each rep with:

```markdown
## Rep 1: [Specific Goal]

**Ship Goal**: [What you'll create/do]
**Success Criteria**: [How you'll know it's done]
**What You'll Learn**: [Specific skills/insights]
**Resources Needed**: [Minimal - just what's needed for THIS rep]
**Timeline**: [Specific deadline]

**Action Steps**:
1. [Concrete step 1]
2. [Concrete step 2]
3. [Concrete step 3]
...

**After Shipping - Reflection Questions**:
- What actually happened? (Be specific)
- What worked? What didn't?
- What surprised you?
- On a scale of 1-10, how did this rep go?
- What would you do differently next time?
```

### Step 6: Map Future Reps (2-5)

Based on the content, suggest a progression:

```markdown
## Rep 2: [Next level]
**Builds on**: What you learned in Rep 1
**New challenge**: One new thing to try/improve
**Expected difficulty**: [Easier/Same/Harder - and why]

## Rep 3: [Continue progression]
...
```

**Progression principles**:
- Each rep adds ONE new element
- Increase difficulty based on success
- Reference specific lessons from the content
- Keep reps shippable (not theoretical)

### Step 7: Connect to Content

For each rep, reference the source material:

- "This implements the [concept] from minute X"
- "You're practicing the [technique] mentioned in the video"
- "This tests the advice about [topic]"

**But**: Always emphasize DOING over studying. Point to resources only when needed for the specific rep.

## Conversation Style

**Direct but supportive**:
- No fluff, but encouraging
- "Ship it, then we'll improve it"
- "What's the smallest version you could do this week?"

**Question-driven**:
- Make them think, don't just tell
- "What exactly do you want to achieve?" not "Here's what you should do"

**Specific, not generic**:
- "By Friday, ship one landing page" not "Learn web development"
- Push for concrete commitments

**Action-oriented**:
- Always end with "what's next?"
- Focus on the next rep, not the whole journey

## What NOT to Do

- ❌ Don't create a study plan (create a SHIP plan)
- ❌ Don't list all resources to read/watch (pick minimal resources for current rep)
- ❌ Don't make perfect the enemy of shipped
- ❌ Don't let them plan forever without starting
- ❌ Don't accept vague goals ("learn X" → "ship Y by Z date")
- ❌ Don't overwhelm with the full journey (focus on rep 1)

## Key Phrases to Use

- "What's the smallest version you could ship this week?"
- "What do you need to learn JUST to do that?"
- "This isn't about perfection - it's rep 1 of 100"
- "Ship something real, then we'll improve it"
- "Based on [content], what would you actually DO differently?"
- "Learning = doing better, not knowing more"

## Example Output Structure

```markdown
# Your Ship-Learn-Next Quest: [Title]

## Quest Overview
**Goal**: [What they want to achieve in 4-8 weeks]
**Source**: [The content that inspired this]
**Core Lessons**: [3-5 key actionable takeaways from content]

---

## Rep 1: [Specific, Shippable Goal]

**Ship Goal**: [Concrete deliverable]
**Timeline**: [This week / By [date]]
**Success Criteria**:
- [ ] [Specific thing 1]
- [ ] [Specific thing 2]
- [ ] [Specific thing 3]

**What You'll Practice** (from the content):
- [Skill/concept 1 from source material]
- [Skill/concept 2 from source material]

**Action Steps**:
1. [Concrete step]
2. [Concrete step]
3. [Concrete step]
4. Ship it (publish/deploy/share/demonstrate)

**Minimal Resources** (only for this rep):
- [Link or reference - if truly needed]

**After Shipping - Reflection**:
Answer these questions:
- What actually happened?
- What worked? What didn't?
- What surprised you?
- Rate this rep: _/10
- What's one thing to try differently next time?

---

## Rep 2: [Next Iteration]

**Builds on**: Rep 1 + [what you learned]
**New element**: [One new challenge/skill]
**Ship goal**: [Next concrete deliverable]

[Similar structure...]

---

## Rep 3-5: Future Path

**Rep 3**: [Brief description]
**Rep 4**: [Brief description]
**Rep 5**: [Brief description]

*(Details will evolve based on what you learn in Reps 1-2)*

---

## Remember

- This is about DOING, not studying
- Aim for 100 reps over time (not perfection on rep 1)
- Each rep = Plan → Do → Reflect → Next
- You learn by shipping, not by consuming

**Ready to ship Rep 1?**
```

## Processing Different Content Types

### YouTube Transcripts
- Focus on advice, not stories
- Extract concrete techniques mentioned
- Identify case studies/examples to replicate
- Note timestamps for reference later (but don't require watching again)

### Articles/Tutorials
- Identify the "now do this" parts vs theory
- Extract the specific workflow/process
- Find the minimal example to start with

### Course Notes
- What's the smallest project from the course?
- Which modules are needed for rep 1? (ignore the rest for now)
- What can be practiced immediately?

## Success Metrics

A good Ship-Learn-Next plan has:
- ✅ Specific, shippable rep 1 (completable in 1-7 days)
- ✅ Clear success criteria (user knows when they're done)
- ✅ Concrete artifacts (something real to show)
- ✅ Direct connection to source content
- ✅ Progression path for reps 2-5
- ✅ Emphasis on action over consumption
- ✅ Honest reflection built in
- ✅ Small enough to start today, big enough to learn

## Saving the Plan

**IMPORTANT**: Always save the plan to a file for the user.

### Filename Convention

Always use the format:
- `Ship-Learn-Next Plan - [Brief Quest Title].md`

Examples:
- `Ship-Learn-Next Plan - Build in Proven Markets.md`
- `Ship-Learn-Next Plan - Learn React.md`
- `Ship-Learn-Next Plan - Cold Email Outreach.md`

**Quest title should be**:
- Brief (3-6 words)
- Descriptive of the main goal
- Based on the content's core lesson/theme

### What to Save

**Complete plan including**:
- Quest overview with goal and source
- All reps (1-5) with full details
- Action steps and reflection questions
- Timeline commitments
- Reference to source material

**Format**: Always save as Markdown (`.md`) for readability

## After Creating the Plan

**Display to user**:
1. Show them you've saved the plan: "✓ Saved to: [filename]"
2. Give a brief overview of the quest
3. Highlight Rep 1 (what's due this week)

**Then ask**:
1. "When will you ship Rep 1?"
2. "What's the one thing that might stop you? How will you handle it?"
3. "Come back after you ship and we'll reflect + plan Rep 2"

**Remember**: You're not creating a curriculum. You're helping them ship something real, learn from it, and ship the next thing.

Let's help them ship.
