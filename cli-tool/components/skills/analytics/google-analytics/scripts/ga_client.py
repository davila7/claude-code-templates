#!/usr/bin/env python3
"""
Google Analytics 4 Data API Client

Fetches analytics data from Google Analytics 4 using the Data API.
Authentication uses service account credentials from environment variables.

Usage:
    python ga_client.py --days 30 --metrics sessions,users
    python ga_client.py --start 2026-01-01 --end 2026-01-31 --dimensions country
    python ga_client.py --days 7 --metrics sessions --dimensions pagePath --limit 10

Environment Variables:
    GOOGLE_ANALYTICS_PROPERTY_ID: GA4 property ID (required)
    GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON (required)
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional

try:
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Metric,
        RunReportRequest,
        OrderBy,
        FilterExpression,
        Filter,
    )
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Error: Required package not installed: {e}", file=sys.stderr)
    print("Install with: pip install google-analytics-data python-dotenv", file=sys.stderr)
    sys.exit(1)


class GoogleAnalyticsClient:
    """Client for interacting with Google Analytics 4 Data API."""

    def __init__(self):
        """Initialize the client with credentials from environment."""
        load_dotenv()  # Load from .env file if present

        self.property_id = os.environ.get("GOOGLE_ANALYTICS_PROPERTY_ID")
        if not self.property_id:
            raise ValueError(
                "GOOGLE_ANALYTICS_PROPERTY_ID environment variable not set. "
                "Find your property ID in GA4: Admin > Property Settings"
            )

        credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if not credentials_path:
            raise ValueError(
                "GOOGLE_APPLICATION_CREDENTIALS environment variable not set. "
                "Set it to the path of your service account JSON file."
            )

        if not os.path.exists(credentials_path):
            raise FileNotFoundError(
                f"Service account file not found: {credentials_path}"
            )

        try:
            self.client = BetaAnalyticsDataClient()
        except Exception as e:
            raise RuntimeError(
                f"Failed to initialize Google Analytics client: {e}\n"
                "Verify your service account has access to the GA4 property."
            )

    def run_report(
        self,
        start_date: str,
        end_date: str,
        metrics: List[str],
        dimensions: Optional[List[str]] = None,
        limit: int = 10,
        order_by: Optional[str] = None,
        filter_expression: Optional[str] = None,
    ) -> Dict:
        """
        Run a report query against Google Analytics.

        Args:
            start_date: Start date (YYYY-MM-DD or 'NdaysAgo')
            end_date: End date (YYYY-MM-DD or 'today'/'yesterday')
            metrics: List of metric names (e.g., ['sessions', 'users'])
            dimensions: List of dimension names (e.g., ['country', 'city'])
            limit: Maximum number of rows to return
            order_by: Metric or dimension to sort by
            filter_expression: Filter to apply (dimension_name:value)

        Returns:
            Dictionary with report data and metadata
        """
        # Build request
        request = RunReportRequest(
            property=f"properties/{self.property_id}",
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            metrics=[Metric(name=m) for m in metrics],
            dimensions=[Dimension(name=d) for d in (dimensions or [])],
            limit=limit,
        )

        # Add ordering
        if order_by:
            desc = True
            if order_by.startswith("+"):
                desc = False
                order_by = order_by[1:]
            elif order_by.startswith("-"):
                order_by = order_by[1:]

            # Check if it's a metric or dimension
            if order_by in metrics:
                request.order_bys = [
                    OrderBy(metric=OrderBy.MetricOrderBy(metric_name=order_by), desc=desc)
                ]
            elif dimensions and order_by in dimensions:
                request.order_bys = [
                    OrderBy(
                        dimension=OrderBy.DimensionOrderBy(dimension_name=order_by),
                        desc=desc,
                    )
                ]

        # Add filter
        if filter_expression and ":" in filter_expression:
            field_name, value = filter_expression.split(":", 1)
            request.dimension_filter = FilterExpression(
                filter=Filter(
                    field_name=field_name,
                    string_filter=Filter.StringFilter(value=value),
                )
            )

        try:
            response = self.client.run_report(request)
        except Exception as e:
            raise RuntimeError(f"Failed to run report: {e}")

        # Parse response
        return self._parse_response(response)

    def _parse_response(self, response) -> Dict:
        """Parse API response into a structured dictionary."""
        result = {
            "dimension_headers": [h.name for h in response.dimension_headers],
            "metric_headers": [
                {"name": h.name, "type": h.type_.name} for h in response.metric_headers
            ],
            "rows": [],
            "row_count": response.row_count,
            "metadata": {},
        }

        # Add totals if present
        if response.totals:
            result["totals"] = [
                {"value": v.value} for v in response.totals[0].metric_values
            ]

        # Parse rows
        for row in response.rows:
            parsed_row = {
                "dimensions": {},
                "metrics": {},
            }

            # Dimension values
            for i, value in enumerate(row.dimension_values):
                dim_name = result["dimension_headers"][i]
                parsed_row["dimensions"][dim_name] = value.value

            # Metric values
            for i, value in enumerate(row.metric_values):
                metric_info = result["metric_headers"][i]
                metric_name = metric_info["name"]
                parsed_row["metrics"][metric_name] = value.value

            result["rows"].append(parsed_row)

        return result


def parse_date_range(days: Optional[int], start: Optional[str], end: Optional[str]):
    """Parse date range arguments into start and end dates."""
    if days:
        return f"{days}daysAgo", "yesterday"
    elif start and end:
        return start, end
    else:
        # Default to last 7 days
        return "7daysAgo", "yesterday"


def main():
    parser = argparse.ArgumentParser(
        description="Fetch Google Analytics 4 data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Last 30 days of sessions and users
  python ga_client.py --days 30 --metrics sessions,users

  # Specific date range with dimensions
  python ga_client.py --start 2026-01-01 --end 2026-01-31 \\
      --metrics sessions,bounceRate --dimensions country,city

  # Top pages by views
  python ga_client.py --days 7 --metrics screenPageViews \\
      --dimensions pagePath --order-by screenPageViews --limit 20

  # Filter by country
  python ga_client.py --days 30 --metrics sessions \\
      --dimensions country --filter "country:United States"
        """,
    )

    # Date range arguments
    date_group = parser.add_mutually_exclusive_group()
    date_group.add_argument(
        "--days", type=int, help="Number of days to look back (e.g., 30)"
    )
    date_group.add_argument(
        "--start", help="Start date (YYYY-MM-DD or 'NdaysAgo')"
    )
    parser.add_argument("--end", help="End date (YYYY-MM-DD or 'today'/'yesterday')")

    # Query arguments
    parser.add_argument(
        "--metrics",
        required=True,
        help="Comma-separated list of metrics (e.g., sessions,users,bounceRate)",
    )
    parser.add_argument(
        "--dimensions",
        help="Comma-separated list of dimensions (e.g., country,city,deviceCategory)",
    )
    parser.add_argument(
        "--limit", type=int, default=10, help="Maximum rows to return (default: 10)"
    )
    parser.add_argument(
        "--order-by",
        help="Metric or dimension to sort by (prefix with - for desc, + for asc)",
    )
    parser.add_argument(
        "--filter", help="Filter expression (e.g., 'country:United States')"
    )

    # Output arguments
    parser.add_argument(
        "--format",
        choices=["json", "table"],
        default="json",
        help="Output format (default: json)",
    )
    parser.add_argument(
        "--output", help="Output file path (default: stdout)"
    )

    args = parser.parse_args()

    try:
        # Initialize client
        client = GoogleAnalyticsClient()

        # Parse date range
        start_date, end_date = parse_date_range(args.days, args.start, args.end)

        # Parse metrics and dimensions
        metrics = [m.strip() for m in args.metrics.split(",")]
        dimensions = (
            [d.strip() for d in args.dimensions.split(",")] if args.dimensions else None
        )

        # Run report
        result = client.run_report(
            start_date=start_date,
            end_date=end_date,
            metrics=metrics,
            dimensions=dimensions,
            limit=args.limit,
            order_by=args.order_by,
            filter_expression=args.filter,
        )

        # Format output
        if args.format == "json":
            output = json.dumps(result, indent=2)
        else:  # table format
            output = format_as_table(result)

        # Write output
        if args.output:
            with open(args.output, "w") as f:
                f.write(output)
            print(f"Report saved to {args.output}", file=sys.stderr)
        else:
            print(output)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def format_as_table(result: Dict) -> str:
    """Format result as a human-readable table."""
    lines = []

    # Header
    headers = result["dimension_headers"] + [m["name"] for m in result["metric_headers"]]
    lines.append(" | ".join(headers))
    lines.append("-" * (len(" | ".join(headers))))

    # Rows
    for row in result["rows"]:
        values = []
        for dim in result["dimension_headers"]:
            values.append(row["dimensions"].get(dim, ""))
        for metric in result["metric_headers"]:
            values.append(row["metrics"].get(metric["name"], ""))
        lines.append(" | ".join(values))

    # Totals
    if "totals" in result:
        lines.append("-" * (len(" | ".join(headers))))
        total_values = ["TOTAL"] + [""] * (len(result["dimension_headers"]) - 1)
        total_values += [t["value"] for t in result["totals"]]
        lines.append(" | ".join(total_values))

    lines.append("")
    lines.append(f"Total rows: {result['row_count']}")

    return "\n".join(lines)


if __name__ == "__main__":
    main()
