---
name: qa-runbook
description: Run a QA sweep for any app against the qa-runbook MCP — establish what is under test, create real test accounts, drive web and mobile, verify fixes, and record results with evidence. Use when asked to run QA, test a section, retest a check, clear a QA backlog, or verify a fix against a runbook.
version: 1.1.1
author: qarunbook
license: MIT
tags: [QA, Testing, UAT, MCP, Bug Tracking]
repository: https://github.com/Ifeanyiejindu/qarunbook
---

# QA runbook

Drive a QA runbook held in the `qa-runbook` MCP for whatever app is under test. This skill is
app-agnostic: it establishes what it needs, then applies the discipline below.

**If a skill already exists for this specific app, use that instead** — it will carry the real
URLs, credentials, device setup and known blockers. Check the available-skills list for something
matching the app name. This skill is for apps that don't have one yet, and it ends by offering to
write one.

## 1. Establish what you're testing

`list_apps` first — it names every app the runbook holds. If exactly one matches what the user
asked for, use it. If several could, or none obviously does, ask.

Then work out what you're missing. **Ask in one batch, not one at a time**, and only for what you
genuinely can't determine yourself:

- **Which app** in the runbook (skip if `list_apps` settles it)
- **The live URL(s)** — the web app, and the API base if the runbook has server-level checks
- **Codebase path(s)**, if any — without them you can still test behaviour, but you can't diagnose
  a cause or tell a stale build from a real defect. Ask which repos exist (backend / web / mobile
  are often separate) and whether pushing deploys anything.
- **How to get a test account** — existing credentials, or the signup flow. See §3.
- **Scope** — the whole runbook, one section, one platform, or re-verifying specific fixes.

Use `list_checks` and `progress` to see the shape before planning. A check's own wording is the
spec; read it before testing, not after.

## 2. The one rule

**Never mark a cell `P` you did not actually observe.** A stale "needs retest" you couldn't prove
stays that way. Quote the real request and response, or what was on screen. A note that says
"verified" and nothing else is worthless later — and a wrongly-passed cell is worse than an
untested one, because nobody looks again.

State in every note what your evidence does **not** cover. "The server refuses correctly; nobody
has seen a client render the refusal" is a complete, honest result.

Related traps:
- **A stale build is not a bug.** Before filing anything from a device or a deployed site, check
  what's actually running against the repo HEAD. Year-old binaries have produced whole batches of
  phantom failures.
- **Check the timestamps.** A cell marked failing before the fix shipped is a stale mark, not a
  defect. Compare the mark's date against the commit and deploy dates.
- **Don't let one platform's pass carry to another.** Verify each separately unless you can point
  at shared code *and* say so in the note.

## 3. Test accounts

There are two ways to be signed in, and one of them must be settled before anything behind a
login is tested: **an account the user gives you**, or **one you create yourself**. Never test
from a real customer's account, and never guess credentials.

Ask for credentials in the §1 batch. If none are offered, create one — and say which address you
used, so the account can be found again later.

Creating one, the usual shape:

1. `POST` the signup endpoint.
2. If the app requires email verification, you need the code. **Plus-aliasing is the trick that
   usually works**: `you+qa123@gmail.com` delivers to `you@gmail.com`, so the verification email
   is readable with the Gmail/mail tools available to you. This avoids touching the database.
3. Verify, then log in and keep the token.

Check what signup fixes permanently — country, currency, plan, locale often can't be changed
later, so create the account you actually need.

**Do not write to a production database to activate an account.** The permission classifier
blocks it, and you should not route around it. If the email route genuinely doesn't exist, say so
and let the account owner decide.

Watch how the API returns its token: some already include the `Bearer ` prefix, and
double-prefixing produces 401s that look exactly like a correct refusal.

## 4. Driving the surfaces

**Web.** Login forms built on React controlled inputs ignore a plain `.value` set — use the
native setter and dispatch the events:
```js
const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')
  .set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));};
```
Test phone width at a real narrow viewport, not by assuming the desktop result carries.

**Android.** `adb shell input text` mangles spaces — use `%s`; `#` needs `keyevent 18`. Screenshot
to confirm a field before submitting. `keyevent 4` (BACK) navigates away when no keyboard is up —
dismiss a keyboard with the IME chevron instead. Screenshot before navigating: a stale dialog will
swallow your taps.

**iOS.** Attach the simulator panel *before* building, so the user can watch and so device-access
prompts surface early.

**Rebuild mobile before testing it**, and point the build at the environment you mean to test.

## 5. Recording

- `set_result` takes `P` or `F`. To make a platform not applicable to a check, use `update_check`
  with `not_applicable_on` — never mark it `P` to get it out of the way.
- Where you need a durable note, `add_issue` with the evidence then `resolve_issue`.
- Resolving an issue moves its cells to "needs retest", not to passing — someone must then record
  a result.

**Scope an evidence note to the platform you are recording, and no wider.** `add_issue` takes the
pass away on every platform you list, and `resolve_issue` then leaves them all at "needs retest" —
including cells another tester had already passed. Three agents have now knocked down someone
else's `P` this way while finding nothing wrong with it. If your note is about WM, pass
`["WM"]`, not every platform the defect might theoretically touch. If you do displace a mark,
say so explicitly in your report rather than quietly re-marking a cell you did not observe.
- Found something genuinely broken? `add_issue` rather than quietly marking `F`.
- An issue that is vague or wrong — yours or a tester's — gets corrected with `edit_issue`, not a
  second issue. The original reporter stays on it and the old wording is kept in its history.
- `list_issues` names any files a tester attached (screenshots, recordings, logs). They are viewed
  in the web app; say in your report when one is worth a human looking at.

## 6. Fanning out

Run several agents in parallel across *different* sections.

**Every agent does the whole job itself: makes its own test account, signs in, and tests the
real paths.** Not HTTP calls standing in for a screen, not signed-out pages only, not a token
posted to it by the main session. An agent that does less than a person doing that section by
hand is worth nothing — the point of the sweep is that the application was actually used.

So each agent's prompt carries the §3 account recipe — signup call, the plus-alias inbox to read
the code from, verify, log in — and the agent runs it. Its own account, its own session, so
agents never collide over one login. §4 has what signing in through a web form needs (the native
setter, then the click); a form is filled, not skipped.

**One actor per device, though.** Accounts scale; a simulator or emulator does not. It is a
single, shared, stateful thing. On 19 Sep the main session and a dispatched agent drove the same
iPhone simulator at once and each kept landing on the other's screen — observations from a device
two actors are touching are worth nothing, and you cannot tell your own stale dialog from theirs.
Decide up front who owns each device and keep that device's work in one place.

**"I could not log in" is not a result, and neither is "covered at the API level".** A check
behind a login is tested behind that login, on the surface the check names. If an agent truly
cannot reach something, it says exactly what it tried and what stopped it, and that check stays
unrecorded for someone to take — but that is a failure to be fixed, not a normal outcome.

Every agent prompt should carry: the exact check refs, the base URL, the account recipe, the
app's gotchas, "create your own account and sign in — do not report anything as blocked on
login", "do not mark anything passing you did not observe", and "do not commit or push". Ask for
what they ruled out, not just what they found.

**Read what an agent refused to conclude.** Those notes are usually right, and the gap they name
is usually the actual remaining work. Verify an agent's headline claim before acting on it — the
observation is normally sound, the conclusion drawn from it sometimes isn't.

## 7. Finding real causes

Two patterns account for a lot of hard bugs — check both before writing code:

- **The fix landed on a screen nobody opens.** Confirm which screen the user actually reaches.
- **The client speaks a vocabulary the API never sends.** Grep the server for the literal before
  trusting a client branch on it.

## 8. Safety

Read-only by default. Never complete a purchase, move money, submit a withdrawal, or delete data
you didn't create. Small test data is fine — **say what you left behind**, every time.

**Never put a destructive verb in a permission-probe battery.** The way you prove an
authorisation hole is to run the same request as the owner, as a stranger, and signed out. If
`DELETE` is in that list, the owner's pass *succeeds* — and on 19 Sep it did: an agent sweeping
X-20 deleted a live production event. `EventService.delete` is a HARD delete that cascades, so it
took the event, its 18 invitees, the staff access codes, seating, team grants, sessions,
registration forms and every submission. None of it is recoverable through the API, and the
observation it was meant to produce was worthless anyway — the stranger's 404 came back because
the row no longer existed, not because access was refused.

Build the probe so destructive verbs are only ever sent as the **unauthorised** identity. Read
first, and confirm the refusal is a refusal and not an absence.

**This applies to agents you dispatch.** "Do not commit and do not push" does not cover
`DELETE /event/:id`. Say the destructive rule out loud in every agent prompt.

## 9. Leave something behind

At the end of a sweep, offer to write an app-specific skill capturing what you learned: the URLs,
the account recipe, the gotchas that cost you a false finding, the blockers that need the owner.
That's what makes the next run cheap. `~/.claude/skills/<app>-qa/SKILL.md`, same shape as this
one, with the specifics filled in.
