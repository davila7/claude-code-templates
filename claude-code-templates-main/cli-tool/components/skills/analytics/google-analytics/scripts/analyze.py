#!/usr/bin/env python3
"""
Google Analytics Data Analysis Tool

Performs higher-level analysis on Google Analytics data including:
- Period comparisons (current vs previous)
- Trend detection
- Performance insights
- Automated recommendations

Usage:
    python analyze.py --period last-30-days --compare previous-period
    python analyze.py --analysis-type traffic-sources --days 30
    python analyze.py --analysis-type funnel --steps "homepage,/products,/cart,/checkout"
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

try:
    from ga_client import GoogleAnalyticsClient
except ImportError:
    print("Error: ga_client.py not found in the same directory", file=sys.stderr)
    sys.exit(1)


class AnalyticsAnalyzer:
    """Performs analysis on Google Analytics data."""

    def __init__(self):
        """Initialize the analyzer with GA client."""
        self.client = GoogleAnalyticsClient()

    def compare_periods(
        self, current_days: int = 30, metrics: Optional[List[str]] = None
    ) -> Dict:
        """
        Compare current period with previous period.

        Args:
            current_days: Number of days in current period
            metrics: List of metrics to compare (default: core metrics)

        Returns:
            Dictionary with comparison data and insights
        """
        if metrics is None:
            metrics = [
                "sessions",
                "activeUsers",
                "newUsers",
                "bounceRate",
                "engagementRate",
                "averageSessionDuration",
            ]

        # Fetch current period
        current = self.client.run_report(
            start_date=f"{current_days}daysAgo",
            end_date="yesterday",
            metrics=metrics,
            limit=1,
        )

        # Fetch previous period
        previous_start = current_days * 2
        previous_end = current_days + 1
        previous = self.client.run_report(
            start_date=f"{previous_start}daysAgo",
            end_date=f"{previous_end}daysAgo",
            metrics=metrics,
            limit=1,
        )

        # Calculate changes
        comparison = {
            "current_period": f"Last {current_days} days",
            "previous_period": f"Previous {current_days} days",
            "metrics": {},
        }

        if current["totals"] and previous["totals"]:
            for i, metric in enumerate(metrics):
                current_val = float(current["totals"][i]["value"])
                previous_val = float(previous["totals"][i]["value"])

                # Calculate percentage change
                if previous_val != 0:
                    change_pct = ((current_val - previous_val) / previous_val) * 100
                else:
                    change_pct = 0

                comparison["metrics"][metric] = {
                    "current": current_val,
                    "previous": previous_val,
                    "change": current_val - previous_val,
                    "change_percent": round(change_pct, 2),
                }

        # Generate insights
        comparison["insights"] = self._generate_insights(comparison["metrics"])

        return comparison

    def analyze_traffic_sources(self, days: int = 30, limit: int = 20) -> Dict:
        """
        Analyze traffic sources and their performance.

        Args:
            days: Number of days to analyze
            limit: Number of sources to return

        Returns:
            Dictionary with source performance data and recommendations
        """
        result = self.client.run_report(
            start_date=f"{days}daysAgo",
            end_date="yesterday",
            metrics=["sessions", "engagementRate", "bounceRate", "conversions"],
            dimensions=["sessionSource", "sessionMedium"],
            limit=limit,
            order_by="-sessions",
        )

        # Analyze sources
        sources = []
        for row in result["rows"]:
            source = row["dimensions"]["sessionSource"]
            medium = row["dimensions"]["sessionMedium"]
            sessions = int(row["metrics"]["sessions"])
            engagement = float(row["metrics"]["engagementRate"])
            bounce = float(row["metrics"]["bounceRate"])
            conversions = int(row["metrics"].get("conversions", 0))

            conv_rate = (conversions / sessions * 100) if sessions > 0 else 0

            sources.append(
                {
                    "source": source,
                    "medium": medium,
                    "sessions": sessions,
                    "engagement_rate": round(engagement * 100, 2),
                    "bounce_rate": round(bounce * 100, 2),
                    "conversions": conversions,
                    "conversion_rate": round(conv_rate, 2),
                }
            )

        analysis = {
            "period": f"Last {days} days",
            "sources": sources,
            "recommendations": self._recommend_source_optimizations(sources),
        }

        return analysis

    def analyze_content_performance(self, days: int = 30, limit: int = 50) -> Dict:
        """
        Analyze page performance and identify issues.

        Args:
            days: Number of days to analyze
            limit: Number of pages to return

        Returns:
            Dictionary with page performance and improvement opportunities
        """
        result = self.client.run_report(
            start_date=f"{days}daysAgo",
            end_date="yesterday",
            metrics=[
                "screenPageViews",
                "bounceRate",
                "averageSessionDuration",
                "conversions",
            ],
            dimensions=["pagePath", "pageTitle"],
            limit=limit,
            order_by="-screenPageViews",
        )

        # Identify high-bounce pages
        high_bounce_threshold = 0.6
        problem_pages = []

        for row in result["rows"]:
            page_path = row["dimensions"]["pagePath"]
            page_title = row["dimensions"]["pageTitle"]
            views = int(row["metrics"]["screenPageViews"])
            bounce = float(row["metrics"]["bounceRate"])
            avg_duration = float(row["metrics"]["averageSessionDuration"])

            if bounce > high_bounce_threshold and views > 100:
                problem_pages.append(
                    {
                        "path": page_path,
                        "title": page_title,
                        "views": views,
                        "bounce_rate": round(bounce * 100, 2),
                        "avg_duration": round(avg_duration, 2),
                        "issue": self._diagnose_page_issue(bounce, avg_duration),
                    }
                )

        analysis = {
            "period": f"Last {days} days",
            "total_pages": result["row_count"],
            "high_bounce_pages": len(problem_pages),
            "problem_pages": problem_pages[:10],  # Top 10 issues
            "recommendations": self._recommend_content_improvements(problem_pages),
        }

        return analysis

    def analyze_device_performance(self, days: int = 30) -> Dict:
        """
        Compare performance across device types.

        Args:
            days: Number of days to analyze

        Returns:
            Dictionary with device performance comparison
        """
        result = self.client.run_report(
            start_date=f"{days}daysAgo",
            end_date="yesterday",
            metrics=[
                "sessions",
                "bounceRate",
                "averageSessionDuration",
                "conversions",
                "engagementRate",
            ],
            dimensions=["deviceCategory"],
            limit=10,
            order_by="-sessions",
        )

        devices = []
        for row in result["rows"]:
            device = row["dimensions"]["deviceCategory"]
            sessions = int(row["metrics"]["sessions"])
            bounce = float(row["metrics"]["bounceRate"])
            duration = float(row["metrics"]["averageSessionDuration"])
            conversions = int(row["metrics"].get("conversions", 0))
            engagement = float(row["metrics"]["engagementRate"])

            conv_rate = (conversions / sessions * 100) if sessions > 0 else 0

            devices.append(
                {
                    "device": device,
                    "sessions": sessions,
                    "bounce_rate": round(bounce * 100, 2),
                    "avg_duration": round(duration, 2),
                    "conversion_rate": round(conv_rate, 2),
                    "engagement_rate": round(engagement * 100, 2),
                }
            )

        analysis = {
            "period": f"Last {days} days",
            "devices": devices,
            "recommendations": self._recommend_device_optimizations(devices),
        }

        return analysis

    def _generate_insights(self, metrics: Dict) -> List[str]:
        """Generate insights from metric comparisons."""
        insights = []

        for metric, data in metrics.items():
            change_pct = data["change_percent"]

            if abs(change_pct) < 2:
                status = "stable"
            elif change_pct > 0:
                status = "improving"
            else:
                status = "declining"

            # Add insights for significant changes
            if abs(change_pct) >= 5:
                direction = "increased" if change_pct > 0 else "decreased"
                insights.append(
                    f"{metric.replace('_', ' ').title()}: {direction} by {abs(change_pct):.1f}%"
                )

        return insights

    def _recommend_source_optimizations(self, sources: List[Dict]) -> List[Dict]:
        """Generate recommendations for traffic source optimization."""
        recommendations = []

        if not sources:
            return recommendations

        # Find best performing source
        best_source = max(sources, key=lambda x: x["conversion_rate"])
        recommendations.append(
            {
                "priority": "HIGH",
                "action": f"Scale {best_source['source']}/{best_source['medium']}",
                "reason": f"Highest conversion rate ({best_source['conversion_rate']}%)",
                "expected_impact": "Increase overall conversions by 20-30%",
            }
        )

        # Find high-traffic low-conversion sources
        for source in sources[:5]:  # Check top 5
            if source["conversion_rate"] < 2.0 and source["sessions"] > 1000:
                recommendations.append(
                    {
                        "priority": "MEDIUM",
                        "action": f"Optimize {source['source']}/{source['medium']}",
                        "reason": f"High traffic ({source['sessions']} sessions) but low conversion ({source['conversion_rate']}%)",
                        "expected_impact": "Potential conversion rate improvement of 50-100%",
                    }
                )

        return recommendations

    def _recommend_content_improvements(self, problem_pages: List[Dict]) -> List[Dict]:
        """Generate recommendations for content improvements."""
        recommendations = []

        if not problem_pages:
            recommendations.append(
                {
                    "priority": "INFO",
                    "action": "Content performing well",
                    "reason": "No pages with critically high bounce rates",
                    "expected_impact": "Continue monitoring",
                }
            )
            return recommendations

        # Prioritize by traffic
        problem_pages.sort(key=lambda x: x["views"], reverse=True)

        for page in problem_pages[:3]:  # Top 3 issues
            recommendations.append(
                {
                    "priority": "HIGH",
                    "action": f"Improve {page['path']}",
                    "reason": f"{page['issue']} ({page['bounce_rate']}% bounce rate)",
                    "expected_impact": "Reduce bounce rate by 20-30%",
                }
            )

        return recommendations

    def _recommend_device_optimizations(self, devices: List[Dict]) -> List[Dict]:
        """Generate recommendations for device optimization."""
        recommendations = []

        if len(devices) < 2:
            return recommendations

        # Compare mobile vs desktop
        mobile = next((d for d in devices if d["device"] == "mobile"), None)
        desktop = next((d for d in devices if d["device"] == "desktop"), None)

        if mobile and desktop:
            conv_diff = (
                (desktop["conversion_rate"] - mobile["conversion_rate"])
                / desktop["conversion_rate"]
                * 100
            )

            if conv_diff > 30:  # Desktop significantly better
                recommendations.append(
                    {
                        "priority": "CRITICAL",
                        "action": "Mobile experience optimization",
                        "reason": f"Mobile conversion rate {mobile['conversion_rate']}% vs desktop {desktop['conversion_rate']}%",
                        "expected_impact": "Improve mobile conversion by 30-50%",
                    }
                )

        return recommendations

    def _diagnose_page_issue(self, bounce_rate: float, avg_duration: float) -> str:
        """Diagnose the issue with a high-bounce page."""
        if bounce_rate > 0.7 and avg_duration < 30:
            return "Content mismatch - users leave quickly"
        elif bounce_rate > 0.6 and avg_duration > 60:
            return "Missing CTA - users read but don't act"
        elif bounce_rate > 0.6:
            return "High bounce - needs investigation"
        else:
            return "Performance issue"


def main():
    parser = argparse.ArgumentParser(
        description="Analyze Google Analytics data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--analysis-type",
        choices=["overview", "sources", "content", "devices"],
        default="overview",
        help="Type of analysis to perform",
    )
    parser.add_argument(
        "--days", type=int, default=30, help="Number of days to analyze (default: 30)"
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare with previous period",
    )
    parser.add_argument(
        "--output", help="Output file path (default: stdout)"
    )

    args = parser.parse_args()

    try:
        analyzer = AnalyticsAnalyzer()

        # Run analysis
        if args.analysis_type == "overview" and args.compare:
            result = analyzer.compare_periods(current_days=args.days)
        elif args.analysis_type == "sources":
            result = analyzer.analyze_traffic_sources(days=args.days)
        elif args.analysis_type == "content":
            result = analyzer.analyze_content_performance(days=args.days)
        elif args.analysis_type == "devices":
            result = analyzer.analyze_device_performance(days=args.days)
        else:
            result = analyzer.compare_periods(current_days=args.days)

        # Format output
        output = json.dumps(result, indent=2)

        # Write output
        if args.output:
            with open(args.output, "w") as f:
                f.write(output)
            print(f"Analysis saved to {args.output}", file=sys.stderr)
        else:
            print(output)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
