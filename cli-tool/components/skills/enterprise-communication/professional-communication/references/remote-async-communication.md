# Remote and Async Communication

Guide to effective communication in remote-first and async-first environments.

## Async-First Principles

### Default to Async

Before scheduling a meeting, ask: "Could this be async instead?"

| Sync (Meeting) | Async (Document/Message) |
| -------------- | ------------------------ |
| Brainstorming with immediate building | Collecting feedback over time |
| Sensitive/emotional conversations | Status updates |
| Real-time collaboration | Decisions with clear options |
| Urgent problem-solving | Non-urgent questions |
| Relationship building | Documentation and knowledge sharing |

### Why Async Matters

- **Time zones:** Not everyone is online at once
- **Deep work:** Meetings fragment focus time
- **Inclusion:** Async gives introverts equal voice
- **Documentation:** Async creates artifacts for later
- **Flexibility:** People work when they're most productive

## Channel Selection Guide

Choose the right tool for the job:

### Instant Messaging (Slack, Teams)

**Best for:**

- Quick questions expecting same-day answers
- Informal team chat
- Time-sensitive coordination
- Celebrations and recognition

**Anti-patterns:**

- Long-form discussions (use docs)
- Decisions needing documentation (use PRs or docs)
- Anything requiring more than 3 back-and-forths

### Documents (Notion, Google Docs)

**Best for:**

- Proposals and RFCs
- Meeting notes and follow-ups
- Complex decisions with multiple stakeholders
- Knowledge that should persist
- Async reviews and feedback

**Format tips:**

- Start with TL;DR
- Use headers for scannability
- Call out action items and decisions clearly
- Include deadline if feedback is needed

### Email

**Best for:**

- External communication
- Formal announcements
- Reaching people outside your company
- When you need a paper trail

**Avoid for:**

- Internal quick questions (use Slack)
- Collaborative editing (use docs)

### Video Calls

**Reserve for:**

- Complex discussions needing real-time back-and-forth
- Sensitive conversations (feedback, conflict)
- Relationship building
- Urgent problem-solving
- Brainstorming and creative work

**Always:**

- Send agenda beforehand
- Record for those who can't attend
- Document decisions and action items after

### PRs and Code Comments

**Best for:**

- Code-specific discussions
- Technical decisions with code context
- Review feedback
- Architectural choices in implementation

## Over-Communication

In remote work, default to over-communication:

### Share Context Liberally

People can't see what you're working on:

| Don't | Do |
| ----- | -- |
| Disappear for hours | Post "heads down on X, will be slow to respond" |
| Assume people know your schedule | Share working hours in your profile |
| Go silent when stuck | Post "blocked on X, exploring options" |
| Complete work silently | Share progress: "Finished the API, moving to tests" |

### Working Out Loud

Share your thinking, not just your conclusions:

**Good examples:**

> "Exploring two approaches for the caching problem: Redis vs. in-memory. Leaning toward Redis for cross-instance consistency. Will share trade-offs in #architecture by EOD."

And:

> "Hit an unexpected issue with the auth flow - user sessions aren't persisting across subdomains. Investigating cookie settings. ETA unclear, will update in 2 hours."

### When Changing Plans

If priorities shift:

- Communicate the change and reason
- Update anyone who was expecting the old thing
- Don't assume people will notice

## Time Zone Awareness

### Know Your Team's Time Zones

Keep a quick reference:

- Who overlaps with you (synchronous possible)
- Who doesn't (async required)
- When each person's day starts/ends

### Async by Default

When in doubt, don't expect immediate response:

- Include context so they can reply without follow-up questions
- Set clear but reasonable deadlines
- Acknowledge receipt even if you can't respond fully yet

### Schedule Sends

Don't send messages at 2am someone else's time:

- Use "schedule send" features
- Or add context: "No response expected until your morning"

### Rotating Meeting Times

For regular cross-timezone meetings:

- Rotate who bears the inconvenient time
- Record meetings for those who can't attend live
- Default to async when sync isn't essential

## Documentation Over Meetings

### Meeting Decision Rule

Before scheduling a meeting:

1. **Write first:** Draft the problem, context, and options
2. **Collect async feedback:** Give 24-48 hours
3. **Then decide:** If still unresolved, schedule a meeting

Many meetings can be avoided if the organizer documents well enough that discussion isn't needed.

### Meeting Follow-Up

Every synchronous meeting should produce async artifacts:

- **Notes:** Key discussion points
- **Decisions:** What was decided and why
- **Action items:** Who does what by when
- **Recording:** For those who couldn't attend

Share within 24 hours while context is fresh.

### Recording and Summarizing

For important sync meetings:

- Record video/audio
- Create written summary with timestamps
- Call out decisions and action items
- Share in relevant channels

## Writing for Async

### Frontload the Point

Start with the conclusion/ask, then provide context:

**Buried lead (bad):**
> "I've been looking at our deployment pipeline and noticed that the test suite takes 45 minutes. After investigating, I found that most of the time is spent on integration tests that could be parallelized. I've put together a proposal to reduce this by 60%..."

**Frontloaded (good):**

> "**Proposal:** Reduce our test suite time from 45 min to 18 min by parallelizing integration tests.
>
> **Context:** Our deployment pipeline is slow because..."

### Make It Scannable

Use structure for long messages:

- **Headers** for sections
- **Bold** for key points
- **Bullets** for lists
- **TL;DR** at the top for long documents

### Include Everything Needed

The reader shouldn't need to ask follow-up questions:

| Missing context | Complete context |
| --------------- | ---------------- |
| "The deploy failed" | "The 3pm deploy to staging failed with timeout error (link to logs). I'm investigating and will update in 1 hour." |
| "Can you review my PR?" | "Can you review my PR (#123)? It's ~200 lines touching the auth flow. Happy to answer questions async or sync." |

### Set Clear Expectations

Make response expectations explicit:

- **Deadline:** "Feedback needed by Friday EOD"
- **Priority:** "Not urgent, whenever you have time"
- **Type of response:** "Looking for approval" vs. "Want to brainstorm"
- **Who should respond:** "@team" vs. specific people

## Anti-Patterns

### The Slack Novel

Long-form content in chat messages:

- Hard to skim
- Gets lost in scroll
- Can't be edited or organized

**Fix:** Put it in a document, share the link.

### The Ping-Pong Conversation

Back-and-forth that takes 3 hours in chat but would take 10 minutes in a call:

**Fix:** After 3 exchanges, offer "Want to hop on a quick call?"

### The Surprise Meeting

Adding meetings without context or asking availability:

**Fix:** Always include agenda; ask before scheduling.

### The Ghost

Disappearing without communication:

**Fix:** Post status when stepping away; respond to acknowledge messages even if you can't fully address them.

### The Always-On Expectation

Expecting immediate responses:

**Fix:** Set team norms about response times; use async by default.

## Team Norms

Consider establishing explicit norms:

```markdown
## Our Communication Norms

### Response Times
- **Slack DM:** Within 4 working hours
- **Slack channel:** Within 24 hours
- **Email:** Within 48 hours
- **Document comments:** Before stated deadline

### Urgent vs. Non-Urgent
- For truly urgent: Use @here or call
- For everything else: Assume async

### Deep Work Protection
- No expectation of response during focus time (blocked on calendar)
- "Do Not Disturb" is respected

### Time Zone Respect
- Core overlap hours: 10am-2pm EST
- Meetings scheduled in overlap hours only
- Async preferred outside overlap
```
