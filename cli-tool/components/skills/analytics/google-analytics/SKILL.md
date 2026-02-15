---
name: google-analytics
description: Analyze Google Analytics data, review website performance metrics, identify traffic patterns, and suggest data-driven improvements. Use when the user asks about analytics, website metrics, traffic analysis, conversion rates, user behavior, or performance optimization.
---

# Google Analytics Analysis

Analyze website performance using Google Analytics data to provide actionable insights and improvement recommendations.

## Quick Start

### 1. Setup Authentication

This Skill requires Google Analytics API credentials. Set up environment variables:

```bash
export GOOGLE_ANALYTICS_PROPERTY_ID="your-property-id"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

Or create a `.env` file in your project root:

```env
GOOGLE_ANALYTICS_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

**Never commit credentials to version control.** The service account JSON file should be stored securely outside your repository.

### 2. Install Required Packages

```bash
# Option 1: Install from requirements file (recommended)
pip install -r cli-tool/components/skills/analytics/google-analytics/requirements.txt

# Option 2: Install individually
pip install google-analytics-data python-dotenv pandas
```

### 3. Analyze Your Project

Once configured, I can:
- Review current traffic and user behavior metrics
- Identify top-performing and underperforming pages
- Analyze traffic sources and conversion funnels
- Compare performance across time periods
- Suggest data-driven improvements

## How to Use

Ask me questions like:
- "Review our Google Analytics performance for the last 30 days"
- "What are our top traffic sources?"
- "Which pages have the highest bounce rates?"
- "Analyze user engagement and suggest improvements"
- "Compare this month's performance to last month"

## Analysis Workflow

When you ask me to analyze Google Analytics data, I will:

1. **Connect to the API** using the helper script
2. **Fetch relevant metrics** based on your question
3. **Analyze the data** looking for:
   - Traffic trends and patterns
   - User behavior insights
   - Performance bottlenecks
   - Conversion opportunities
4. **Provide recommendations** with:
   - Specific improvement suggestions
   - Priority level (high/medium/low)
   - Expected impact
   - Implementation guidance

## Common Metrics

For detailed metric definitions and dimensions, see [REFERENCE.md](REFERENCE.md).

### Traffic Metrics
- Sessions, Users, New Users
- Page views, Screens per Session
- Average Session Duration

### Engagement Metrics
- Bounce Rate, Engagement Rate
- Event Count, Conversions
- Scroll Depth, Click-through Rate

### Acquisition Metrics
- Traffic Source/Medium
- Campaign Performance
- Channel Grouping

### Conversion Metrics
- Goal Completions
- E-commerce Transactions
- Conversion Rate by Source

## Analysis Examples

For complete analysis patterns and use cases, see [EXAMPLES.md](EXAMPLES.md).

## Scripts

The Skill includes utility scripts for API interaction:

### Fetch Current Performance
```bash
python scripts/ga_client.py --days 30 --metrics sessions,users,bounceRate
```

### Analyze and Generate Report
```bash
python scripts/analyze.py --period last-30-days --compare previous-period
```

The scripts handle API authentication, data fetching, and basic analysis. I'll interpret the results and provide actionable recommendations.

## Troubleshooting

**Authentication Error**: Verify that:
- `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON file
- The service account has "Viewer" access to your GA4 property
- `GOOGLE_ANALYTICS_PROPERTY_ID` matches your GA4 property ID (not the measurement ID)

**No Data Returned**: Check that:
- The property ID is correct (find it in GA4 Admin > Property Settings)
- The date range contains data
- The service account has been granted access in GA4

**Import Errors**: Install required packages:
```bash
pip install google-analytics-data python-dotenv pandas
```

## Security Notes

- **Never hardcode** API credentials or property IDs in code
- Store service account JSON files **outside** version control
- Use environment variables or `.env` files for configuration
- Add `.env` and credential files to `.gitignore`
- Rotate service account keys periodically
- Use least-privilege access (Viewer role only)

## Data Privacy

This Skill accesses aggregated analytics data only. It does not:
- Access personally identifiable information (PII)
- Store analytics data persistently
- Share data with external services
- Modify your Google Analytics configuration

All data is processed locally and used only to generate recommendations during the conversation.
