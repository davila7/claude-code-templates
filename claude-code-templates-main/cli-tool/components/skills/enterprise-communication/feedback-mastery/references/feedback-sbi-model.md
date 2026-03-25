# SBI Feedback Model - Complete Guide

The Situation-Behavior-Impact (SBI) model, developed by the Center for Creative Leadership, provides a structured approach to giving clear, objective feedback that minimizes defensiveness and promotes improvement.

## The SBI Formula

```text
Situation + Behavior + Impact = Effective Feedback
```

| Component | What It Is | What It's NOT |
| --- | --- | --- |
| **Situation** | When and where the behavior occurred | Vague timing or generalizations |
| **Behavior** | Observable actions the person took | Assumptions about motives or character |
| **Impact** | Effect on you, the team, or the project | Judgment or evaluation |

## Why SBI Works

1. **Specificity** - Concrete examples are harder to dismiss than vague complaints
2. **Objectivity** - Observable behaviors can't be argued; interpretations can
3. **Actionability** - Clear situations and behaviors can be repeated or changed
4. **Non-threatening** - Impact focuses on effects, not character attacks

## SBI Examples: Positive Feedback

### Code Review Excellence

> **Situation:** "In the code review for the payment processing module last Tuesday..."
>
> **Behavior:** "...you not only caught the edge case that would have caused data loss, but you also suggested a more elegant solution using the repository pattern and included tests that demonstrated the issue..."
>
> **Impact:** "...which prevented a potentially costly bug in production and taught our junior developers about defensive coding. The whole team learned from your thoroughness."

### Meeting Contribution

> **Situation:** "During our architecture decision meeting this morning..."
>
> **Behavior:** "...you asked three questions that reframed the problem and suggested we document our trade-offs in an ADR..."
>
> **Impact:** "...which helped us reach consensus in half the usual time and gave us documentation we can reference later."

### Mentorship

> **Situation:** "Over the past month while onboarding Maya..."
>
> **Behavior:** "...you've been setting up daily 15-minute check-ins, creating a shared doc of resources, and giving her progressively more complex tasks..."
>
> **Impact:** "...which has accelerated her ramp-up significantly. She submitted her first independent PR two weeks ahead of our typical onboarding timeline."

### Cross-Team Collaboration

> **Situation:** "When the DevOps team asked for help migrating the deployment pipeline last week..."
>
> **Behavior:** "...you volunteered to pair with their engineer, documented the process as you went, and stayed late to ensure the cutover succeeded..."
>
> **Impact:** "...which built goodwill between our teams and created documentation that will help us next time."

## SBI Examples: Constructive Feedback

### Missed Deadlines

> **Situation:** "This sprint, the API endpoint work was due on Wednesday..."
>
> **Behavior:** "...it was delivered on Friday without any communication about the delay..."
>
> **Impact:** "...which blocked the frontend team for two days, caused them to miss their milestone, and created tension between our teams."

**Follow-up prompt:** "What happened? Is there something blocking you that I should know about?"

### Code Quality Issues

> **Situation:** "In the last three PRs you submitted..."
>
> **Behavior:** "...there were no unit tests and several of the changes broke existing tests that weren't updated..."
>
> **Impact:** "...which caused the CI pipeline to fail repeatedly, blocked other developers' merges, and required the tech lead to spend time debugging."

**Follow-up prompt:** "I want to understand what's making testing difficult. Is there something about our test setup or your workload that's contributing to this?"

### Meeting Behavior

> **Situation:** "In yesterday's standup..."
>
> **Behavior:** "...when Alex was describing their blocker, you interrupted three times to offer solutions before they finished explaining..."
>
> **Impact:** "...which made Alex visibly frustrated and may have prevented them from sharing the full context of the problem."

**Follow-up prompt:** "I know you're eager to help, and that's great. Can we try letting people finish before jumping in?"

### Communication Gaps

> **Situation:** "When the production issue happened on Monday..."
>
> **Behavior:** "...you started investigating immediately but didn't post updates in the incident channel for 45 minutes..."
>
> **Impact:** "...which left leadership and customer support without information to share with affected clients, and caused multiple people to ask for status updates, further distracting you."

**Follow-up prompt:** "During incidents, even brief updates help. What would make it easier to communicate while you're troubleshooting?"

### Lack of Engagement

> **Situation:** "In our last three sprint planning sessions..."
>
> **Behavior:** "...you haven't provided estimates or raised concerns about any of the stories..."
>
> **Impact:** "...which means we're missing your technical perspective, and some stories have turned out to be much larger than expected."

**Follow-up prompt:** "Your input is valuable. Is there something about our planning process that's making it hard to participate?"

## Common Mistakes to Avoid

### Mistake 1: Vague Situation

❌ "Recently..."
❌ "In general..."
❌ "Sometimes..."

✅ "In yesterday's standup..."
✅ "During the deployment on March 15th..."
✅ "In the code review for PR #1234..."

### Mistake 2: Interpreting Instead of Observing

❌ "You don't care about quality" (interpretation)
✅ "The PR had 12 bugs caught in QA" (observable)

❌ "You're not engaged" (interpretation)
✅ "You were on your phone during the demo" (observable)

❌ "You're being defensive" (interpretation)
✅ "You raised your voice and said 'that's not my fault'" (observable)

### Mistake 3: Generalizing Behavior

❌ "You always miss deadlines" (generalization)
✅ "The last three deliverables were past their due date" (specific)

❌ "You never test your code" (generalization)
✅ "The last two PRs had no unit tests" (specific)

### Mistake 4: Making Impact Personal

❌ "...which made me angry" (personal feeling as impact)
✅ "...which caused the release to be delayed" (business impact)

Personal feelings can be part of impact, but should be secondary to business/team impact:
"...which delayed the release and, honestly, created frustration for the team."

### Mistake 5: Forgetting the "So What"

Feedback needs clear impact to be meaningful. Without it:

❌ "In the meeting, you interrupted Alex three times." (So what?)

✅ "In the meeting, you interrupted Alex three times, which prevented them from fully explaining the problem and may have led to us missing important context."

## Extended SBI: Adding Intent and Next Steps

Some practitioners extend SBI to **SBI-I** (adding Intent) or **SBI-NS** (adding Next Steps):

### SBI-I: Checking Intent

After delivering SBI feedback, ask about intent:

> **SBI:** "When you pushed to main without a PR yesterday, it broke the build and blocked five developers for two hours."
>
> **I (Intent):** "I'm sure you didn't mean to cause a disruption. Can you help me understand what happened?"

### SBI-NS: Proposing Next Steps

End with a collaborative discussion of what to do differently:

> **SBI:** "When you gave estimates without checking with the backend team, the sprint became overcommitted and we had to drop two stories."
>
> **NS:** "Going forward, could we establish a quick sync with backend before finalizing sprint commitments? What would make that work for you?"

## When to Use SBI

| Scenario | Use SBI? | Notes |
| --- | --- | --- |
| Formal performance feedback | ✅ Yes | SBI provides documentation |
| Quick in-the-moment feedback | ✅ Yes | Keep it brief but structured |
| Positive recognition | ✅ Yes | Makes praise specific and meaningful |
| Annual reviews | ✅ Yes | Have multiple examples ready |
| Giving yourself feedback | ✅ Yes | Use for self-reflection |
| Venting frustration | ❌ No | Get calm first, then use SBI |

## Practice Exercise

Take a recent situation where you wanted to give feedback. Fill in:

**Situation:** ________________________________________________

**Behavior:** ________________________________________________

**Impact:** ________________________________________________

Now check:

- [ ] Is the situation specific (time/place)?
- [ ] Is the behavior observable (not an interpretation)?
- [ ] Is the impact clear (business/team effect)?

---

**Related:** Return to `feedback-mastery` skill for the full Preparation-Delivery-Follow-up framework.
