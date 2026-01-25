---
name: feedback-mastery
description: Navigate difficult conversations and deliver constructive feedback using structured frameworks. Covers the Preparation-Delivery-Follow-up model and Situation-Behavior-Impact (SBI) feedback technique. Use when preparing for difficult conversations, giving feedback, or managing conflicts.
allowed-tools: Read, Glob, Grep
---

# Feedback Conversations

## Overview

This skill provides frameworks for navigating difficult workplace conversations and delivering effective feedback. Whether you're addressing performance issues, resolving conflicts, or giving constructive feedback, these structured approaches lead to better outcomes.

**Core insight:** Research shows that employees who approach difficult conversations with preparation and a clear framework are **60% more likely to reach a positive resolution** than those who engage without a plan.

## When to Use This Skill

Use this skill when:

- Preparing to give feedback to a colleague or direct report
- Addressing performance issues or missed expectations
- Navigating conflict between team members
- Having 1:1 conversations about sensitive topics
- Receiving feedback and wanting to respond constructively
- Managing expectations with stakeholders

**Keywords**: feedback, difficult conversation, 1:1, one-on-one, performance, conflict, expectations, behavior, confrontation

## Core Frameworks

### The Preparation-Delivery-Follow-up Model

A three-part structure for difficult conversations:

| Phase | Focus | Key Questions |
| --- | --- | --- |
| **Preparation** | Understand the issue, define goals, manage emotions | What's the problem? What outcome do I want? Am I calm? |
| **Delivery** | Open neutrally, use facts not blame, encourage dialogue | How do I start? What evidence do I have? How do I involve them? |
| **Follow-up** | Document actions, set check-ins, provide support | What did we agree to? When will we check in? How do I support? |

### The SBI Feedback Model

**Situation-Behavior-Impact (SBI)** structures feedback to be specific, objective, and actionable:

| Component | Description | Example |
| --- | --- | --- |
| **Situation** | Describe the specific context | "During yesterday's code review..." |
| **Behavior** | State the observable action (not interpretation) | "...you interrupted Sarah three times while she was explaining her approach..." |
| **Impact** | Explain the effect on team/project/person | "...which made her hesitate to share ideas and slowed down our discussion." |

**Why it works:** SBI removes assumptions and focuses on observable facts, reducing defensiveness.

## Preparation Phase

### Step 1: Understand the Issue

Ask yourself:

- **What exactly is the problem?** (Be specific, not vague)
- **How does it impact the team, project, or company?**
- **Have I gathered all relevant facts?**
- **Is this a pattern or a one-time event?**

### Step 2: Define Your Goals

Before the conversation, clarify what you're seeking:

| Goal Type | Example |
| --- | --- |
| Behavior change | "I want them to submit code reviews on time" |
| Mutual understanding | "I want to understand what's blocking them" |
| Expectation setting | "I want to clarify what 'done' means for features" |
| Problem solving | "I want to find a solution together" |

**Tip:** Use if-then statements to clarify stakes:
> "If this behavior continues, then the project timeline will suffer, leading to missed deliverables."

### Step 3: Manage Your Emotions

High emotional intensity reduces cognitive processing by 30%. Before the conversation:

- [ ] Am I calm and in control?
- [ ] Have I separated facts from personal frustrations?
- [ ] Have I considered their perspective?
- [ ] Can I present this without accusation?

**Reframing technique:**

| Accusatory | Constructive |
| --- | --- |
| "You always miss deadlines and it slows everyone down" | "I've noticed some recent delays and want to understand any challenges you're facing" |
| "You never test your code properly" | "I've seen a few bugs slip through recently. Let's talk about our testing process" |

## Delivery Phase

### The Three-Step Delivery Formula

1. **Open with neutrality and intent**
2. **Present the issue using facts, not blame**
3. **Encourage dialogue and solutions**

### Opening Lines That Work

| Context | Opening |
| --- | --- |
| General | "I want to talk about something important to our team's success, and I'd love to hear your perspective." |
| Performance | "I've noticed some patterns I'd like to discuss. My goal is to support you, not criticize." |
| Conflict | "I sense there might be some tension, and I'd like to understand what's happening from your side." |
| Expectations | "I want to make sure we're aligned on expectations. Can we talk through how this project is going?" |

### Facts, Not Blame

| Blaming | Factual |
| --- | --- |
| "You're not committed to this project" | "I've noticed your updates have been brief in our last three meetings. Is something affecting your workload?" |
| "You don't care about code quality" | "This PR had 12 bugs caught in QA. Let's talk about what happened and how we can improve" |
| "You're always late" | "The standup started at 9:00 and you joined at 9:15 the last three days. What's going on?" |

**Key principles:**

- Use specific examples, not generalizations ("always," "never")
- Stick to observable behaviors, not assumptions about motives
- Focus on impact, not character

### Encouraging Dialogue

After stating your observation, shift to collaboration:

| Situation | Dialogue Prompt |
| --- | --- |
| Understanding barriers | "What's been challenging about this?" |
| Seeking their view | "How do you see the situation?" |
| Finding solutions | "What would help you succeed here?" |
| Checking alignment | "Does this match your understanding of what happened?" |

## Follow-up Phase

Even successful conversations need follow-through to create lasting change.

### Follow-up Checklist

- [ ] **Document agreed-upon action items** - What specifically will change?
- [ ] **Set check-in dates** - When will you revisit this?
- [ ] **Provide ongoing support** - How will you help them succeed?
- [ ] **Celebrate progress** - Recognize improvements when they happen

### Sample Follow-up Message

```markdown
Hi [Name],

Thanks for the conversation yesterday. I appreciated your openness.

**What we agreed to:**
- [Action item 1] - [Timeline]
- [Action item 2] - [Timeline]

**Check-in:** Let's reconnect [date] to see how things are going.

I'm here if you need any support. Thanks for working through this with me.

Best,
[Your name]
```

## SBI Examples for Software Teams

### Positive Feedback

**Code Review:**
> **Situation:** "During Tuesday's code review for the authentication module..."
> **Behavior:** "...you provided detailed comments on potential security vulnerabilities and suggested efficient fixes..."
> **Impact:** "...which strengthened our security posture and saved the team hours of debugging later."

**Collaboration:**
> **Situation:** "In yesterday's architecture discussion..."
> **Behavior:** "...you asked clarifying questions and built on others' ideas instead of pushing your own solution..."
> **Impact:** "...which helped us reach consensus faster and made everyone feel heard."

### Constructive Feedback

**Missed Deadlines:**
> **Situation:** "When we were finalizing the API deployment last Thursday..."
> **Behavior:** "...your testing results came in two hours after our agreed cutoff..."
> **Impact:** "...which delayed the release, risked our SLA, and caused the QA team to work overtime."

**Meeting Behavior:**
> **Situation:** "In our sprint planning yesterday..."
> **Behavior:** "...you were on your phone for most of the discussion and didn't contribute when we asked for estimates..."
> **Impact:** "...which left the team without your expertise on the backend stories and made others feel their time wasn't valued."

**For more examples:** See `references/feedback-sbi-model.md`

## Common Difficult Scenarios

### Scenario: Performance Issue

**Situation:** A developer consistently delivers code with bugs.

**Approach:**

1. **Prepare:** Gather specific examples (PRs, bug counts, timelines)
2. **Deliver:** "I've noticed [X bugs in last Y PRs]. I want to understand what's happening and how I can support you."
3. **Explore:** Ask about workload, clarity of requirements, testing confidence
4. **Collaborate:** "What would help you feel more confident about code quality?"
5. **Follow-up:** Check in after agreed changes, recognize improvements

### Scenario: Conflict Between Team Members

**Situation:** Two engineers disagree on technical approach and it's affecting the team.

**Approach:**

1. **Meet separately first:** Understand each perspective
2. **Find common ground:** What do they both want? (Working product, good code, etc.)
3. **Facilitate together:** Focus on facts and trade-offs, not personalities
4. **Establish decision process:** How will the team decide when there's disagreement?
5. **Follow-up:** Check that the solution is working

### Scenario: Unrealistic Expectations

**Situation:** Leadership wants a feature in half the time needed.

**Approach:**

1. **Prepare:** Data on similar past work, breakdown of required tasks
2. **Deliver:** "I want to make sure we're aligned on what's realistic. Here's what I'm seeing..."
3. **Present trade-offs:** "We can hit that date if we [reduce scope/add people/accept risk]"
4. **Collaborate:** "What's most important here - the date or the full feature set?"
5. **Document:** Get agreement in writing to avoid future misalignment

**For detailed scripts:** See `references/difficult-conversation-scripts.md`

## Receiving Feedback Well

When you're on the receiving end:

### During the Conversation

1. **Listen fully** - Don't prepare your defense while they're talking
2. **Ask clarifying questions** - "Can you give me a specific example?"
3. **Paraphrase to confirm** - "So what you're saying is..."
4. **Acknowledge impact** - Even if intent was different: "I can see how that affected you"
5. **Don't get defensive** - Thank them for raising it

### After the Conversation

1. **Reflect honestly** - Is there truth in the feedback?
2. **Identify actions** - What will you do differently?
3. **Follow up** - Let them know what you're changing
4. **Ask for ongoing feedback** - Show you're committed to growth

## Quick Reference: Difficult Conversation Checklist

### Before

- [ ] I understand the specific issue
- [ ] I have concrete examples
- [ ] I've defined my goal for the conversation
- [ ] I'm emotionally regulated
- [ ] I've considered their perspective

### During

- [ ] I opened with neutrality and intent
- [ ] I stated facts, not blame
- [ ] I used SBI for specific feedback
- [ ] I asked for their perspective
- [ ] I focused on solutions, not just problems
- [ ] I documented agreed actions

### After

- [ ] I sent a follow-up summary
- [ ] I scheduled a check-in
- [ ] I'm providing ongoing support
- [ ] I'm recognizing progress

## Companion Resources

- `references/feedback-sbi-model.md` - Full SBI framework with more examples
- `references/difficult-conversation-scripts.md` - Opening lines and responses
- `references/expectation-alignment.md` - Managing stakeholder expectations


## Recommended Reading

- "Crucial Conversations" by Kerry Patterson & Joseph Grenny
- "Difficult Conversations" by Stone, Patton, Heen
- "Radical Candor" by Kim Scott
- Amy Edmondson's research on psychological safety

---
