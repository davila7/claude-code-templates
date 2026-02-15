# Meeting Structures for Developers

Templates and structures for common software development meetings. Use these to run effective meetings and ensure productive outcomes.

## Daily Standup

**Duration:** 15 minutes max
**Frequency:** Daily
**Format:** Each person answers 3 questions

### Structure

Each team member shares (1-2 minutes max per person):

1. **Yesterday:** What did I complete?
2. **Today:** What am I working on?
3. **Blockers:** What's in my way?

### Best Practices

- **Stand up** (if in person) - Keeps it short
- **Focus on work, not activity** - "Completed feature X" beats "Attended meetings"
- **Parking lot** - Note follow-up discussions for after standup
- **Timebox strictly** - 15 minutes, then end
- **Blockers get attention** - If someone's blocked, identify who can help

### Anti-Patterns to Avoid

- Turning into status report to manager (it's team sync, not reporting)
- Problem-solving during standup (take it offline)
- Going into technical details (save for pairing sessions)
- Skipping when "nothing to report" (brief updates still valuable)

---

## Sprint Planning

**Duration:** 1-2 hours
**Frequency:** Start of each sprint
**Purpose:** Agree on sprint goals and work commitment

### Structure

| Phase | Duration | Activity |
| --- | --- | --- |
| Sprint Goal | 10 min | What will this sprint accomplish? |
| Backlog Review | 20 min | Review prioritized items |
| Estimation | 30 min | Size items being considered |
| Commitment | 20 min | Team commits to sprint scope |
| Capacity Check | 10 min | Account for PTO, meetings, etc. |

### Agenda Template

```markdown
1. **Sprint Goal** (10 min)
   - Product Owner presents sprint objective
   - Team asks clarifying questions

2. **Backlog Review** (20 min)
   - Review top items in priority order
   - Clarify acceptance criteria
   - Identify dependencies

3. **Estimation** (30 min)
   - Estimate items using team's method (points, t-shirts, etc.)
   - Break down large items if needed

4. **Sprint Commitment** (20 min)
   - Team selects items that fit capacity
   - Confirm everyone understands the work

5. **Wrap-up** (10 min)
   - Recap sprint goal and committed items
   - Note any risks or dependencies to watch
```

### Best Practices

- **Come prepared** - PO has prioritized backlog, items are refined
- **Focus on "what" not "how"** - Save implementation details for during sprint
- **Protect focus time** - Account for meetings, support, etc. when committing
- **Team decides capacity** - Only team members estimate and commit

---

## Sprint Retrospective

**Duration:** 1-1.5 hours
**Frequency:** End of each sprint
**Purpose:** Continuous improvement

### Structure

| Phase | Duration | Activity |
| --- | --- | --- |
| Set the Stage | 5 min | Check-in, set tone |
| Gather Data | 20 min | Collect feedback |
| Generate Insights | 20 min | Discuss patterns |
| Decide Actions | 15 min | Commit to improvements |
| Close | 5 min | Appreciate, wrap up |

### Common Formats

**Start/Stop/Continue:**

- **Start doing:** What should we begin?
- **Stop doing:** What should we stop?
- **Continue doing:** What's working well?

**Liked/Learned/Lacked/Longed For (4Ls):**

- **Liked:** What went well?
- **Learned:** What did we discover?
- **Lacked:** What was missing?
- **Longed for:** What do we wish we had?

**Mad/Sad/Glad:**

- **Mad:** What frustrated you?
- **Sad:** What disappointed you?
- **Glad:** What made you happy?

### Best Practices

- **Safe space** - No blame, focus on systems not people
- **Limit action items** - 1-3 concrete improvements
- **Follow up** - Review last retro's actions at start
- **Vary the format** - Keep it fresh to avoid ruts
- **Everyone participates** - Make space for quieter voices

---

## Architecture Review / Tech Design Review

**Duration:** 45-60 minutes
**Frequency:** As needed for significant technical decisions
**Purpose:** Get feedback on technical approach before implementation

### Structure

```markdown
1. **Context & Problem** (10 min)
   - What problem are we solving?
   - Why now? What's driving this?

2. **Proposed Solution** (15 min)
   - High-level architecture diagram
   - Key components and their responsibilities
   - Data flow

3. **Trade-offs & Alternatives** (10 min)
   - What alternatives did you consider?
   - Why this approach over others?
   - What are we trading off?

4. **Discussion & Questions** (15 min)
   - Open floor for questions
   - Concerns and risks
   - Edge cases and failure modes

5. **Decision & Next Steps** (5 min)
   - Approved / Approved with changes / Needs revision
   - Action items and timeline
```

### Best Practices

- **Share materials beforehand** - Send design doc 24-48 hours before
- **Timebox discussion** - Don't let it become a working session
- **Focus on architecture, not code** - Implementation details come later
- **Document decisions** - Record the outcome in an ADR or design doc

---

## One-on-One (1:1)

**Duration:** 30-60 minutes
**Frequency:** Weekly or bi-weekly
**Purpose:** Support, feedback, career growth

### Structure (Flexible)

```markdown
1. **Their Topics First** (15-20 min)
   - What's on their mind?
   - Blockers, concerns, wins

2. **Feedback Exchange** (10-15 min)
   - Recognition for recent work
   - Growth areas or coaching

3. **Career/Growth** (10-15 min)
   - Progress on development goals
   - Upcoming opportunities

4. **Admin/Updates** (5 min)
   - Any org updates to share
   - Upcoming schedule impacts
```

### Good Questions to Ask

**For team members:**

- "What's your biggest blocker right now?"
- "What's one thing I could do to better support you?"
- "What are you most proud of recently?"
- "What would you like to be doing more of?"

**For managers:**

- "Is there anything you need from me?"
- "How can I help the team succeed this sprint?"
- "What feedback do you have for me?"

### Best Practices

- **Their meeting, their agenda** - Let them drive topics
- **Don't cancel** - Consistency builds trust
- **Take notes** - Remember what you discussed
- **Follow through** - If you commit to something, do it

---

## Incident Postmortem / Blameless Review

**Duration:** 60-90 minutes
**Frequency:** After significant incidents
**Purpose:** Learn and prevent recurrence

### Structure

```markdown
1. **Timeline Review** (20 min)
   - What happened, when?
   - Build shared understanding of events

2. **Impact Assessment** (10 min)
   - What was affected?
   - Customer impact, business impact

3. **Root Cause Analysis** (20 min)
   - 5 Whys or Fishbone diagram
   - Contributing factors (not just trigger)

4. **What Went Well** (10 min)
   - What worked in our response?
   - What should we keep doing?

5. **Action Items** (15 min)
   - Prevention measures
   - Detection improvements
   - Response improvements

6. **Wrap-up** (5 min)
   - Assign owners and timelines
   - Schedule follow-up if needed
```

### Best Practices

- **Blameless** - Focus on systems, not individuals
- **Assume good intent** - People made reasonable decisions with available info
- **Prioritize actions** - Don't try to fix everything; focus on highest impact
- **Share learnings** - Document and share with broader team/org

---

## Code Review Walkthrough

**Duration:** 30-45 minutes
**Frequency:** As needed for complex changes
**Purpose:** Deep review of significant code changes

### Structure

```markdown
1. **Context Setting** (5 min)
   - What problem does this solve?
   - Why was this approach chosen?

2. **High-Level Walkthrough** (10 min)
   - Architecture/structure overview
   - Key files and their purposes

3. **Detailed Review** (20 min)
   - Walk through critical paths
   - Highlight non-obvious decisions
   - Answer questions in real-time

4. **Wrap-up** (5 min)
   - Note remaining concerns
   - Agree on approval path
```

### Best Practices

- **Share PR link beforehand** - Let reviewers skim first
- **Focus on logic, not style** - Linters catch style issues
- **Author drives the walkthrough** - Explain your thinking
- **Note follow-up items** - Track issues for separate PRs

---

## General Meeting Tips

### Before the Meeting

- [ ] Clear purpose/objective defined
- [ ] Agenda sent in advance
- [ ] Right people invited (and only right people)
- [ ] Materials shared for pre-read
- [ ] Time and duration appropriate for scope

### During the Meeting

- [ ] Start on time
- [ ] State objective at opening
- [ ] Timebox discussions
- [ ] Capture action items live
- [ ] Leave 5 minutes for wrap-up
- [ ] End on time (or early!)

### After the Meeting

- [ ] Send summary within 24 hours
- [ ] Action items have owners and due dates
- [ ] Follow up on commitments
- [ ] Cancel recurring meetings that aren't adding value

---

**Related:** Return to `professional-communication` skill for email and written communication guidance.
