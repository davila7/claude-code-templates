"""
GRPO Reward Functions Library
===============================

A collection of battle-tested reward functions for common GRPO training scenarios.
Copy and adapt these for your specific use case.

Categories:
- Correctness rewards (verifiable tasks)
- Format rewards (structured output)
- Length rewards (verbosity control)
- Style rewards (quality and tone)
- Combined rewards (multi-objective)
"""

import re
from typing import List, Any

# ==================== CORRECTNESS REWARDS ====================

def exact_match_reward(prompts, completions, answer, **kwargs) -> List[float]:
    """
    Binary reward for exact answer match.
    Use for: Math problems, factual Q&A, code output

    Weight: 2.0 (highest priority)
    """
    responses = [comp[0]['content'] for comp in completions]
    extracted = [extract_answer(r) for r in responses]
    return [2.0 if ans.strip() == gt.strip() else 0.0
            for ans, gt in zip(extracted, answer)]

def fuzzy_match_reward(prompts, completions, answer, **kwargs) -> List[float]:
    """
    Partial credit for similar answers.
    Use for: Open-ended answers, summaries

    Weight: 1.0
    """
    from difflib import SequenceMatcher

    responses = [comp[0]['content'] for comp in completions]
    extracted = [extract_answer(r) for r in responses]

    rewards = []
    for ans, gt in zip(extracted, answer):
        similarity = SequenceMatcher(None, ans.lower(), gt.lower()).ratio()
        rewards.append(similarity)

    return rewards

def numeric_correctness_reward(prompts, completions, answer, tolerance=0.01, **kwargs) -> List[float]:
    """
    Reward numeric answers within tolerance.
    Use for: Math, physics, engineering problems

    Weight: 2.0
    """
    responses = [comp[0]['content'] for comp in completions]
    extracted = [extract_answer(r) for r in responses]

    rewards = []
    for ans, gt in zip(extracted, answer):
        try:
            ans_num = float(ans.replace(',', ''))
            gt_num = float(gt.replace(',', ''))
            if abs(ans_num - gt_num) / max(abs(gt_num), 1e-8) <= tolerance:
                rewards.append(2.0)
            else:
                rewards.append(0.0)
        except:
            rewards.append(0.0)

    return rewards

def code_execution_reward(prompts, completions, test_cases, **kwargs) -> List[float]:
    """
    Execute code and verify against test cases.
    Use for: Code generation tasks

    Weight: 2.0
    """
    responses = [comp[0]['content'] for comp in completions]
    extracted_code = [extract_code_block(r) for r in responses]

    rewards = []
    for code in extracted_code:
        try:
            # Execute code (sandboxed!)
            passed = run_test_cases(code, test_cases)
            rewards.append(2.0 if passed else 0.0)
        except:
            rewards.append(0.0)

    return rewards

# ==================== FORMAT REWARDS ====================

def strict_xml_format_reward(completions, **kwargs) -> List[float]:
    """
    Strict XML format: exact newlines and spacing.
    Use for: When format must be EXACTLY specified

    Weight: 0.5
    """
    pattern = r'^<reasoning>\n.*?\n</reasoning>\n<answer>\n.*?\n</answer>\n$'
    responses = [comp[0]['content'] for comp in completions]
    matches = [re.match(pattern, r, re.DOTALL) for r in responses]
    return [0.5 if match else 0.0 for match in matches]

def soft_xml_format_reward(completions, **kwargs) -> List[float]:
    """
    Relaxed XML format: allows whitespace variations.
    Use for: When structure matters more than exact spacing

    Weight: 0.5
    """
    pattern = r'<reasoning>.*?</reasoning>\s*<answer>.*?</answer>'
    responses = [comp[0]['content'] for comp in completions]
    matches = [re.search(pattern, r, re.DOTALL) for r in responses]
    return [0.5 if match else 0.0 for match in matches]

def json_format_reward(completions, **kwargs) -> List[float]:
    """
    Reward valid JSON output.
    Use for: Structured data extraction, API responses

    Weight: 0.5
    """
    import json

    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        try:
            json.loads(r)
            rewards.append(0.5)
        except:
            rewards.append(0.0)

    return rewards

def incremental_format_reward(completions, tags=['reasoning', 'answer'], **kwargs) -> List[float]:
    """
    Partial credit for each required tag.
    Use for: Training models to gradually learn format

    Weight: sum(0.125 * num_tags * 2) = up to 0.5 for 2 tags
    """
    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        score = 0.0
        for tag in tags:
            if f'<{tag}>' in r:
                score += 0.125
            if f'</{tag}>' in r:
                score += 0.125

        # Penalize extra content after final closing tag
        if f'</{tags[-1]}>' in r:
            extra = r.split(f'</{tags[-1]}>')[-1].strip()
            score -= len(extra) * 0.001

        rewards.append(score)

    return rewards

# ==================== LENGTH REWARDS ====================

def ideal_length_reward(completions, ideal_tokens=100, **kwargs) -> List[float]:
    """
    Reward responses near ideal length.
    Use for: Controlling verbosity

    Weight: 0.3
    """
    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        length = len(r.split())
        distance = abs(length - ideal_tokens)
        # Gaussian-like reward peaking at ideal length
        reward = 0.3 * max(0, 1 - distance / ideal_tokens)
        rewards.append(reward)

    return rewards

def min_length_reward(completions, min_tokens=50, **kwargs) -> List[float]:
    """
    Penalize responses that are too short.
    Use for: Ensuring detailed explanations

    Weight: 0.2
    """
    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        length = len(r.split())
        reward = 0.2 if length >= min_tokens else -0.2
        rewards.append(reward)

    return rewards

def max_length_penalty(completions, max_tokens=500, **kwargs) -> List[float]:
    """
    Penalize excessively long responses.
    Use for: Preventing rambling

    Weight: -0.3 when violated
    """
    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        length = len(r.split())
        reward = -0.3 if length > max_tokens else 0.0
        rewards.append(reward)

    return rewards

# ==================== STYLE REWARDS ====================

def reasoning_quality_reward(completions, **kwargs) -> List[float]:
    """
    Reward detailed reasoning with logical connectors.
    Use for: Improving chain-of-thought quality

    Weight: 0.3
    """
    logical_words = ['therefore', 'thus', 'because', 'since', 'consequently',
                     'first', 'second', 'next', 'finally', 'however']

    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        reasoning = extract_xml_tag(r, 'reasoning').lower()
        # Count logical connectors
        count = sum(1 for word in logical_words if word in reasoning)
        # Normalize by length
        score = min(0.3, count * 0.05)
        rewards.append(score)

    return rewards

def citation_reward(completions, **kwargs) -> List[float]:
    """
    Reward responses with citations or references.
    Use for: Research tasks, fact-checking

    Weight: 0.2
    """
    citation_patterns = [
        r'\[\d+\]',           # [1], [2]
        r'\([A-Z][a-z]+,?\s+\d{4}\)',  # (Smith, 2020)
        r'according to',
        r'as stated in',
    ]

    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        has_citation = any(re.search(pattern, r) for pattern in citation_patterns)
        rewards.append(0.2 if has_citation else 0.0)

    return rewards

def no_repetition_penalty(completions, **kwargs) -> List[float]:
    """
    Penalize repetitive text (same phrase repeated).
    Use for: Improving output diversity

    Weight: -0.3 when repetitive
    """
    responses = [comp[0]['content'] for comp in completions]
    rewards = []

    for r in responses:
        words = r.lower().split()
        # Check for repeated trigrams
        trigrams = [' '.join(words[i:i+3]) for i in range(len(words)-2)]
        unique_ratio = len(set(trigrams)) / max(len(trigrams), 1)

        reward = -0.3 if unique_ratio < 0.7 else 0.0
        rewards.append(reward)

    return rewards

# ==================== COMBINED REWARDS ====================

def math_problem_reward(prompts, completions, answer, **kwargs) -> List[float]:
    """
    Combined reward for math problems: format + correctness.
    Automatically balances multiple objectives.

    Weight: 2.5 total
    """
    format_rewards = soft_xml_format_reward(completions)
    correctness_rewards = exact_match_reward(prompts, completions, answer)

    return [f + c for f, c in zip(format_rewards, correctness_rewards)]

def code_generation_reward(prompts, completions, test_cases, **kwargs) -> List[float]:
    """
    Combined reward for code: format + execution + style.

    Weight: 2.7 total
    """
    code_format_rewards = code_block_format_reward(completions)
    execution_rewards = code_execution_reward(prompts, completions, test_cases)
    no_error_rewards = no_syntax_error_reward(completions)

    return [f + e + s for f, e, s in zip(code_format_rewards, execution_rewards, no_error_rewards)]

# ==================== HELPER FUNCTIONS ====================

def extract_answer(text: str) -> str:
    """Extract content from <answer> tags."""
    return extract_xml_tag(text, 'answer')

def extract_xml_tag(text: str, tag: str) -> str:
    """Generic XML tag extraction."""
    pattern = f'<{tag}>(.*?)</{tag}>'
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else ""

def extract_code_block(text: str) -> str:
    """Extract code from markdown code blocks."""
    pattern = r'```(?:python)?\n(.*?)\n```'
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1) if match else ""

def run_test_cases(code: str, test_cases: List[tuple]) -> bool:
    """
    Execute code with test cases (MUST be sandboxed in production!).

    Args:
        code: Python code string
        test_cases: List of (input, expected_output) tuples

    Returns:
        True if all tests pass
    """
    # WARNING: This is a simplified example
    # In production, use proper sandboxing (e.g., docker, pypy sandbox)
    try:
        exec_globals = {}
        exec(code, exec_globals)

        for input_val, expected in test_cases:
            result = exec_globals['solution'](input_val)
            if result != expected:
                return False
        return True
    except:
        return False

# ==================== REWARD FUNCTION PRESETS ====================

# Preset for math/reasoning tasks
MATH_REASONING_REWARDS = [
    incremental_format_reward,
    soft_xml_format_reward,
    exact_match_reward,
    reasoning_quality_reward,
]

# Preset for code generation
CODE_GENERATION_REWARDS = [
    code_block_format_reward,
    code_execution_reward,
    no_syntax_error_reward,
]

# Preset for summarization
SUMMARIZATION_REWARDS = [
    ideal_length_reward,
    fuzzy_match_reward,
    no_repetition_penalty,
]

# Preset for Q&A
QA_REWARDS = [
    exact_match_reward,
    min_length_reward,
    citation_reward,
]
