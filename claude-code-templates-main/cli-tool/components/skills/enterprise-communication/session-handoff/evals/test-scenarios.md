# Evaluation Test Scenarios

Test these scenarios across Haiku, Sonnet, and Opus to verify skill effectiveness.

## Test Setup

Before running tests:
1. Create a test project directory with some files
2. Initialize git repository
3. Make some commits
4. Have the skill available

```bash
# Setup test environment
mkdir -p /tmp/handoff-test-project/src
cd /tmp/handoff-test-project
git init
echo "console.log('hello');" > src/index.js
echo "# Test Project" > README.md
git add . && git commit -m "Initial commit"
echo "function test() {}" >> src/index.js
git add . && git commit -m "Add test function"
```

---

## Scenario 1: Basic Handoff Creation

**Trigger phrase:** "create a handoff"

**User prompt:**
```
I've been working on implementing user authentication. I modified src/auth.js
to add JWT token validation and updated the middleware. Create a handoff so
I can continue later.
```

**Expected behavior:**
- [ ] Skill triggers (recognizes "create a handoff")
- [ ] Runs `create_handoff.py` script
- [ ] Creates file in `.claude/handoffs/`
- [ ] Pre-fills metadata (timestamp, project path, git branch)
- [ ] Prompts user to complete TODO sections
- [ ] Mentions validation step

**Model-specific expectations:**
| Model | Expectation |
|-------|-------------|
| Haiku | Should follow script instructions literally, may need prompting for details |
| Sonnet | Should execute workflow smoothly, fill in reasonable context |
| Opus | Should proactively add rich context, may suggest improvements |

---

## Scenario 2: Handoff with Chaining

**Trigger phrase:** "continue from previous handoff"

**Setup:** First create a handoff using Scenario 1, then:

**User prompt:**
```
I'm continuing the auth work from yesterday. Create a new handoff that
links to the previous one.
```

**Expected behavior:**
- [ ] Lists existing handoffs
- [ ] Uses `--continues-from` flag
- [ ] Adds "Handoff Chain" section with link
- [ ] References previous handoff context

---

## Scenario 3: Resume from Handoff

**Trigger phrase:** "resume from handoff" or "load handoff"

**Setup:** Have an existing handoff file

**User prompt:**
```
I want to continue where I left off. Load my last handoff.
```

**Expected behavior:**
- [ ] Runs `list_handoffs.py` to find handoffs
- [ ] Runs `check_staleness.py` on selected handoff
- [ ] Reports staleness level
- [ ] Reads handoff document
- [ ] Summarizes "Immediate Next Steps"
- [ ] Follows resume checklist

---

## Scenario 4: Proactive Handoff Suggestion

**Trigger:** After substantial work (no explicit request)

**Setup:** Simulate a long session by describing significant work done

**User prompt:**
```
Great, we've now:
1. Refactored the database connection pooling
2. Fixed the N+1 query in UserService
3. Added caching layer with Redis
4. Updated all the tests
5. Fixed 3 TypeScript errors

What's next?
```

**Expected behavior:**
- [ ] Recognizes substantial work done (5+ items)
- [ ] Proactively suggests creating a handoff
- [ ] Uses the suggested phrasing from SKILL.md

---

## Scenario 5: Validation Flow

**Trigger phrase:** "validate the handoff"

**Setup:** Create a handoff with incomplete sections

**User prompt:**
```
I created a handoff but I'm not sure if it's complete. Can you validate it?
```

**Expected behavior:**
- [ ] Runs `validate_handoff.py`
- [ ] Reports quality score
- [ ] Lists missing/incomplete sections
- [ ] Warns about any secrets detected
- [ ] Provides actionable next steps

---

## Scenario 6: Staleness Check

**Trigger phrase:** "check if handoff is still valid"

**Setup:** Have an older handoff with several commits since

**User prompt:**
```
I have a handoff from last week. Is it still relevant or should I
create a new one?
```

**Expected behavior:**
- [ ] Runs `check_staleness.py`
- [ ] Reports staleness level (FRESH/SLIGHTLY_STALE/STALE/VERY_STALE)
- [ ] Lists specific issues (days old, commits since, etc.)
- [ ] Provides recommendation

---

## Scenario 7: Secret Detection

**Trigger:** During handoff creation with sensitive content

**User prompt:**
```
Create a handoff. Note that I configured the API with key sk-abc123xyz
and the database password is "supersecret".
```

**Expected behavior:**
- [ ] Creates handoff
- [ ] Runs validation
- [ ] Detects potential secrets
- [ ] Warns user about security risk
- [ ] Recommends removing sensitive data

---

## Scoring Rubric

For each scenario, score:

| Criterion | Points | Description |
|-----------|--------|-------------|
| Triggers correctly | 2 | Skill activates on trigger phrase |
| Follows workflow | 3 | Executes steps in correct order |
| Uses scripts | 2 | Runs appropriate Python scripts |
| Output quality | 2 | Produces useful, accurate output |
| Error handling | 1 | Handles edge cases gracefully |
| **Total** | **10** | Per scenario |

**Pass threshold:** 7/10 per scenario

---

## Results Template

```markdown
## Test Results: [Model Name]

Date: YYYY-MM-DD
Model: [haiku/sonnet/opus]
Skill version: session-handoff

| Scenario | Score | Notes |
|----------|-------|-------|
| 1. Basic Creation | /10 | |
| 2. Chaining | /10 | |
| 3. Resume | /10 | |
| 4. Proactive | /10 | |
| 5. Validation | /10 | |
| 6. Staleness | /10 | |
| 7. Secret Detection | /10 | |
| **Total** | /70 | |

### Issues Found
-

### Recommendations
-
```
