# Model-Specific Expectations

This document describes expected behavior differences across Claude models when using the session-handoff skill.

## Model Characteristics

### Haiku (Fast, Lightweight)
- **Strengths**: Quick responses, follows explicit instructions well
- **Limitations**: May need more guidance, less proactive
- **Skill adjustments**: May need more explicit prompts for complex scenarios

### Sonnet (Balanced)
- **Strengths**: Good balance of speed and capability, handles workflows well
- **Limitations**: May occasionally miss subtle triggers
- **Skill adjustments**: Should work well with default instructions

### Opus (Most Capable)
- **Strengths**: Excellent context understanding, proactive suggestions
- **Limitations**: May over-elaborate when not needed
- **Skill adjustments**: May add extra context/suggestions beyond requirements

---

## Expected Behaviors by Scenario

### Scenario 1: Basic Handoff Creation

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Trigger recognition | Should trigger | Should trigger | Should trigger |
| Script execution | Runs script | Runs script | Runs script |
| TODO completion | May need prompting | Fills reasonable defaults | Rich, detailed content |
| Validation reminder | May skip | Usually includes | Always includes |

**Haiku-specific guidance:**
- May need explicit "now fill in the TODO sections"
- Keep prompts simple and direct

**Opus-specific notes:**
- May proactively suggest additional sections
- May add extra context without being asked

### Scenario 2: Handoff Chaining

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Finds previous handoffs | With explicit prompt | Usually automatic | Always automatic |
| Uses --continues-from | May need reminder | Usually correct | Always correct |
| Context from previous | Basic reference | Good summary | Detailed synthesis |

**Haiku-specific guidance:**
- Explicitly mention "link to the previous handoff"
- May need to specify exact filename

### Scenario 3: Resume from Handoff

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Lists handoffs | With prompt | Automatic | Automatic |
| Staleness check | May skip | Usually runs | Always runs |
| Context absorption | Basic | Good | Excellent |
| Next steps focus | May need guidance | Usually clear | Proactive planning |

**Haiku-specific guidance:**
- Explicitly ask "check the staleness first"
- May need "what are the next steps from the handoff?"

### Scenario 4: Proactive Handoff Suggestion

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Recognizes substantial work | Unlikely without prompt | Sometimes | Usually |
| Suggests handoff | Rarely proactive | Sometimes proactive | Often proactive |
| Timing of suggestion | N/A | After 5+ major items | After 3-5 items |

**Notes:**
- Haiku will rarely proactively suggest handoffs
- Sonnet may suggest after explicit substantial work description
- Opus most likely to suggest unprompted

### Scenario 5: Validation Flow

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Runs validation script | With explicit request | Usually automatic | Always automatic |
| Interprets score | Basic | Good | Detailed |
| Actionable feedback | May need prompting | Usually provides | Detailed plan |

### Scenario 6: Staleness Check

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Runs staleness script | With explicit request | Usually | Always |
| Interprets results | Basic | Good | Detailed analysis |
| Recommendations | Repeats script output | Contextualizes | Strategic advice |

### Scenario 7: Secret Detection

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Detects secrets | Via script | Via script | Via script + may notice more |
| Warning clarity | Basic | Clear | Detailed security advice |
| Remediation guidance | Script output | Clear steps | Comprehensive plan |

---

## Tuning Recommendations

### For Haiku Optimization
If Haiku struggles:
1. Add more explicit trigger phrases to description
2. Include step-by-step numbered instructions
3. Add explicit checkpoints ("After creating, run validation")
4. Reduce ambiguity in instructions

### For Sonnet Optimization
If Sonnet misses triggers:
1. Ensure key terms are in description
2. Add example trigger phrases
3. Make workflow decision points clearer

### For Opus Optimization
If Opus over-elaborates:
1. Add "keep responses concise" guidance
2. Specify when NOT to add extra content
3. Define clear scope boundaries

---

## Pass/Fail Criteria by Model

### Minimum Pass Thresholds

| Model | Min Score | Notes |
|-------|-----------|-------|
| Haiku | 49/70 (70%) | Allow some missed proactive triggers |
| Sonnet | 56/70 (80%) | Should handle most scenarios well |
| Opus | 63/70 (90%) | Should excel at all scenarios |

### Critical Failures (Any Model)
These should always work regardless of model:
- [ ] Basic handoff creation with explicit request
- [ ] Script execution when instructed
- [ ] Secret detection warning
- [ ] File creation in correct location

---

## Testing Protocol

1. **Run setup script:**
   ```bash
   python evals/setup_test_env.py
   cd /tmp/handoff-eval-project
   ```

2. **Test each scenario in new conversation**
   - Start fresh conversation for each scenario
   - Use exact trigger phrases from test-scenarios.md
   - Record scores using results template

3. **Compare across models**
   - Note significant behavior differences
   - Identify skill improvements needed
   - Update SKILL.md if Haiku needs more guidance

4. **Document findings**
   - Use results template for each model
   - Note specific failure modes
   - Recommend skill adjustments
