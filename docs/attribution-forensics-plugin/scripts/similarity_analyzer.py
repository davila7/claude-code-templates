#!/usr/bin/env python3
"""
Attribution Forensics - Similarity Analyzer

Multi-method similarity analysis for detecting derivative works.

Usage:
    python similarity_analyzer.py <file1> <file2> [--methods all] [--threshold 0.7]
"""

import argparse
import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Optional
import difflib


@dataclass
class SimilarityResult:
    """Container for similarity analysis results"""
    overall_score: float
    content_hash_match: bool
    fuzzy_similarity: float
    token_overlap: float
    line_similarity: float
    structural_similarity: float
    confidence_level: str
    match_type: str
    evidence: Dict

    def to_dict(self):
        return asdict(self)


class ContentFingerprinter:
    """Generate fingerprints for content comparison"""

    @staticmethod
    def normalize_content(content: str) -> str:
        """
        Normalize content for comparison
        - Remove comments
        - Normalize whitespace
        - Remove blank lines
        """
        # Remove single-line comments (// and #)
        content = re.sub(r'(//|#).*$', '', content, flags=re.MULTILINE)

        # Remove multi-line comments (/* */ and ''' ''')
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        content = re.sub(r"'''.*?'''", '', content, flags=re.DOTALL)
        content = re.sub(r'""".*?"""', '', content, flags=re.DOTALL)

        # Normalize whitespace
        content = re.sub(r'\s+', ' ', content)

        # Remove blank lines
        lines = [line.strip() for line in content.split('\n') if line.strip()]

        return '\n'.join(lines)

    @staticmethod
    def exact_hash(content: str) -> str:
        """Calculate exact content hash (SHA-256)"""
        normalized = ContentFingerprinter.normalize_content(content)
        return hashlib.sha256(normalized.encode()).hexdigest()

    @staticmethod
    def token_ngrams(content: str, n: int = 5) -> set:
        """
        Extract n-grams of tokens for similarity comparison
        - Tokenize into words/symbols
        - Create overlapping n-grams
        - Return set for Jaccard similarity
        """
        # Tokenize: split by whitespace and common delimiters
        tokens = re.findall(r'\w+|[^\s\w]', content)

        # Create n-grams
        ngrams = set()
        for i in range(len(tokens) - n + 1):
            ngram = tuple(tokens[i:i+n])
            ngrams.add(ngram)

        return ngrams

    @staticmethod
    def extract_structure(content: str) -> Dict:
        """
        Extract structural elements (simplified AST)
        - Function/class definitions
        - Import statements
        - Key structural patterns
        """
        structure = {
            'functions': [],
            'classes': [],
            'imports': [],
            'keywords': []
        }

        # Extract function definitions
        func_pattern = r'(?:def|function)\s+(\w+)\s*\('
        structure['functions'] = re.findall(func_pattern, content)

        # Extract class definitions
        class_pattern = r'(?:class)\s+(\w+)'
        structure['classes'] = re.findall(class_pattern, content)

        # Extract imports
        import_pattern = r'(?:import|from|require)\s+([\w\.]+)'
        structure['imports'] = re.findall(import_pattern, content)

        # Common keywords (as proxy for logic patterns)
        keywords = ['if', 'else', 'for', 'while', 'return', 'try', 'catch', 'throw']
        for keyword in keywords:
            count = len(re.findall(r'\b' + keyword + r'\b', content))
            structure['keywords'].append((keyword, count))

        return structure


class SimilarityAnalyzer:
    """Analyze similarity between two files using multiple methods"""

    def __init__(self, threshold: float = 0.7):
        self.threshold = threshold
        self.fingerprinter = ContentFingerprinter()

    def analyze(self, file1_path: str, file2_path: str, methods: List[str] = None) -> SimilarityResult:
        """
        Perform comprehensive similarity analysis

        Args:
            file1_path: Path to first file
            file2_path: Path to second file
            methods: List of methods to use ['content', 'fuzzy', 'token', 'line', 'structure']
                     If None or 'all', use all methods

        Returns:
            SimilarityResult with detailed analysis
        """
        if methods is None or 'all' in methods:
            methods = ['content', 'fuzzy', 'token', 'line', 'structure']

        # Read files
        content1 = Path(file1_path).read_text(encoding='utf-8', errors='ignore')
        content2 = Path(file2_path).read_text(encoding='utf-8', errors='ignore')

        results = {}
        evidence = {}

        # Method 1: Exact content hash
        if 'content' in methods:
            hash1 = self.fingerprinter.exact_hash(content1)
            hash2 = self.fingerprinter.exact_hash(content2)
            results['content_hash_match'] = (hash1 == hash2)
            evidence['content_hashes'] = {'file1': hash1[:16], 'file2': hash2[:16]}

        # Method 2: Fuzzy string similarity (SequenceMatcher)
        if 'fuzzy' in methods:
            normalized1 = self.fingerprinter.normalize_content(content1)
            normalized2 = self.fingerprinter.normalize_content(content2)
            matcher = difflib.SequenceMatcher(None, normalized1, normalized2)
            results['fuzzy_similarity'] = matcher.ratio()
            evidence['fuzzy_blocks'] = matcher.get_matching_blocks()[:5]  # Top 5 blocks

        # Method 3: Token n-gram overlap (Jaccard similarity)
        if 'token' in methods:
            ngrams1 = self.fingerprinter.token_ngrams(content1, n=5)
            ngrams2 = self.fingerprinter.token_ngrams(content2, n=5)

            if len(ngrams1) == 0 and len(ngrams2) == 0:
                results['token_overlap'] = 1.0  # Both empty
            elif len(ngrams1) == 0 or len(ngrams2) == 0:
                results['token_overlap'] = 0.0
            else:
                intersection = len(ngrams1 & ngrams2)
                union = len(ngrams1 | ngrams2)
                results['token_overlap'] = intersection / union if union > 0 else 0.0

            evidence['token_stats'] = {
                'ngrams_file1': len(ngrams1),
                'ngrams_file2': len(ngrams2),
                'overlap': len(ngrams1 & ngrams2) if ngrams1 and ngrams2 else 0
            }

        # Method 4: Line-by-line similarity
        if 'line' in methods:
            lines1 = [line.strip() for line in content1.split('\n') if line.strip()]
            lines2 = [line.strip() for line in content2.split('\n') if line.strip()]

            matcher = difflib.SequenceMatcher(None, lines1, lines2)
            results['line_similarity'] = matcher.ratio()

            evidence['line_stats'] = {
                'lines_file1': len(lines1),
                'lines_file2': len(lines2),
                'matching_lines': sum(block.size for block in matcher.get_matching_blocks())
            }

        # Method 5: Structural similarity
        if 'structure' in methods:
            struct1 = self.fingerprinter.extract_structure(content1)
            struct2 = self.fingerprinter.extract_structure(content2)

            structural_scores = []

            # Compare functions
            if struct1['functions'] and struct2['functions']:
                func_overlap = len(set(struct1['functions']) & set(struct2['functions']))
                func_union = len(set(struct1['functions']) | set(struct2['functions']))
                structural_scores.append(func_overlap / func_union if func_union > 0 else 0)

            # Compare classes
            if struct1['classes'] and struct2['classes']:
                class_overlap = len(set(struct1['classes']) & set(struct2['classes']))
                class_union = len(set(struct1['classes']) | set(struct2['classes']))
                structural_scores.append(class_overlap / class_union if class_union > 0 else 0)

            # Compare imports
            if struct1['imports'] and struct2['imports']:
                import_overlap = len(set(struct1['imports']) & set(struct2['imports']))
                import_union = len(set(struct1['imports']) | set(struct2['imports']))
                structural_scores.append(import_overlap / import_union if import_union > 0 else 0)

            results['structural_similarity'] = sum(structural_scores) / len(structural_scores) if structural_scores else 0.0

            evidence['structural'] = {
                'functions_file1': struct1['functions'],
                'functions_file2': struct2['functions'],
                'classes_file1': struct1['classes'],
                'classes_file2': struct2['classes']
            }

        # Calculate overall score (weighted average)
        weights = {
            'content_hash_match': 0.0,  # Boolean, handled separately
            'fuzzy_similarity': 0.3,
            'token_overlap': 0.3,
            'line_similarity': 0.2,
            'structural_similarity': 0.2
        }

        overall_score = 0.0
        total_weight = 0.0

        for key, weight in weights.items():
            if key in results and key != 'content_hash_match':
                overall_score += results[key] * weight
                total_weight += weight

        if total_weight > 0:
            overall_score = overall_score / total_weight

        # Boost to 1.0 if exact match
        if results.get('content_hash_match', False):
            overall_score = 1.0

        # Determine confidence level
        if overall_score >= 0.9:
            confidence_level = 'very_high'
        elif overall_score >= 0.75:
            confidence_level = 'high'
        elif overall_score >= 0.6:
            confidence_level = 'medium'
        elif overall_score >= 0.4:
            confidence_level = 'low'
        else:
            confidence_level = 'very_low'

        # Determine match type
        if results.get('content_hash_match', False):
            match_type = 'exact_copy'
        elif overall_score >= 0.9:
            match_type = 'near_exact_copy'
        elif overall_score >= 0.75:
            match_type = 'modified_copy'
        elif overall_score >= 0.6:
            match_type = 'substantial_similarity'
        elif overall_score >= 0.4:
            match_type = 'moderate_similarity'
        else:
            match_type = 'low_similarity'

        return SimilarityResult(
            overall_score=overall_score,
            content_hash_match=results.get('content_hash_match', False),
            fuzzy_similarity=results.get('fuzzy_similarity', 0.0),
            token_overlap=results.get('token_overlap', 0.0),
            line_similarity=results.get('line_similarity', 0.0),
            structural_similarity=results.get('structural_similarity', 0.0),
            confidence_level=confidence_level,
            match_type=match_type,
            evidence=evidence
        )

    def interpret_result(self, result: SimilarityResult) -> str:
        """Generate human-readable interpretation"""

        interpretation = []
        interpretation.append(f"Overall Similarity: {result.overall_score:.2%}")
        interpretation.append(f"Match Type: {result.match_type.replace('_', ' ').title()}")
        interpretation.append(f"Confidence: {result.confidence_level.replace('_', ' ').title()}")
        interpretation.append("")

        # Detailed scores
        interpretation.append("Detailed Scores:")
        interpretation.append(f"  - Content Hash Match: {'Yes' if result.content_hash_match else 'No'}")
        interpretation.append(f"  - Fuzzy Similarity: {result.fuzzy_similarity:.2%}")
        interpretation.append(f"  - Token Overlap: {result.token_overlap:.2%}")
        interpretation.append(f"  - Line Similarity: {result.line_similarity:.2%}")
        interpretation.append(f"  - Structural Similarity: {result.structural_similarity:.2%}")
        interpretation.append("")

        # Interpretation
        if result.overall_score >= 0.9:
            interpretation.append("🔴 VERY HIGH SIMILARITY - Strong evidence of derivative work")
            interpretation.append("Recommendation: Investigate attribution and licensing")
        elif result.overall_score >= 0.75:
            interpretation.append("🟠 HIGH SIMILARITY - Likely derivative work with modifications")
            interpretation.append("Recommendation: Check for attribution and license compliance")
        elif result.overall_score >= 0.6:
            interpretation.append("🟡 SUBSTANTIAL SIMILARITY - Possible derivative work")
            interpretation.append("Recommendation: Manual review recommended")
        elif result.overall_score >= 0.4:
            interpretation.append("🟢 MODERATE SIMILARITY - May be inspired by or reimplementation")
            interpretation.append("Recommendation: Optional courtesy attribution")
        else:
            interpretation.append("⚪ LOW SIMILARITY - Likely original or coincidental")
            interpretation.append("Recommendation: No action needed")

        return '\n'.join(interpretation)


def main():
    parser = argparse.ArgumentParser(
        description='Analyze similarity between two files for attribution forensics'
    )
    parser.add_argument('file1', help='Path to first file')
    parser.add_argument('file2', help='Path to second file')
    parser.add_argument(
        '--methods',
        nargs='+',
        default=['all'],
        choices=['all', 'content', 'fuzzy', 'token', 'line', 'structure'],
        help='Similarity methods to use (default: all)'
    )
    parser.add_argument(
        '--threshold',
        type=float,
        default=0.7,
        help='Similarity threshold (default: 0.7)'
    )
    parser.add_argument(
        '--output',
        choices=['text', 'json'],
        default='text',
        help='Output format (default: text)'
    )

    args = parser.parse_args()

    # Validate files exist
    if not Path(args.file1).exists():
        print(f"Error: File not found: {args.file1}")
        return 1
    if not Path(args.file2).exists():
        print(f"Error: File not found: {args.file2}")
        return 1

    # Analyze similarity
    analyzer = SimilarityAnalyzer(threshold=args.threshold)
    result = analyzer.analyze(args.file1, args.file2, methods=args.methods)

    # Output results
    if args.output == 'json':
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print(f"Comparing:")
        print(f"  File 1: {args.file1}")
        print(f"  File 2: {args.file2}")
        print()
        print(analyzer.interpret_result(result))

        if result.overall_score >= args.threshold:
            print()
            print(f"✅ Similarity ({result.overall_score:.2%}) exceeds threshold ({args.threshold:.2%})")
            return 0
        else:
            print()
            print(f"❌ Similarity ({result.overall_score:.2%}) below threshold ({args.threshold:.2%})")
            return 1


if __name__ == '__main__':
    exit(main())
