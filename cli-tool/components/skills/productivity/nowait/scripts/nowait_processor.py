#!/usr/bin/env python3
"""
NOWAIT Logit Processor

Implements the NOWAIT technique for efficient reasoning by suppressing
self-reflection tokens during inference.

Reference: "Wait, We Don't Need to 'Wait'! Removing Thinking Tokens 
           Improves Reasoning Efficiency" (Wang et al., 2025)

Usage:
    from nowait_processor import NOWAITLogitProcessor
    
    processor = NOWAITLogitProcessor(tokenizer)
    outputs = model.generate(inputs, logits_processor=[processor])
"""

import torch
from typing import List, Set, Optional, Union
from dataclasses import dataclass, field


# Default reflection keywords from the paper (empirically derived from QwQ-32B)
DEFAULT_KEYWORDS = [
    "wait", "alternatively", "hmm", "but", "however",
    "alternative", "another", "check", "double-check",
    "oh", "maybe", "verify", "other", "again", "now", "ah", "any"
]

# Keywords to exclude from suppression (false positives)
EXCLUDED_PATTERNS = [
    "ohio",      # Contains "oh"
    "butane",    # Contains "but"
    "button",    # Contains "but"
    "butterfly", # Contains "but"
]


@dataclass
class NOWAITConfig:
    """Configuration for NOWAIT processor."""
    keywords: List[str] = field(default_factory=lambda: DEFAULT_KEYWORDS.copy())
    excluded_patterns: List[str] = field(default_factory=lambda: EXCLUDED_PATTERNS.copy())
    negative_value: float = -1e10
    case_sensitive: bool = False


class NOWAITLogitProcessor:
    """
    A logit processor that suppresses self-reflection tokens during generation.
    
    This processor identifies tokens associated with self-reflection keywords
    (e.g., "Wait", "Hmm", "Alternatively") and sets their logits to a large
    negative value, effectively preventing their generation.
    
    Args:
        tokenizer: The tokenizer for the target model
        config: Optional NOWAITConfig for customization
        keywords: Optional list of keywords to suppress (overrides config)
    
    Example:
        >>> from transformers import AutoTokenizer, AutoModelForCausalLM
        >>> tokenizer = AutoTokenizer.from_pretrained("Qwen/QwQ-32B")
        >>> model = AutoModelForCausalLM.from_pretrained("Qwen/QwQ-32B")
        >>> processor = NOWAITLogitProcessor(tokenizer)
        >>> outputs = model.generate(
        ...     input_ids,
        ...     logits_processor=[processor],
        ...     max_new_tokens=32768
        ... )
    """
    
    def __init__(
        self,
        tokenizer,
        config: Optional[NOWAITConfig] = None,
        keywords: Optional[List[str]] = None
    ):
        self.tokenizer = tokenizer
        self.config = config or NOWAITConfig()
        
        if keywords is not None:
            self.config.keywords = keywords
        
        # Build the set of token IDs to suppress
        self.suppressed_token_ids: Set[int] = self._build_suppressed_tokens()
    
    def _is_excluded(self, token_text: str) -> bool:
        """Check if token text matches any excluded pattern."""
        token_lower = token_text.lower()
        for pattern in self.config.excluded_patterns:
            if pattern in token_lower:
                return True
        return False
    
    def _build_suppressed_tokens(self) -> Set[int]:
        """
        Build the set of token IDs to suppress based on keywords.
        
        This expands each keyword to all its variants in the vocabulary:
        - Different cases: "wait", "Wait", "WAIT"
        - With leading spaces: " wait", " Wait"
        - With punctuation: ".wait", ",wait"
        """
        suppressed = set()
        vocab = self.tokenizer.get_vocab()
        
        for token_text, token_id in vocab.items():
            # Skip excluded patterns
            if self._is_excluded(token_text):
                continue
            
            # Check if token contains any keyword
            token_check = token_text if self.config.case_sensitive else token_text.lower()
            
            for keyword in self.config.keywords:
                keyword_check = keyword if self.config.case_sensitive else keyword.lower()
                
                if keyword_check in token_check:
                    suppressed.add(token_id)
                    break
        
        return suppressed
    
    def __call__(
        self,
        input_ids: torch.LongTensor,
        scores: torch.FloatTensor
    ) -> torch.FloatTensor:
        """
        Process logits by suppressing reflection tokens.
        
        Args:
            input_ids: Input token IDs (batch_size, seq_len)
            scores: Logit scores (batch_size, vocab_size)
        
        Returns:
            Modified scores with suppressed tokens set to negative infinity
        """
        for token_id in self.suppressed_token_ids:
            if token_id < scores.shape[-1]:
                scores[:, token_id] = self.config.negative_value
        
        return scores
    
    def get_suppressed_count(self) -> int:
        """Return the number of tokens being suppressed."""
        return len(self.suppressed_token_ids)
    
    def get_suppressed_tokens(self, limit: int = 50) -> List[str]:
        """Return sample of suppressed token texts for debugging."""
        tokens = []
        for token_id in list(self.suppressed_token_ids)[:limit]:
            try:
                token_text = self.tokenizer.decode([token_id])
                tokens.append(f"{token_id}: '{token_text}'")
            except:
                tokens.append(f"{token_id}: <decode error>")
        return tokens


def get_nowait_bad_words_ids(
    tokenizer,
    keywords: Optional[List[str]] = None,
    config: Optional[NOWAITConfig] = None
) -> List[List[int]]:
    """
    Get bad_words_ids for use with vLLM or other frameworks.
    
    This returns the suppressed tokens in the format expected by
    frameworks that use bad_words_ids parameter.
    
    Args:
        tokenizer: The tokenizer for the target model
        keywords: Optional list of keywords to suppress
        config: Optional NOWAITConfig for customization
    
    Returns:
        List of token ID lists for bad_words_ids parameter
    
    Example:
        >>> from vllm import LLM, SamplingParams
        >>> llm = LLM(model="Qwen/QwQ-32B")
        >>> bad_words = get_nowait_bad_words_ids(llm.get_tokenizer())
        >>> params = SamplingParams(bad_words_ids=bad_words)
    """
    processor = NOWAITLogitProcessor(tokenizer, config=config, keywords=keywords)
    return [[token_id] for token_id in processor.suppressed_token_ids]


def create_nowait_stopping_criteria(
    tokenizer,
    max_reflections: int = 0
) -> "NOWAITStoppingCriteria":
    """
    Create a stopping criteria that limits reflection occurrences.
    
    Alternative to logit suppression - allows some reflections but stops
    if too many are detected.
    
    Args:
        tokenizer: The tokenizer for the target model
        max_reflections: Maximum allowed reflection keywords (0 = none)
    
    Returns:
        StoppingCriteria instance
    """
    return NOWAITStoppingCriteria(tokenizer, max_reflections)


class NOWAITStoppingCriteria:
    """
    Stopping criteria that monitors reflection keyword count.
    
    This is a softer alternative to complete suppression - it allows
    the model to use some reflection tokens but stops generation if
    the count exceeds a threshold.
    """
    
    def __init__(self, tokenizer, max_reflections: int = 0):
        self.tokenizer = tokenizer
        self.max_reflections = max_reflections
        self.config = NOWAITConfig()
        self.reflection_count = 0
    
    def __call__(
        self,
        input_ids: torch.LongTensor,
        scores: torch.FloatTensor,
        **kwargs
    ) -> bool:
        """Check if generation should stop based on reflection count."""
        # Decode latest token
        if input_ids.shape[1] > 0:
            latest_token = input_ids[0, -1].item()
            try:
                token_text = self.tokenizer.decode([latest_token]).lower()
                
                for keyword in self.config.keywords:
                    if keyword.lower() in token_text:
                        self.reflection_count += 1
                        break
            except:
                pass
        
        return self.reflection_count > self.max_reflections
    
    def reset(self):
        """Reset the reflection counter."""
        self.reflection_count = 0


# Convenience function for quick setup
def apply_nowait(
    model,
    tokenizer,
    prompt: str,
    max_new_tokens: int = 32768,
    temperature: float = 0.7,
    **generate_kwargs
) -> str:
    """
    Convenience function to generate with NOWAIT applied.
    
    Args:
        model: The language model
        tokenizer: The tokenizer
        prompt: Input prompt
        max_new_tokens: Maximum tokens to generate
        temperature: Sampling temperature
        **generate_kwargs: Additional arguments for model.generate()
    
    Returns:
        Generated text with NOWAIT optimization applied
    
    Example:
        >>> response = apply_nowait(model, tokenizer, "Solve: 2+2=?")
    """
    processor = NOWAITLogitProcessor(tokenizer)
    
    inputs = tokenizer(prompt, return_tensors="pt")
    if hasattr(model, "device"):
        inputs = {k: v.to(model.device) for k, v in inputs.items()}
    
    outputs = model.generate(
        **inputs,
        logits_processor=[processor],
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        do_sample=temperature > 0,
        **generate_kwargs
    )
    
    # Decode only the new tokens
    generated_ids = outputs[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(generated_ids, skip_special_tokens=True)


if __name__ == "__main__":
    # Demo/test mode
    print("NOWAIT Reasoning Optimizer")
    print("=" * 50)
    print(f"Default keywords: {DEFAULT_KEYWORDS}")
    print(f"Excluded patterns: {EXCLUDED_PATTERNS}")
    print()
    print("Usage example:")
    print("  from nowait_processor import NOWAITLogitProcessor")
    print("  processor = NOWAITLogitProcessor(tokenizer)")
    print("  model.generate(..., logits_processor=[processor])")