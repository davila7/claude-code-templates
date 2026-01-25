---
name: professional-communication
description: Guide technical communication for software developers. Covers email structure, team messaging etiquette, meeting agendas, and adapting messages for technical vs non-technical audiences. Use when drafting professional messages, preparing meeting communications, or improving written communication.
allowed-tools: Read, Glob, Grep
---

# Professional Communication

## Overview

This skill provides frameworks and guidance for effective professional communication in software development contexts. Whether you're writing an email to stakeholders, crafting a team chat message, or preparing meeting agendas, these principles help you communicate clearly and build professional credibility.

**Core principle:** Effective communication isn't about proving how much you know - it's about ensuring your message is received and understood.

## When to Use This Skill

Use this skill when:

- Writing emails to teammates, managers, or stakeholders
- Crafting team chat messages or async communications
- Preparing meeting agendas or summaries
- Translating technical concepts for non-technical audiences
- Structuring status updates or reports
- Improving clarity of written communication

**Keywords**: email, chat, teams, slack, discord, message, writing, communication, meeting, agenda, status update, report

## Core Frameworks

### The What-Why-How Structure

Use this universal framework to organize any professional message:

| Component | Purpose | Example |
| --- | --- | --- |
| **What** | State the topic/request clearly | "We need to delay the release by one week" |
| **Why** | Explain the reasoning | "Critical bug found in payment processing" |
| **How** | Outline next steps/action items | "QA will retest by Thursday; I'll update stakeholders Friday" |

**Apply to**: Emails, status updates, meeting talking points, technical explanations

### Three Golden Rules for Written Communication

1. **Start with a clear subject/purpose** - Recipients should immediately grasp what your message is about
2. **Use bullets, headlines, and scannable formatting** - Nobody wants a wall of text
3. **Key messages first** - Busy people appreciate efficiency; state your main point upfront

### Audience Calibration

Before communicating, ask yourself:

1. **Who** are you writing to? (Technical peers, managers, stakeholders, customers)
2. **What level of detail** do they need? (High-level overview vs implementation details)
3. **What's the value** for them? (How does this affect their work/decisions?)

## Email Best Practices

### Subject Line Formula

| Instead of | Try |
| --- | --- |
| "Project updates" | "Project X: Status Update and Next Steps" |
| "Question" | "Quick question: API rate limiting approach" |
| "FYI" | "FYI: Deployment scheduled for Tuesday 3pm" |

### Email Structure Template

```markdown
**Subject:** [Project/Topic]: [Specific Purpose]

Hi [Name],

[1-2 sentences stating the key point or request upfront]

**Context/Background:**
- [Bullet point 1]
- [Bullet point 2]

**What I need from you:**
- [Specific action or decision needed]
- [Timeline if applicable]

[Optional: Brief next steps or follow-up plan]

Best,
[Your name]
```

### Common Email Types

| Type | Key Elements |
| --- | --- |
| **Status Update** | Progress summary, blockers, next steps, timeline |
| **Request** | Clear ask, context, deadline, why it matters |
| **Escalation** | Issue summary, impact, attempted solutions, needed decision |
| **FYI/Announcement** | What changed, who's affected, any required action |

**For templates**: See `references/email-templates.md`

## Team Messaging Etiquette

> **Note:** Examples use Slack terminology, but these principles apply equally to Microsoft Teams, Discord, or any team messaging platform.

### When to Use Chat vs Email

| Use Chat | Use Email |
| --- | --- |
| Quick questions with short answers | Detailed documentation needing records |
| Real-time coordination | Formal communications to stakeholders |
| Informal team discussions | Messages requiring careful review |
| Time-sensitive updates | Complex explanations with multiple parts |

### Team Messaging Best Practices

1. **Use threads** - Keep main channels scannable; follow-ups go in threads
2. **@mention thoughtfully** - Don't notify people unnecessarily
3. **Channel organization** - Right channel for right topic
4. **Be direct** - "Can you review my PR?" beats "Hey, are you busy?"
5. **Async-friendly** - Write messages that don't require immediate response

### The "No Hello" Principle

Instead of:

```text
You: Hi
You: Are you there?
You: Can I ask you something?
[waiting...]
```

Try:

```text
You: Hi Sarah - quick question about the deployment script.
     Getting a permission error on line 42. Have you seen this before?
     Here's the error: [paste error]
```

## Technical vs Non-Technical Communication

### When to Be Technical vs Accessible

| Audience | Approach |
| --- | --- |
| **Engineering peers** | Technical details, code examples, architecture specifics |
| **Technical managers** | Balance of detail and high-level impact |
| **Non-technical stakeholders** | Business impact, analogies, outcomes over implementation |
| **Customers** | Plain language, what it means for them, avoid jargon |

### Three Strategies for Simplification

1. **Start with the big picture before details** - People process "why" before "how"
2. **Simplify without losing accuracy** - Use analogies; replace jargon with plain language
3. **Know when to switch** - Read the room; adjust based on questions and engagement

### Jargon Translation Examples

| Technical | Plain Language |
| --- | --- |
| "Microservices architecture" | "Our system is split into smaller, independent pieces that can scale separately" |
| "Asynchronous message processing" | "Tasks are queued and processed in the background" |
| "CI/CD pipeline" | "Automated process that tests and deploys our code" |
| "Database migration" | "Updating how our data is organized and stored" |

**For more examples**: See `references/jargon-simplification.md`

## Writing Clarity Principles

### Active Voice Over Passive Voice

Active voice is clearer, more direct, and conveys authority:

| Passive (avoid) | Active (prefer) |
| --- | --- |
| "A bug was identified by the team" | "The team identified a bug" |
| "The feature will be implemented" | "We will implement the feature" |
| "Errors were found during testing" | "Testing revealed errors" |

### Eliminate Filler Words

| Instead of | Use |
| --- | --- |
| "At this point in time" | "Now" |
| "In the event that" | "If" |
| "Due to the fact that" | "Because" |
| "In order to" | "To" |
| "I just wanted to check if" | "Can you" |

### The "So What?" Test

After writing, ask: "So what? Why does this matter to the reader?"

If you can't answer clearly, restructure your message to lead with the value/impact.

## Meeting Communication

### Before: Agenda Best Practices

Every meeting invite should include:

1. **Clear objective** - What will be accomplished?
2. **Agenda items** - Topics to cover with time estimates
3. **Preparation required** - What should attendees bring/review?
4. **Expected outcome** - Decision needed? Information sharing? Brainstorm?

### During: Facilitation Tips

- **Time-box discussions** - "Let's spend 5 minutes on this, then move on"
- **Capture action items live** - Who does what by when
- **Parking lot** - Note off-topic items for later

### After: Summary Format

```markdown
**Meeting: [Topic] - [Date]**

**Attendees:** [Names]

**Key Decisions:**
- [Decision 1]
- [Decision 2]

**Action Items:**
- [ ] [Person]: [Task] - Due [Date]
- [ ] [Person]: [Task] - Due [Date]

**Next Steps:**
- [Follow-up meeting if needed]
- [Documents to share]
```

**For structures by meeting type**: See `references/meeting-structures.md`

## Quick Reference: Communication Checklist

Before sending any professional communication:

- [ ] **Clear purpose** - Can the recipient understand intent in 5 seconds?
- [ ] **Right audience** - Is this the appropriate person/channel?
- [ ] **Key message first** - Is the main point upfront?
- [ ] **Scannable** - Are there bullets, headers, short paragraphs?
- [ ] **Action clear** - Does the recipient know what (if anything) they need to do?
- [ ] **Jargon check** - Will the audience understand all terminology?
- [ ] **Tone appropriate** - Is it professional but not cold?
- [ ] **Proofread** - Any typos or unclear phrasing?

## Additional Tools

- `references/email-templates.md` - Ready-to-use email templates by type
- `references/meeting-structures.md` - Structures for standups, retros, reviews
- `references/jargon-simplification.md` - Technical-to-plain-language translations

## Companion Skills

- `feedback-mastery` - For difficult conversations and feedback delivery
- `/draft-email` - Generate emails using these frameworks

---

**Last Updated:** 2025-12-22

## Version History

- **v1.0.0** (2025-12-26): Initial release

---
