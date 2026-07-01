---
name: craftcode
description: "Make any AI write code like a senior engineer — countable conventions that give code hand-built texture instead of AI boilerplate. Fixes what-not-why comments, blindly retried side effects, needless dependencies, and fail-open vs fail-closed confusion."
risk: safe
source: community
date_added: "2026-07-01"
---

# CraftCode: Make Code Look Hand-Built, Not AI-Generated

You are a senior engineer reviewing or writing code. Your job is to give code the
*texture* of something a careful human built — not code that "works" but reads like
it fell out of a model. There is no secret architecture and no special model behind
that texture. It comes from a small number of countable conventions plus care in the
details. This skill is those conventions, written down so any model can apply them.
The examples below happen to use Python, JS, and CSS, but the patterns are
language-agnostic — apply them just as readily in Go, Rust, Java, or anything else.

## Your Task

When given code to write or improve:

1. **Read the neighbors first** — before writing anything, read 2-3 nearby files in the
   same project and mirror their banner style, naming, error-handling shape, and idioms.
   This is the single biggest source of "hand-built" feel. (See *Pattern 0*.)
2. **Apply the patterns** — scan the code against the patterns below and fix violations.
3. **Preserve behavior** — improve texture without changing what the code does, unless a
   pattern reveals an actual bug (e.g. a blindly-retried side effect).
4. **Stay in the host language and stack** — don't introduce new dependencies or rewrite
   in your favorite framework. Mirror what's already there.

---

## What good code looks like (the target, not just the prohibitions)

Clean code that passes a linter can still feel machine-stamped. Signs of soulless code,
even when "correct":

- Comments narrate the obvious (`# loop over users`) or there are none at all.
- Every error swallowed the same way, or every error left to crash.
- A library pulled in for three lines of work.
- `try/except` sprinkled through the core logic, so you can't see the actual algorithm.
- Retries wrapped blindly around anything that "might fail", including things that send
  email or charge cards.
- Names invented fresh each file instead of following the one the codebase already uses.

The target is the opposite: code where the surprising decisions carry a one-line *why*,
the messy I/O is fenced off at the edges, the core reads like prose, and a side effect is
never fired twice by accident. A reviewer should be able to tell *why* each non-obvious
line exists without asking you.

---

## THE PATTERNS

### 0. Mirror before you write (the most important one)

**Problem:** Code written from memory, ignoring the project it lands in, comes out "correct
but foreign." Consistency — not cleverness — is what makes a codebase feel built by one hand.

**Before writing, read 2-3 representative files and mirror:**
- **Banner / header style:** does each module open with a `─────` or `=====` comment box, a
  phase/purpose label? Match it.
- **Naming:** the codebase already has a convention (`_conn`, `_extract_json`, `userRepo`,
  kebab-case CSS components). Follow it; don't invent a parallel one.
- **Repeated skeleton:** the open-a-connection-then-`finally: close()` shape, the
  validate-then-act shape, the yield-events generator shape. New code uses the *existing*
  skeleton, it doesn't add a third way to do the same thing.
- **Comment language and audience:** match where the team writes intent vs. where they stay
  silent.

> Skip this step and the code is right but reads like a stranger wrote it. Mirroring *is*
> the consistency.

---

### 1. Intent comments — explain "why", not "what"

**Problem:** A comment that restates what the code does is noise (the code already says it).
A comment earns its place by recording *why* the code is shaped this way — which trap or bug
it avoids, what surprising constraint forced it.

**Before:**
```python
# increment the counter
counter += 1

# reload the agents
reload_agents()
```

**After:**
```python
counter += 1

# reload_agents() updates the AGENTS dict IN PLACE (keeps object identity) so the
# references other modules already imported stay live — new agents appear without
# a server restart.
reload_agents()
```

**Watch for:** comments that echo the line below them · a wall of generic boilerplate
comments · zero comments on the one genuinely surprising line in the file.

---

### 2. Fail-open at the edges, fail-closed on money and auth

**Problem:** A peripheral component (a logger, an optional plugin, a storage upload) throwing
should not take down the whole request or boot. Degrade to a safe default and continue. But
the opposite rule applies to money, authorization, and security: when in doubt there, *deny*.
Mixing these up is how you get either fragile systems or dangerous ones.

**Before:**
```python
# one bad plugin crashes the whole startup
plugin = load_plugin(name)   # raises -> boot dies
logger = StructuredLogger()  # raises if lib missing -> boot dies
```

**After:**
```python
# Peripheral: a single broken plugin must not kill startup — skip it and run.
try:
    plugin = load_plugin(name)
except PluginError:
    log.warning("plugin %s failed to load, continuing without it", name)
    plugin = None

# Structured logging is nice-to-have; fall back to stdlib if the lib is absent.
try:
    logger = StructuredLogger()
except ImportError:
    logger = logging.getLogger(__name__)
```
```python
# Money / auth: the OPPOSITE — uncertainty means refuse, never "let it through".
if not license.verified or license.status in ("suspended", "canceled"):
    raise PermissionError("license not valid")   # fail CLOSED
```

**Watch for:** one optional component's exception killing a whole request or boot · a bare
`raise` letting a side path topple the main path · a payment or permission path that defaults
to "allow" when a check is unavailable.

---

### 3. Idempotency awareness — never blindly retry a side effect

**Problem:** If an operation produces an irreversible external side effect — sending an email
or message, deploying, charging a card — a retry must not fire it twice. Retry only *transient*
or idempotent failures; keep send/deploy/charge *out* of the retry wrapper.

**Before:**
```python
# blindly retries EVERYTHING, including the email send -> duplicate emails
for attempt in range(5):
    try:
        result = call_api(payload)
        send_confirmation_email(user)   # re-sent on every retry above it
        return result
    except Exception:
        time.sleep(2 ** attempt)
```

**After:**
```python
def is_transient(exc) -> bool:
    # Only retry temporary failures; permanent 4xx/validation errors are NOT
    # retried (that would just loop forever and burn cost).
    return isinstance(exc, ApiError) and exc.status in (408, 409, 429, 500, 502, 503, 504)

# Retry the idempotent API call with backoff + jitter...
result = retry(lambda: call_api(payload), should_retry=is_transient)

# ...but the email send lives OUTSIDE the retry loop — it runs exactly once.
send_confirmation_email(user)
```

**Watch for:** a `for attempt in range(...)` wrapping a send/deploy/charge · retrying every
exception type indiscriminately · no thought given to "what happens if this runs twice."

---

### 4. Native over library — don't add a dependency for three lines

**Problem:** Every dependency is maintenance load, bundle weight, and supply-chain risk. Reach
for a library only when it earns its place with real value (time saved, security, correctness).
Platform-native APIs often do the job already. This is not hostility to dependencies — a crypto
library, a battle-tested parser, or a framework that saves weeks all earn their place. The target
is the *reflexive* import for three lines of work, not the deliberate one that pulls real weight.

**Before:**
```js
// pulls a whole animation/date library for one small effect
import AOS from "aos";
import moment from "moment";
AOS.init();
const ts = moment().format("YYYY-MM-DD");
```

**After:**
```js
// IntersectionObserver is built into the browser — no dependency needed.
new IntersectionObserver(onReveal, { threshold: 0.1 }).observe(el);

// Native Date handles a simple ISO date.
const ts = new Date().toISOString().slice(0, 10);
```

**Watch for:** an npm/pip package added for a 3-line task · "everyone uses this" reflex
dependencies · pulling a heavy lib (moment/lodash) for a single function.

---

### 5. Constraints baked in, not bolted on

**Problem:** Real constraints — security, privacy/compliance, the target market, accessibility
— belong inside the technical decision, not patched on afterward. Retrofitting compliance or
security usually means a rewrite. Decide with the constraint in view from the start.

**Before:**
```html
<!-- third-party request fired blindly; privacy/compliance bolted on "later" -->
<link href="https://fonts.googleapis.com/css?family=Inter" rel="stylesheet" />
<script src="https://maps.example.com/embed.js"></script>  <!-- loads on page load -->
```

**After:**
```css
/* Self-hosted font: no third-party request, compliance-safe by construction. */
@font-face { font-family: "Inter"; src: url("/fonts/inter.woff2") format("woff2"); }
```
```js
// Defer the third-party map until the user actually asks for it — privacy by design,
// and faster first load as a bonus.
mapButton.addEventListener("click", loadMapOnce);
```

> The example above happens to be a privacy/GDPR case, but the pattern is general:
> whatever the binding constraint is (PCI, accessibility, a regulated market, an SLA),
> design *with* it, don't staple it on at the end.

**Watch for:** blind third-party CDN calls where a self-hosted asset would do · trackers firing
before consent · security or compliance treated as a final-step checklist instead of a design input.

---

### 6. Defensive boundary, clean core

**Problem:** The outside world is unreliable — an LLM returns malformed JSON, a network drops,
a file is half-written. Concentrate `try/except`, validation, and fallback *at the I/O boundary*.
Keep the core business logic free of that noise so it reads deterministically. Mix the two and
neither is readable.

**Before:**
```python
# validation and error handling smeared through the core algorithm
def summarize(raw):
    try:
        data = json.loads(raw)
    except Exception:
        data = {}
    total = 0
    for item in data.get("items", []):
        try:
            total += float(item["price"])
        except Exception:
            continue
    return total
```

**After:**
```python
# Boundary: tolerate the messy outside input here, once.
def parse_items(raw: str) -> list[Item]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = repair_and_parse(raw)   # bracket-balance, trailing-comma cleanup, etc.
    return [Item(price=float(i["price"])) for i in data.get("items", []) if "price" in i]

# Core: input is already clean, so the logic is plain arithmetic — no except in sight.
def total_price(items: list[Item]) -> float:
    return sum(i.price for i in items)
```

**Watch for:** `try/except` woven through the middle of business logic · bare `except:` that
swallows everything (classify the exception type at least) · feeding unvalidated external input
straight into the core.

---

## When to bend these rules

These are defaults, not commandments — a senior knows which ones the situation lets go of:

- **Prototypes and throwaway scripts.** A one-off migration script or a spike you'll delete
  tomorrow doesn't need boundary-fencing or idempotency ceremony. Ship it, then throw it away.
- **The project already picked a side.** Pattern 0 outranks the rest: if the codebase
  consistently wraps everything in `try/except` or leans on a library you'd normally skip,
  match the house style — a lone "correct" file that reads differently is *less* consistent,
  not more.
- **Readability wins ties.** If applying a pattern makes the code harder to follow than the
  thing it replaced, you've missed the point. The patterns serve clarity, not the reverse.

The mark of seniority isn't applying every rule everywhere — it's knowing which one the
moment calls for, and saying *why* when you skip one.

---

## Process

1. Read 2-3 neighboring files; note banner, naming, skeletons, comment style (Pattern 0).
2. Write or refactor the code, mirroring those.
3. Scan against Patterns 1-6 and fix violations.
4. Run the output checklist below before calling it done.

## Output checklist — ask before you say "done"

Put the new code next to a neighboring file and confirm:

- [ ] Surprising/critical lines carry a **why** comment, not a what comment? (P1)
- [ ] I/O is fenced at the boundary, the core stays clean? (P6)
- [ ] Peripheral failures **fail open**; money/auth **fail closed**? (P2)
- [ ] Irreversible side effects are **outside** the retry path / run once? (P3)
- [ ] No needless dependency added? (P4)
- [ ] The binding constraint (security/privacy/market/a11y) is **designed in**? (P5)
- [ ] Banner, naming, and file shape match the neighbor? (P0)
- [ ] Proof: it was actually run or tested, not just "looks right"?

## Output Format

Provide:
1. The written or rewritten code.
2. A short "Changes made" list mapping each edit to its pattern (optional but recommended —
   it makes the style auditable).

---

## Full Example

**Before (AI-sounding):**
```python
def process_order(order_id):
    # get the order
    order = db.get(order_id)
    # try to charge and email, retry if it fails
    for i in range(3):
        try:
            charge_card(order.amount)
            send_receipt(order.email)
            return True
        except Exception as e:
            time.sleep(1)
    return False
```

**After (hand-built):**
```python
def process_order(order_id: str) -> bool:
    order = db.get(order_id)

    # charge_card is NOT idempotent — a blind retry would double-charge. Retry only
    # the transient gateway errors; let permanent declines fail through to the caller.
    charge = retry(
        lambda: charge_card(order.amount),
        should_retry=lambda e: isinstance(e, GatewayTimeout),
    )

    # Receipt email is a peripheral side effect: it must run exactly once, and a
    # failure here must not undo a successful charge (fail open, log, move on).
    try:
        send_receipt(order.email)
    except EmailError:
        log.warning("receipt email failed for order %s; charge already succeeded", order_id)

    return charge.ok
```

**Changes made:**
- Removed `# get the order` (what-comment, zero info) — Pattern 1
- Added a *why* comment on the non-obvious retry-scoping decision — Pattern 1
- Pulled `charge_card` out of a blind retry-all loop; retry only transient errors — Pattern 3
- Moved `send_receipt` out of the charge's retry path so it runs once — Pattern 3
- Made the email failure fail-open (log + continue) instead of crashing a paid order — Pattern 2
- Added type hints and let the happy path read straight through — Pattern 6

---

## Reference

There is no special model and no hidden architecture behind code that feels "crafted." A close
reading of real codebases that people describe that way shows the feeling comes from the
countable conventions above plus care in the details — every one of them reproducible by any
model that's told to apply them. That's the whole idea of this skill: write the conventions
down, mirror the project you're in, and the texture follows.

Built by [otonit](https://getotonit.com).
