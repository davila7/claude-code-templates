# NOWAIT Keywords Reference

Complete reference for reflection keywords used in the NOWAIT technique.

## Primary Keywords (from paper)

These keywords were empirically identified from 32 independent runs of QwQ-32B on AIME 2025, using `\n\n` as delimiters to identify the 15 most frequent monolingual transition words.

### Core Suppression List

```python
KEYWORDS = [
    "wait",          # Most common reflection trigger
    "alternatively", # Indicates exploring different approach
    "hmm",           # Hesitation marker
    "but",           # Contradiction/reconsideration
    "however",       # Contradiction/reconsideration
    "alternative",   # Exploring options
    "another",       # Switching approach
    "check",         # Verification trigger
    "double-check",  # Re-verification
    "oh",            # Realization marker
    "maybe",         # Uncertainty/reconsideration
    "verify",        # Verification trigger
    "other",         # Exploring alternatives
    "again",         # Repetition/re-check
    "now",           # Transition marker
    "ah",            # Realization marker
    "any",           # Exploring possibilities
]
```

## Excluded Patterns

These patterns should NOT be suppressed as they are false positives:

```python
EXCLUDED = [
    "ohio",       # Contains "oh" but is a proper noun
    "butane",     # Contains "but" but is a chemical
    "button",     # Contains "but" but is a UI element
    "butterfly",  # Contains "but" but is a noun
    "checkout",   # Contains "check" but is a noun/verb
    "checksum",   # Contains "check" but is technical term
    "another's",  # Possessive form, often necessary
]
```

## Token Expansion

For each keyword, the processor expands to all vocabulary variants:

| Keyword | Expanded Variants |
|---------|-------------------|
| wait | wait, Wait, WAIT, " wait", " Wait", ".wait", ",wait", etc. |
| hmm | hmm, Hmm, HMM, " hmm", "...hmm", etc. |
| alternatively | alternatively, Alternatively, " Alternatively", etc. |

## Model-Specific Tuning

Different models may benefit from adjusted keyword lists:

### QwQ-32B / DeepSeek-R1
- Use full default list
- High reduction potential (30%+)

### Phi4-Reasoning-Plus
- Use full default list
- Consider adding: "let me think", "I wonder"

### Kimi-VL (Multimodal)
- Use full default list
- Very high reduction (40-60%)
- May need domain-specific additions for visual tasks

### Qwen3 Series
- RL-based (32B): Use full list
- Distilled (4B/8B/14B): Consider removing "but", "however" to preserve some reasoning flow

## Keyword Categories

### Self-Reflection Markers
- `wait`, `hmm`, `oh`, `ah`
- Signal: Model is pausing to reconsider

### Verification Triggers  
- `check`, `double-check`, `verify`
- Signal: Model is validating previous work

### Alternative Exploration
- `alternatively`, `alternative`, `another`, `other`
- Signal: Model is exploring different approaches

### Contradiction/Reconsideration
- `but`, `however`, `maybe`
- Signal: Model is reconsidering previous conclusion

### Transition Markers
- `now`, `again`, `any`
- Signal: Model is shifting focus or repeating

## Benchmark Results by Keyword Removal

| Keywords Removed | AIME 2025 ACC | Token Reduction |
|-----------------|---------------|-----------------|
| None (baseline) | 66.67% | 0% |
| wait only | 67.33% | 15% |
| wait + hmm | 67.67% | 22% |
| All 17 keywords | 68.00% | 31% |

## Implementation Notes

### Logit Suppression Value
- Default: `-1e10` (effectively negative infinity)
- Alternative: `-100` (softer suppression, allows rare occurrence)

### Vocabulary Iteration
```python
def build_suppressed_tokens(tokenizer, keywords):
    suppressed = set()
    vocab = tokenizer.get_vocab()
    
    for token_text, token_id in vocab.items():
        for keyword in keywords:
            if keyword.lower() in token_text.lower():
                suppressed.add(token_id)
                break
    
    return suppressed
```

### Performance Considerations
- Token set is built once at initialization
- Lookup is O(1) per token during generation
- Memory overhead: ~few KB for token ID set