---
name: test-checklist
description: Build a complete QA test plan for an app — every module, feature and user journey, across each platform it runs on. Use when asked for a test plan, QA checklist, test cases, regression suite, or "what should we test", or when preparing an app for QA, a release or a demo. Produces markdown that imports directly into a qarunbook runbook.
version: 1.1.1
author: qarunbook
license: MIT
tags: [QA, Testing, Test Plan, UAT, Manual Testing]
repository: https://github.com/Ifeanyiejindu/qarunbook
---

# Building a test checklist

The goal is a document a **non-technical tester** can work top to bottom, where
finishing it means the app has genuinely been exercised. A missing journey is a
missed bug.

## Derive it from the code, never from memory

Walk every codebase the product ships from — backend, web, each mobile app — and
build the module list from what is actually there:

- **Backend**: the modules directory is the authoritative feature list. Controllers
  give the real endpoints, and therefore the real capabilities.
- **Web**: the routes give the surfaces; look for separate mobile components, since
  a responsive app and a purpose-built mobile view are different code.
- **Mobile**: the modules/views directories.

A feature that exists on one platform and not another is exactly the kind of gap
the document must **expose**, not paper over. List those up front as known gaps so
testers do not report deliberate differences as defects.

If the product has an existing plan, read it first and extend rather than replace.

## Structure

**Part → Section → Journey**, with a result column per platform.

Group into parts by what a person is doing, not by how the code is organised:
account and access, the core object's lifecycle, the people involved, money,
engagement, collaboration, admin, then cross-cutting. A tester thinks in tasks.

Every journey needs:

| Field | Rule |
|---|---|
| **ID** | `PREFIX-NN`, prefix per section (`AUTH-01`, `BUY-02`). A stable handle people can quote in chat. |
| **Journey** | What is being checked, in the user's words. |
| **Preconditions** | Who is signed in, what state things must be in. |
| **Steps** | Numbered, followable by someone who has never seen the code. No file paths, endpoints or jargon. |
| **Expected result** | Concrete and checkable. Never "it works". |
| **Platform columns** | One per platform, `N/A` where the feature genuinely does not exist there. |

Mark **N/A** explicitly rather than leaving a blank — it tells the tester it was
considered, not forgotten.

## What makes these documents work

**Test both roles.** Almost every module has an owner/administrator side and a
recipient/guest side. The guest is usually anonymous, arriving from a link. That
is where most defects are found and where coverage is usually thinnest.

**Write the unhappy paths.** Required fields left empty, an expired or missing
code, insufficient balance, an empty list, a sold-out item, an already-claimed
item, a payment abandoned at the gateway, a duplicate submission, a stale link
opened twice.

**Encode the traps.** When a bug had a specific condition, put that condition in
the steps or it will not be caught again:

- a control that vanished on a short screen → name the screen size
- a flow that only fails on a first visit → say "in a fresh browser"
- a setting that only fails on the second pass → say "go back and return twice"

**Insist that a success message is not proof.** State it in the rules and repeat
it in the journeys that matter: if the journey says an email arrives, a balance
drops, or a value persists, the expected result must say to *check that it did*.
A success toast for something that never happened is among the most common and
most damaging faults, and the easiest for a tester to wave through.

**Say what to capture on a failure**: the page address or screen name, what they
tapped immediately before, the **exact error text**, the time, and the platform.
The time matters when session replay is available.

## Output

Write markdown to `docs/qa-test-plan.md` in the repo, so it reviews in a pull
request alongside the code it describes.

Open with:

1. **How to use this** — the platform codes, how to record a result, what counts
   as a fail, and what to capture when something fails.
2. **Coverage summary** — journey count per part, and the known platform gaps.

Then the parts. Use tables; keep the steps short enough to read on a phone.

## Importing it into the runbook

qarunbook (https://qarunbook.com) imports this format directly — upload the
`.md`, or pass it to the `import_plan` MCP tool, and it creates an app, with sections from the
headings, checks from the table rows, and platforms read from the check table's
header.

For that to work:

- Each section is a `##` heading, with its checks in one table beneath it.
- The first column of every check row is a reference like `AUTH-01`.
- Trailing columns are the platforms; their names become the platform codes.
- A cell reading `N/A` marks that platform as not applicable.

One thing to avoid: a legend table early in the document explaining the columns.
The importer skips tables whose rows are not checks, but a legend is still noise —
prefer a plain list.

## Scale

Be exhaustive rather than tidy. A real product runs to a few hundred journeys; a
plan of thirty has not looked hard enough. If a feature's behaviour cannot be
determined from the code, list it anyway with a note saying what the tester should
establish — never omit it.

## Before handing it over

- Every expected result is something a person can actually verify.
- No step mentions a file, an endpoint, or a function.
- Both roles covered for every module that has two.
- Known platform gaps listed up front.
- Recently-fixed bugs have a journey that would catch them again.

State plainly that the plan describes what the app **does**, derived from the
code — not necessarily what was intended. Where those differ, the plan encodes
current behaviour, and the sections covering recently-changed areas are worth a
product owner's eye before testers work from them.
