---
name: time-awareness
description: Supplies the agent with the current date and time, timezone, and session-elapsed context so it never guesses or hallucinates temporal facts. Use whenever the user asks about today, tomorrow, yesterday, the current date, what time it is, deadlines, schedules, how long ago something happened, timezones, business hours, this week, this month, session length, conversation duration, or any relative time reference (e.g., "3 hours ago", "next Tuesday"), or when the answer would change if asked at a different date or time. Activates before answering any such question, even if the user never explicitly mentions time. Do not activate for general knowledge questions, historical facts, or tasks unrelated to the current moment.
---

# Time Awareness

## Purpose
This skill gives the agent accurate awareness of the current moment — the date, the time, the timezone, and (when the platform provides it) the shape of the ongoing conversation. LLMs have no internal clock; without this skill they guess, infer from stale training data, or reason from an imaginary "today." This skill ensures every time-dependent answer is grounded in fresh, real time data.

## When to Use
Activate this skill before answering any question whose correctness depends on the current moment. Specific trigger conditions:

- Before answering any question that mentions dates, deadlines, or schedules ("Is the deadline this Friday?", "When is the release scheduled?")
- Before answering relative time references ("3 hours ago", "next week", "last month", "in 2 days")
- Before answering timezone or business hours questions ("What time is it in Tokyo?", "Are London offices open now?")
- Before answering questions about conversation length or session duration ("How long have we been talking?", "How many messages into this conversation are we?")
- When the user asks directly: "what time is it", "what's today's date", "what day is it", "what is the date today"
- When the answer would change depending on when it is asked — even if the user does not mention time explicitly
- When unsure whether time matters: prefer activating early. A time fetch is cheap; a wrong date is costly.

## Data to Request
Fetch time data in this order of preference:

1. **Injected time context** — if the platform provides current time in the system prompt, environment, or conversation context (e.g., a "Today's date is…" line), read it. This is the fastest path and costs no tool calls.
2. **`get_current_time` tool** — otherwise, call the platform's `get_current_time` tool/function. Do not proceed without time data if the question depends on it.
3. **Shell/system clock fallback** — if the platform has no `get_current_time` tool, read the system clock via the platform's shell (e.g., `date` for local + `date -u` for UTC, or the equivalent language command). This is still fresh, real time data — never substitute a guess or a memory of a date.
4. **Session metadata** — if the question is about conversation length, duration, or turn count, request session metadata (session start, turn count, elapsed time) from the platform. **Note: real session metadata requires platform integration and may be unavailable.** If unavailable, say so honestly rather than estimating or inventing it.

Request the full schema below when calling `get_current_time`. If the platform returns fewer fields, use what it returns; never fill gaps by guessing.

## Mandatory Reasoning Rules
1. **UTC for arithmetic, local for answers** — Perform all duration calculations, comparisons, and ordering in UTC. Report the final answer in the machine's local time (the user's zone) first — it must match the user's own clock — and include UTC as the reference instant. A bare UTC time that differs from the user's clock reads as wrong.
2. **Explicit timezone** — Always name the timezone when stating a clock time. Never say "3 PM" alone.
3. **Relative language last** — Convert timestamps to human-relative phrases ("3 hours ago", "next Tuesday") only after reasoning is complete.
4. **No guessing** — If time data is unavailable, state that you do not know the current time. Do not invent timestamps or session data.
5. **Session awareness** — Use elapsed time and turn count to gauge conversation depth and possible urgency. Note: real session metadata requires platform integration and may not be available.
6. **No hardcoded dates** — Never use a date baked into your training data. Always fetch fresh time data.
7. **Offset ≠ timezone.** A matching UTC offset does not mean two places share a timezone. `+01:00` could be BST (summer London), CET (Central Europe), or Morocco's permanent UTC+1. Always name the IANA zone (`Europe/London`, `Africa/Casablanca`, `Europe/Paris`) when identifying where a time applies. Never infer a location from an offset alone.

## Schema Reference
When calling `get_current_time`, expect a response shaped like this:

```json
{
  "utc_timestamp": "2026-01-07T14:30:00Z",
  "iso_8601": "2026-01-07T09:30:00-05:00",
  "timezone": "America/New_York",
  "timezone_abbreviation": "EST",
  "utc_offset": "-05:00",
  "day_of_week": "Wednesday",
  "date": "2026-01-07",
  "unix_seconds": 1767803400,
  "is_dst": false
}
```

Field notes: `timezone` is an IANA name (never an ambiguous abbreviation). `utc_timestamp` is the canonical value for arithmetic; `iso_8601` is the same instant in the local zone with offset; `unix_seconds` is for computation. `is_dst` tells you whether daylight saving is active.

## Example
> **User:** "Is it too late to call the London office?"
> 1. Fetch current time (UTC + local + timezone)
> 2. Reason in UTC, then convert to London local time
> 3. Answer: "It's currently 18:45 BST in London. Most offices will already be closed."

## Limitations
- **Session metadata** (session start, turn count, elapsed time) requires platform integration and may be unavailable. This skill cannot invent it.
- This skill provides the current moment only; it is not a calendar or scheduling tool. It cannot look up events, holidays, or future dates beyond calendar arithmetic from the current moment.
- Timezone conversion assumes the platform returns correct IANA-aware data; the skill does not compute offsets itself.