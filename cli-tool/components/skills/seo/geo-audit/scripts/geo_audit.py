#!/usr/bin/env python3
"""
GEO Audit Script

Comprehensive Generative Engine Optimization audit for websites.
Analyzes llms.txt, robots.txt, structured data, content structure,
and citation potential.

Usage:
    python geo_audit.py https://example.com
    python geo_audit.py https://example.com --verbose --output report.json
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install requests beautifulsoup4 lxml")
    sys.exit(1)


@dataclass
class AuditResult:
    """Result of a single audit check"""
    name: str
    score: int
    max_score: int
    status: str  # PASS, WARN, FAIL
    details: str
    recommendations: list = field(default_factory=list)


@dataclass
class GEOReport:
    """Complete GEO audit report"""
    url: str
    total_score: int = 0
    max_score: int = 100
    rating: str = ""
    results: list = field(default_factory=list)

    def add_result(self, result: AuditResult):
        self.results.append(result)
        self.total_score += result.score

    def calculate_rating(self):
        pct = (self.total_score / self.max_score) * 100
        if pct >= 90:
            self.rating = "EXCELLENT"
        elif pct >= 70:
            self.rating = "GOOD"
        elif pct >= 50:
            self.rating = "FAIR"
        elif pct >= 30:
            self.rating = "POOR"
        else:
            self.rating = "CRITICAL"


# AI Crawler User Agents to check
AI_CRAWLERS = {
    "GPTBot": "OpenAI/ChatGPT",
    "ChatGPT-User": "ChatGPT Browse Mode",
    "PerplexityBot": "Perplexity AI",
    "ClaudeBot": "Anthropic Claude",
    "Claude-Web": "Anthropic Claude Web",
    "anthropic-ai": "Anthropic AI",
    "Google-Extended": "Google Gemini",
    "CCBot": "Common Crawl (feeds LLMs)",
    "Applebot-Extended": "Apple Intelligence",
    "cohere-ai": "Cohere AI",
    "meta-externalagent": "Meta AI",
}


def fetch_url(url: str, timeout: int = 10) -> Optional[str]:
    """Fetch URL content with error handling"""
    try:
        headers = {"User-Agent": "GEO-Audit-Bot/1.0"}
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code == 200:
            return response.text
        return None
    except Exception as e:
        return None


def check_llms_txt(base_url: str) -> AuditResult:
    """Check llms.txt implementation"""
    llms_url = urljoin(base_url, "/llms.txt")
    content = fetch_url(llms_url)

    if not content:
        return AuditResult(
            name="llms.txt",
            score=0,
            max_score=25,
            status="FAIL",
            details="llms.txt not found at /llms.txt",
            recommendations=[
                "Create llms.txt file at root of your site",
                "Include site description, page sections, and contact info",
                "Set training permissions (Train: no) if desired"
            ]
        )

    # Analyze llms.txt content
    issues = []
    score = 15  # Base score for having the file

    # Check required fields
    if "Site:" not in content:
        issues.append("Missing Site: field")
        score -= 2
    if "Section:" not in content or "Title:" not in content:
        issues.append("Missing page sections")
        score -= 3
    if "Train:" not in content:
        issues.append("Missing Train: directive")
        score -= 2
    if "Contact:" not in content and "contact" not in content.lower():
        issues.append("Missing contact information")
        score -= 1

    # Count sections and pages
    sections = content.count("Section:")
    pages = content.count("Title:")

    status = "PASS" if score >= 20 else "WARN" if score >= 10 else "FAIL"
    details = f"llms.txt found with {sections} sections and {pages} pages"
    if issues:
        details += f". Issues: {', '.join(issues)}"

    return AuditResult(
        name="llms.txt",
        score=min(score, 25),
        max_score=25,
        status=status,
        details=details,
        recommendations=issues if issues else []
    )


def check_robots_txt(base_url: str) -> AuditResult:
    """Check robots.txt AI crawler rules"""
    robots_url = urljoin(base_url, "/robots.txt")
    content = fetch_url(robots_url)

    if not content:
        return AuditResult(
            name="AI Crawler Rules",
            score=5,
            max_score=20,
            status="WARN",
            details="robots.txt not found (crawlers allowed by default)",
            recommendations=["Create robots.txt with explicit AI crawler rules"]
        )

    # Check for AI crawler rules
    allowed = []
    blocked = []
    not_mentioned = []

    content_lower = content.lower()

    for crawler, description in AI_CRAWLERS.items():
        crawler_lower = crawler.lower()
        if f"user-agent: {crawler_lower}" in content_lower:
            # Found specific rule
            idx = content_lower.find(f"user-agent: {crawler_lower}")
            section = content_lower[idx:idx+200]
            if "disallow: /" in section and "disallow: /." not in section:
                blocked.append(crawler)
            else:
                allowed.append(crawler)
        else:
            # No specific rule, check default
            not_mentioned.append(crawler)

    # Calculate score
    score = 10  # Base score
    score += len(allowed) * 1  # Bonus for explicitly allowing
    score -= len(blocked) * 2  # Penalty for blocking

    status = "PASS" if len(blocked) == 0 else "WARN" if len(blocked) <= 2 else "FAIL"

    details = f"Allowed: {len(allowed)}, Blocked: {len(blocked)}, Default: {len(not_mentioned)}"
    if blocked:
        details += f". Blocked: {', '.join(blocked)}"

    recommendations = []
    if blocked:
        recommendations.append(f"Consider allowing: {', '.join(blocked)}")
    if not any(c.lower() in content_lower for c in AI_CRAWLERS.keys()):
        recommendations.append("Add explicit rules for AI crawlers")

    return AuditResult(
        name="AI Crawler Rules",
        score=min(score, 20),
        max_score=20,
        status=status,
        details=details,
        recommendations=recommendations
    )


def check_structured_data(base_url: str) -> AuditResult:
    """Check Schema.org structured data"""
    content = fetch_url(base_url)

    if not content:
        return AuditResult(
            name="Structured Data",
            score=0,
            max_score=20,
            status="FAIL",
            details="Could not fetch homepage",
            recommendations=["Ensure homepage is accessible"]
        )

    soup = BeautifulSoup(content, "lxml")

    # Find JSON-LD scripts
    schemas_found = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                schema_type = data.get("@type", "Unknown")
                schemas_found.append(schema_type)
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        schemas_found.append(item.get("@type", "Unknown"))
        except:
            pass

    # Priority schemas for GEO
    priority_schemas = ["Organization", "WebSite", "FAQPage", "Article", "HowTo", "BreadcrumbList"]
    found_priority = [s for s in schemas_found if s in priority_schemas]

    # Calculate score
    score = min(len(schemas_found) * 3, 12)  # Up to 12 points for having schemas
    score += min(len(found_priority) * 2, 8)  # Up to 8 points for priority schemas

    if not schemas_found:
        status = "FAIL"
        details = "No structured data found"
    elif len(found_priority) < 2:
        status = "WARN"
        details = f"Found {len(schemas_found)} schemas: {', '.join(schemas_found[:5])}"
    else:
        status = "PASS"
        details = f"Found {len(schemas_found)} schemas including: {', '.join(found_priority)}"

    recommendations = []
    missing_priority = [s for s in priority_schemas if s not in schemas_found]
    if missing_priority:
        recommendations.append(f"Add missing schemas: {', '.join(missing_priority[:3])}")
    if "FAQPage" not in schemas_found:
        recommendations.append("Add FAQ schema for question-based content")

    return AuditResult(
        name="Structured Data",
        score=min(score, 20),
        max_score=20,
        status=status,
        details=details,
        recommendations=recommendations
    )


def check_content_structure(base_url: str) -> AuditResult:
    """Check content structure for AI extraction"""
    content = fetch_url(base_url)

    if not content:
        return AuditResult(
            name="Content Structure",
            score=0,
            max_score=15,
            status="FAIL",
            details="Could not fetch homepage",
            recommendations=[]
        )

    soup = BeautifulSoup(content, "lxml")

    # Check headings
    h1_count = len(soup.find_all("h1"))
    h2_count = len(soup.find_all("h2"))
    h3_count = len(soup.find_all("h3"))

    # Check for question-style headings
    question_headings = 0
    for heading in soup.find_all(["h1", "h2", "h3"]):
        text = heading.get_text()
        if text.strip().endswith("?") or text.lower().startswith(("what", "how", "why", "when", "where", "who")):
            question_headings += 1

    # Check paragraph structure
    paragraphs = soup.find_all("p")
    long_paragraphs = sum(1 for p in paragraphs if len(p.get_text().split()) > 100)

    # Check for lists
    lists = len(soup.find_all(["ul", "ol"]))

    # Calculate score
    score = 5  # Base

    if h1_count == 1:
        score += 2
    if h2_count >= 3:
        score += 2
    if question_headings >= 2:
        score += 3
    if long_paragraphs < len(paragraphs) * 0.3:
        score += 2
    if lists >= 2:
        score += 1

    status = "PASS" if score >= 12 else "WARN" if score >= 8 else "FAIL"

    details = f"H1: {h1_count}, H2: {h2_count}, Question headings: {question_headings}, Lists: {lists}"

    recommendations = []
    if h1_count != 1:
        recommendations.append("Use exactly one H1 per page")
    if question_headings < 2:
        recommendations.append("Add more question-style headings (What is X? How to Y?)")
    if long_paragraphs > 0:
        recommendations.append(f"Break up {long_paragraphs} long paragraphs into 2-4 sentences each")
    if lists < 2:
        recommendations.append("Add bullet or numbered lists for key information")

    return AuditResult(
        name="Content Structure",
        score=min(score, 15),
        max_score=15,
        status=status,
        details=details,
        recommendations=recommendations
    )


def check_indexnow(base_url: str) -> AuditResult:
    """Check IndexNow implementation"""
    # Check for common IndexNow key file patterns
    domain = urlparse(base_url).netloc

    # Try to find IndexNow key file (common patterns)
    key_found = False
    for pattern in ["/indexnow-key.txt", "/indexnow.txt"]:
        content = fetch_url(urljoin(base_url, pattern))
        if content and len(content.strip()) > 10:
            key_found = True
            break

    if key_found:
        return AuditResult(
            name="IndexNow",
            score=10,
            max_score=10,
            status="PASS",
            details="IndexNow key file found",
            recommendations=["Ensure automatic submission on content changes"]
        )
    else:
        return AuditResult(
            name="IndexNow",
            score=0,
            max_score=10,
            status="WARN",
            details="No IndexNow key file found",
            recommendations=[
                "Set up IndexNow for instant Bing indexing",
                "Bing data feeds ChatGPT and other LLMs",
                "Create key file at /{key}.txt"
            ]
        )


def check_citation_signals(base_url: str) -> AuditResult:
    """Check citation-worthiness signals"""
    content = fetch_url(base_url)

    if not content:
        return AuditResult(
            name="Citation Signals",
            score=0,
            max_score=10,
            status="FAIL",
            details="Could not fetch homepage",
            recommendations=[]
        )

    soup = BeautifulSoup(content, "lxml")
    score = 0

    # Check for author attribution
    author_patterns = ["author", "written by", "by ", "contributor"]
    has_author = any(p in content.lower() for p in author_patterns)
    if has_author:
        score += 2

    # Check for dates
    date_patterns = ["published", "updated", "date", "posted"]
    has_dates = any(p in content.lower() for p in date_patterns)
    if has_dates:
        score += 2

    # Check for external links (sources)
    external_links = 0
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.startswith("http") and urlparse(base_url).netloc not in href:
            external_links += 1

    if external_links >= 3:
        score += 2
    elif external_links >= 1:
        score += 1

    # Check for statistics/data
    number_patterns = re.findall(r'\d+%|\d+\+|\$\d+', content)
    if len(number_patterns) >= 3:
        score += 2
    elif len(number_patterns) >= 1:
        score += 1

    # Check for credentials/expertise
    expertise_patterns = ["expert", "years of experience", "certified", "professional"]
    has_expertise = any(p in content.lower() for p in expertise_patterns)
    if has_expertise:
        score += 2

    status = "PASS" if score >= 8 else "WARN" if score >= 4 else "FAIL"

    details = f"Author: {'Yes' if has_author else 'No'}, Dates: {'Yes' if has_dates else 'No'}, External links: {external_links}, Data points: {len(number_patterns)}"

    recommendations = []
    if not has_author:
        recommendations.append("Add author attribution with credentials")
    if not has_dates:
        recommendations.append("Include publication and update dates")
    if external_links < 3:
        recommendations.append("Link to authoritative external sources")
    if len(number_patterns) < 3:
        recommendations.append("Include statistics and data points")

    return AuditResult(
        name="Citation Signals",
        score=min(score, 10),
        max_score=10,
        status=status,
        details=details,
        recommendations=recommendations
    )


def run_audit(url: str, verbose: bool = False) -> GEOReport:
    """Run complete GEO audit"""
    report = GEOReport(url=url)

    checks = [
        ("Checking llms.txt...", check_llms_txt),
        ("Checking AI crawler rules...", check_robots_txt),
        ("Checking structured data...", check_structured_data),
        ("Checking content structure...", check_content_structure),
        ("Checking IndexNow...", check_indexnow),
        ("Checking citation signals...", check_citation_signals),
    ]

    for msg, check_func in checks:
        if verbose:
            print(msg)
        result = check_func(url)
        report.add_result(result)
        if verbose:
            status_icon = "✓" if result.status == "PASS" else "⚠" if result.status == "WARN" else "✗"
            print(f"  {status_icon} {result.name}: {result.score}/{result.max_score}")

    report.calculate_rating()
    return report


def print_report(report: GEOReport):
    """Print formatted report"""
    print("\n" + "=" * 60)
    print(f"GEO AUDIT REPORT: {report.url}")
    print("=" * 60)

    print(f"\nOverall Score: {report.total_score}/{report.max_score} ({report.rating})")

    print("\n" + "-" * 60)
    print("DETAILED RESULTS")
    print("-" * 60)

    for result in report.results:
        status_icon = "✓" if result.status == "PASS" else "⚠" if result.status == "WARN" else "✗"
        print(f"\n{status_icon} {result.name}: {result.score}/{result.max_score}")
        print(f"  {result.details}")
        if result.recommendations:
            print("  Recommendations:")
            for rec in result.recommendations:
                print(f"    - {rec}")

    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="GEO Audit - Analyze website for AI visibility")
    parser.add_argument("url", help="URL to audit")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    parser.add_argument("-o", "--output", help="Output file (json)")
    parser.add_argument("--check", help="Run specific check only (llms-txt, robots-ai, schema, content, indexnow, citations)")

    args = parser.parse_args()

    # Ensure URL has scheme
    url = args.url
    if not url.startswith("http"):
        url = "https://" + url

    print(f"Auditing: {url}")

    report = run_audit(url, args.verbose)
    print_report(report)

    if args.output:
        output_data = {
            "url": report.url,
            "score": report.total_score,
            "max_score": report.max_score,
            "rating": report.rating,
            "results": [
                {
                    "name": r.name,
                    "score": r.score,
                    "max_score": r.max_score,
                    "status": r.status,
                    "details": r.details,
                    "recommendations": r.recommendations
                }
                for r in report.results
            ]
        }
        with open(args.output, "w") as f:
            json.dump(output_data, f, indent=2)
        print(f"\nReport saved to: {args.output}")


if __name__ == "__main__":
    main()
