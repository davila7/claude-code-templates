# Expectation Alignment Guide

Frameworks for setting, communicating, and managing expectations with teammates, stakeholders, and leadership.

## Why Expectations Misalign

Common causes of expectation misalignment in software teams:

| Cause | Example |
| --- | --- |
| **Implicit assumptions** | "I assumed we'd use the existing API" vs "I thought we'd build a new one" |
| **Different definitions** | "Done" means code complete to you, but deployed to them |
| **Information gaps** | You know about a dependency; they don't |
| **Timeline optimism** | Estimates given under pressure without accounting for reality |
| **Scope creep** | Small additions pile up into major differences |
| **Communication gaps** | Updates not shared, changes not communicated |

## The Expectation Alignment Framework

### 1. Define Success Explicitly

Never assume alignment. Make success criteria explicit:

| Vague | Explicit |
| --- | --- |
| "Make it fast" | "Page load under 2 seconds on 3G" |
| "High quality" | "Zero P1 bugs in first month; 80% test coverage" |
| "Soon" | "By end of sprint (Friday 5pm)" |
| "User-friendly" | "New users can complete checkout in under 3 minutes" |

### 2. Expose Assumptions

Before starting work, surface hidden assumptions:

**Questions to ask:**

- "What are you assuming about [timeline/resources/scope]?"
- "What would make this harder than expected?"
- "What's the worst case scenario?"
- "What dependencies are we assuming will be available?"
- "What's the definition of 'done' for this?"

### 3. Document and Share

Expectations that aren't written down don't exist:

- Put acceptance criteria in tickets
- Send follow-up emails after verbal agreements
- Update documentation when things change
- Share publicly (not just DMs)

### 4. Check Alignment Regularly

Don't wait until delivery to discover misalignment:

- Daily standups surface blockers early
- Mid-sprint check-ins catch scope creep
- Demo progress before "done" to validate direction
- Regular stakeholder updates prevent surprises

## Scenario: Unrealistic Deadlines

### Recognition Signs

- Timeline set without engineering input
- Estimates significantly lower than past similar work
- No buffer for unknowns
- Dependencies assumed to be risk-free
- "We just need to..." (minimizing language)

### Response Framework

**1. Acknowledge the goal:**
> "I understand hitting this date is important for [business reason]."

**2. Present data:**
> "Based on similar past work, this typically takes [X]. Here's the breakdown..."

**3. Offer options:**
> "We have a few paths:"
>
> - "Hit the date by reducing scope to [core features]"
> - "Deliver full scope by [realistic date]"
> - "Add resources, but onboarding will take [time]"

**4. Get explicit agreement:**
> "Which approach would you like? Can I document this so we're aligned?"

### Sample Conversation

> **Stakeholder:** "We need the new dashboard by end of month."
>
> **You:** "I want to make sure we deliver something great. Let me share what I'm seeing: the full dashboard - charts, filters, export - typically takes 6-8 weeks. We have 4 weeks."
>
> **Stakeholder:** "We really need it by end of month."
>
> **You:** "I hear you. Here's what we could do: ship the core charts by end of month, then add filters and export in the following two weeks. That gets value to users faster. Would that work?"
>
> **Stakeholder:** "What about just working faster?"
>
> **You:** "I wish that worked, but rushing usually creates bugs that cost more time later. The scope-first approach gets you something solid you can show stakeholders. What matters most - the date or the full feature set?"

## Scenario: Unclear Role Boundaries

### Recognition Signs

- Tasks falling through cracks
- Duplicated work
- "I thought you were handling that"
- Confusion about who decides what
- Finger-pointing when things go wrong

### Response Framework

**1. Identify the gap:**
> "I've noticed some confusion about who owns [task/decision]. Can we clarify?"

**2. Propose explicit ownership:**
> "My understanding is that [Person A] owns [X] and [Person B] owns [Y]. Does that match your understanding?"

**3. Define handoff points:**
> "The handoff happens when [specific condition]. At that point, [Person B] takes over."

**4. Document and share:**
> "Let me send a quick summary so everyone's aligned."

### RACI for Common Confusion Points

| Task | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| Code complete | Developer | Developer | Reviewer | Team |
| PR merged | Reviewer | Developer | - | Team |
| Deployed to staging | DevOps/Dev | Team Lead | QA | Stakeholders |
| Bug triage | Tech Lead | Product | Development | Stakeholders |
| Scope changes | Product | Product | Tech Lead | Development |

## Scenario: Scope Creep

### Recognition Signs

- "Can we just add..."
- "One more thing..."
- Requirements changing mid-sprint
- Original estimate no longer realistic
- Features growing beyond initial spec

### Response Framework

**1. Acknowledge the request:**
> "That's a good idea. Let me think through the impact."

**2. Quantify the change:**
> "Adding [feature] would take approximately [time]. That would push our delivery from [date] to [new date]."

**3. Present trade-offs:**
> "We could add this by dropping [other feature] or extending the timeline. Which would you prefer?"

**4. Get explicit approval:**
> "Before I add this to the scope, can you confirm [the trade-off]?"

### The Scope Change Template

When scope changes are requested, respond with:

```markdown
**Change Request:** [What's being asked]

**Impact:**
- Timeline: [Current] → [New]
- Resources: [Any changes]
- Risk: [New risks introduced]

**Options:**
1. Add scope, extend timeline to [date]
2. Add scope, drop [other feature]
3. Defer to next phase

**Recommendation:** [Your suggestion]

**Need decision by:** [Date]
```

## Setting Expectations Proactively

### At Project Start

- Define success criteria explicitly
- Surface assumptions and dependencies
- Establish communication cadence
- Agree on decision-making process
- Document in shared location

### During Work

- Regular status updates (before asked)
- Early warning on blockers
- Proactive communication of changes
- Demo progress incrementally
- Update documentation as things change

### At Delivery

- Confirm acceptance criteria met
- Document what was delivered vs planned
- Capture lessons learned
- Set expectations for next phase

## Phrases for Expectation Conversations

### Setting Expectations

- "Let me make sure we're aligned on..."
- "Here's what I'm committing to..."
- "My understanding is that success looks like..."
- "Just to be explicit about scope..."
- "The definition of 'done' for this is..."

### Surfacing Misalignment

- "I want to flag a concern about..."
- "I think we might have different assumptions about..."
- "Can we clarify what we mean by...?"
- "I'm seeing a gap between [X] and [Y]..."
- "Before we go further, I want to make sure..."

### Resetting Expectations

- "Based on what we're learning, we need to adjust..."
- "The original estimate didn't account for [X]..."
- "Here's what's realistic given [constraints]..."
- "I need to revise what I committed to because..."
- "Let me give you an updated picture..."

### Getting Commitment

- "Can I confirm that we're agreeing to...?"
- "Let me send a summary so we're all aligned."
- "Is everyone okay with this plan?"
- "Before we proceed, I need explicit approval for..."
- "Can you confirm in writing?"

## Expectation Alignment Checklist

### Before Starting Work

- [ ] Success criteria are explicit and measurable
- [ ] Timeline includes buffer for unknowns
- [ ] Dependencies are identified and owners confirmed
- [ ] Assumptions are documented
- [ ] Communication plan is agreed
- [ ] Decision-making process is clear
- [ ] RACI or ownership is explicit

### During Work

- [ ] Regular updates before being asked
- [ ] Blockers raised immediately
- [ ] Changes communicated proactively
- [ ] Progress demonstrated incrementally
- [ ] Documentation updated as things change

### At Delivery

- [ ] Acceptance criteria reviewed before "done"
- [ ] Stakeholder sign-off obtained
- [ ] Gaps between planned and delivered documented
- [ ] Next steps and expectations clear

---

**Related:** Return to `feedback-mastery` skill for difficult conversation frameworks.
