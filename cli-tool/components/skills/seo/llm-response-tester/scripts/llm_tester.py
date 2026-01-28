#!/usr/bin/env python3
"""
LLM Response Tester

Test what AI systems say about your website or brand.
Uses API calls (preferred) or Playwright for browser automation.

Usage:
    python llm_tester.py "What is aitmpl.com?"
    python llm_tester.py "Best Claude Code tools" --platforms chatgpt,perplexity
    python llm_tester.py "query" --output results.json
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

# Check for required packages
try:
    import requests
except ImportError:
    print("Required: pip install requests")
    sys.exit(1)


@dataclass
class LLMResponse:
    """Response from an LLM platform"""
    platform: str
    model: str
    query: str
    response: str
    citations: list = field(default_factory=list)
    mentions: list = field(default_factory=list)
    timestamp: str = ""
    error: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


@dataclass
class TestResult:
    """Complete test results across platforms"""
    query: str
    results: list = field(default_factory=list)
    summary: dict = field(default_factory=dict)


def extract_citations(text: str) -> list:
    """Extract URLs and domain references from text"""
    citations = []

    # Find URLs
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    urls = re.findall(url_pattern, text)
    for url in urls:
        citations.append({"type": "url", "value": url.rstrip(".,;)")})

    # Find domain mentions (e.g., "according to example.com")
    domain_pattern = r'\b([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}\b'
    domains = re.findall(domain_pattern, text.lower())
    for domain in set(domains):
        if domain not in [c["value"] for c in citations]:
            citations.append({"type": "domain", "value": domain})

    return citations


def extract_mentions(text: str, keywords: list) -> list:
    """Extract keyword mentions from text"""
    mentions = []
    text_lower = text.lower()

    for keyword in keywords:
        keyword_lower = keyword.lower()
        count = text_lower.count(keyword_lower)
        if count > 0:
            # Find context around first mention
            idx = text_lower.find(keyword_lower)
            start = max(0, idx - 50)
            end = min(len(text), idx + len(keyword) + 50)
            context = text[start:end].strip()

            mentions.append({
                "keyword": keyword,
                "count": count,
                "first_context": f"...{context}..."
            })

    return mentions


def test_openai(query: str, model: str = "gpt-4o") -> LLMResponse:
    """Test query using OpenAI API"""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return LLMResponse(
            platform="chatgpt",
            model=model,
            query=query,
            response="",
            error="OPENAI_API_KEY not set"
        )

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": query}],
                "temperature": 0.7,
                "max_tokens": 2000
            },
            timeout=60
        )

        if response.status_code == 200:
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            return LLMResponse(
                platform="chatgpt",
                model=model,
                query=query,
                response=text,
                citations=extract_citations(text)
            )
        else:
            return LLMResponse(
                platform="chatgpt",
                model=model,
                query=query,
                response="",
                error=f"API error: {response.status_code}"
            )
    except Exception as e:
        return LLMResponse(
            platform="chatgpt",
            model=model,
            query=query,
            response="",
            error=str(e)
        )


def test_anthropic(query: str, model: str = "claude-3-5-sonnet-20241022") -> LLMResponse:
    """Test query using Anthropic API"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return LLMResponse(
            platform="claude",
            model=model,
            query=query,
            response="",
            error="ANTHROPIC_API_KEY not set"
        )

    try:
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "max_tokens": 2000,
                "messages": [{"role": "user", "content": query}]
            },
            timeout=60
        )

        if response.status_code == 200:
            data = response.json()
            text = data["content"][0]["text"]
            return LLMResponse(
                platform="claude",
                model=model,
                query=query,
                response=text,
                citations=extract_citations(text)
            )
        else:
            return LLMResponse(
                platform="claude",
                model=model,
                query=query,
                response="",
                error=f"API error: {response.status_code}"
            )
    except Exception as e:
        return LLMResponse(
            platform="claude",
            model=model,
            query=query,
            response="",
            error=str(e)
        )


def test_perplexity(query: str, model: str = "sonar-pro") -> LLMResponse:
    """Test query using Perplexity API"""
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        return LLMResponse(
            platform="perplexity",
            model=model,
            query=query,
            response="",
            error="PERPLEXITY_API_KEY not set"
        )

    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": query}]
            },
            timeout=60
        )

        if response.status_code == 200:
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            # Perplexity often includes citations in response
            return LLMResponse(
                platform="perplexity",
                model=model,
                query=query,
                response=text,
                citations=extract_citations(text)
            )
        else:
            return LLMResponse(
                platform="perplexity",
                model=model,
                query=query,
                response="",
                error=f"API error: {response.status_code}"
            )
    except Exception as e:
        return LLMResponse(
            platform="perplexity",
            model=model,
            query=query,
            response="",
            error=str(e)
        )


def run_tests(query: str, platforms: list, track_keywords: list = None) -> TestResult:
    """Run tests across specified platforms"""
    result = TestResult(query=query)

    platform_functions = {
        "chatgpt": test_openai,
        "claude": test_anthropic,
        "perplexity": test_perplexity
    }

    for platform in platforms:
        if platform in platform_functions:
            print(f"Testing {platform}...")
            response = platform_functions[platform](query)

            # Track keyword mentions if specified
            if track_keywords and response.response:
                response.mentions = extract_mentions(response.response, track_keywords)

            result.results.append(response)
            if response.error:
                print(f"  Error: {response.error}")
            else:
                print(f"  Response length: {len(response.response)} chars")
                print(f"  Citations found: {len(response.citations)}")

    # Generate summary
    total_citations = sum(len(r.citations) for r in result.results if not r.error)
    platforms_with_response = [r.platform for r in result.results if r.response]

    result.summary = {
        "platforms_tested": len(result.results),
        "platforms_responded": len(platforms_with_response),
        "total_citations": total_citations,
        "platforms_with_response": platforms_with_response
    }

    if track_keywords:
        keyword_counts = {}
        for r in result.results:
            for mention in r.mentions:
                kw = mention["keyword"]
                keyword_counts[kw] = keyword_counts.get(kw, 0) + mention["count"]
        result.summary["keyword_mentions"] = keyword_counts

    return result


def print_results(result: TestResult):
    """Print formatted results"""
    print("\n" + "=" * 60)
    print(f"LLM RESPONSE TEST: {result.query[:50]}...")
    print("=" * 60)

    for r in result.results:
        print(f"\n--- {r.platform.upper()} ({r.model}) ---")
        if r.error:
            print(f"Error: {r.error}")
        else:
            # Truncate long responses
            response_preview = r.response[:500] + "..." if len(r.response) > 500 else r.response
            print(f"Response:\n{response_preview}")

            if r.citations:
                print(f"\nCitations ({len(r.citations)}):")
                for c in r.citations[:5]:  # Show first 5
                    print(f"  - [{c['type']}] {c['value']}")

            if r.mentions:
                print(f"\nKeyword Mentions:")
                for m in r.mentions:
                    print(f"  - '{m['keyword']}': {m['count']} times")

    print("\n" + "-" * 60)
    print("SUMMARY")
    print("-" * 60)
    print(f"Platforms tested: {result.summary['platforms_tested']}")
    print(f"Platforms responded: {result.summary['platforms_responded']}")
    print(f"Total citations: {result.summary['total_citations']}")

    if "keyword_mentions" in result.summary:
        print(f"Keyword mentions: {result.summary['keyword_mentions']}")


def main():
    parser = argparse.ArgumentParser(description="Test LLM responses about your site/brand")
    parser.add_argument("query", help="Query to test")
    parser.add_argument(
        "--platforms",
        default="chatgpt,claude,perplexity",
        help="Platforms to test (comma-separated)"
    )
    parser.add_argument(
        "--track",
        help="Keywords to track mentions (comma-separated)"
    )
    parser.add_argument("-o", "--output", help="Output file (json)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    platforms = [p.strip() for p in args.platforms.split(",")]
    track_keywords = [k.strip() for k in args.track.split(",")] if args.track else []

    result = run_tests(args.query, platforms, track_keywords)
    print_results(result)

    if args.output:
        output_data = {
            "query": result.query,
            "timestamp": datetime.now().isoformat(),
            "summary": result.summary,
            "results": [
                {
                    "platform": r.platform,
                    "model": r.model,
                    "response": r.response,
                    "citations": r.citations,
                    "mentions": r.mentions,
                    "error": r.error
                }
                for r in result.results
            ]
        }
        with open(args.output, "w") as f:
            json.dump(output_data, f, indent=2)
        print(f"\nResults saved to: {args.output}")


if __name__ == "__main__":
    main()
