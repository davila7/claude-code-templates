# Google Analytics Metrics Reference

Complete reference for Google Analytics 4 (GA4) metrics and dimensions.

## Core Metrics

### User Metrics

| Metric | Description | Use Case |
|--------|-------------|----------|
| `activeUsers` | Users who engaged with your site or app | Overall audience size |
| `newUsers` | First-time users | Growth tracking |
| `totalUsers` | Total number of users | Audience reach |
| `userEngagementDuration` | Total time users spent engaged | Content quality |
| `engagedSessions` | Sessions lasting >10s with conversion or 2+ page views | Quality sessions |

### Session Metrics

| Metric | Description | Use Case |
|--------|-------------|----------|
| `sessions` | Total number of sessions | Traffic volume |
| `sessionsPerUser` | Average sessions per user | User retention |
| `averageSessionDuration` | Mean session length | Engagement depth |
| `bounceRate` | Percentage of single-page sessions | Content relevance |
| `engagementRate` | Percentage of engaged sessions | Quality of traffic |

### Page/Screen Metrics

| Metric | Description | Use Case |
|--------|-------------|----------|
| `screenPageViews` | Total page and screen views | Content consumption |
| `screenPageViewsPerSession` | Average pages per session | Site exploration |
| `screenPageViewsPerUser` | Average pages per user | User journey depth |

### Event Metrics

| Metric | Description | Use Case |
|--------|-------------|----------|
| `eventCount` | Total number of events | Interaction tracking |
| `eventCountPerUser` | Average events per user | User activity level |
| `conversions` | Total conversion events | Goal achievement |
| `totalRevenue` | Total revenue from all sources | Monetization |

### E-commerce Metrics

| Metric | Description | Use Case |
|--------|-------------|----------|
| `transactions` | Number of purchases | Sales volume |
| `purchaseRevenue` | Revenue from purchases | Sales performance |
| `averagePurchaseRevenue` | Average transaction value | Revenue per sale |
| `itemsViewed` | Product detail views | Product interest |
| `addToCarts` | Items added to cart | Purchase intent |
| `checkouts` | Checkout initiations | Conversion funnel |

## Key Dimensions

### Traffic Source Dimensions

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `sessionSource` | Source of traffic | google, facebook, direct |
| `sessionMedium` | Marketing medium | organic, cpc, referral, email |
| `sessionCampaignName` | Campaign identifier | spring-sale, black-friday |
| `sessionDefaultChannelGroup` | Channel grouping | Organic Search, Paid Social, Direct |
| `firstUserSource` | Source of user's first visit | google, twitter, newsletter |

### Content Dimensions

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `pagePath` | Page URL path | /blog/post-title, /products/item |
| `pageTitle` | Page title | Home, Product Page, Blog Post |
| `pageLocation` | Full page URL | https://example.com/page |
| `landingPage` | First page of session | /home, /blog/article |
| `exitPage` | Last page of session | /checkout, /contact |

### User Dimensions

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `country` | User country | United States, United Kingdom |
| `city` | User city | New York, London, Tokyo |
| `deviceCategory` | Device type | mobile, desktop, tablet |
| `browser` | Browser name | Chrome, Safari, Firefox |
| `operatingSystem` | OS name | Windows, macOS, Android, iOS |

### Time Dimensions

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `date` | Date (YYYYMMDD) | 20260118 |
| `year` | Year | 2026 |
| `month` | Month | 01, 02, 03 |
| `week` | Week number | 01, 02, 03 |
| `dayOfWeek` | Day of week | Sunday, Monday |
| `hour` | Hour of day | 00-23 |

## Common Metric Combinations

### Traffic Analysis
```python
metrics = [
    "sessions",
    "activeUsers",
    "newUsers",
    "engagementRate",
    "bounceRate"
]
dimensions = ["sessionSource", "sessionMedium"]
```

### Content Performance
```python
metrics = [
    "screenPageViews",
    "averageSessionDuration",
    "bounceRate",
    "eventCount"
]
dimensions = ["pagePath", "pageTitle"]
```

### User Behavior
```python
metrics = [
    "activeUsers",
    "sessionsPerUser",
    "screenPageViewsPerSession",
    "userEngagementDuration"
]
dimensions = ["deviceCategory", "country"]
```

### Conversion Tracking
```python
metrics = [
    "conversions",
    "sessions",
    "eventCount",
    "engagementRate"
]
dimensions = ["sessionSource", "sessionMedium", "sessionCampaignName"]
```

### E-commerce Analysis
```python
metrics = [
    "transactions",
    "purchaseRevenue",
    "averagePurchaseRevenue",
    "itemsViewed",
    "addToCarts"
]
dimensions = ["sessionSource", "deviceCategory"]
```

## Date Range Formats

### Relative Ranges
- `yesterday` - Previous day
- `today` - Current day
- `7daysAgo` - Week ago
- `30daysAgo` - Month ago
- `90daysAgo` - Quarter ago

### Absolute Ranges
- Format: `YYYY-MM-DD`
- Example: `2026-01-01` to `2026-01-31`

### Common Periods
```python
# Last 7 days
start_date = "7daysAgo"
end_date = "yesterday"

# Last 30 days
start_date = "30daysAgo"
end_date = "yesterday"

# Month-to-date
start_date = "2026-01-01"
end_date = "today"

# Compare periods
current_start = "30daysAgo"
current_end = "yesterday"
previous_start = "60daysAgo"
previous_end = "31daysAgo"
```

## Filters

### Basic Filters
```python
# Filter by page path
dimension_filter = {
    "filter": {
        "fieldName": "pagePath",
        "stringFilter": {"value": "/blog"}
    }
}

# Filter by country
dimension_filter = {
    "filter": {
        "fieldName": "country",
        "stringFilter": {"value": "United States"}
    }
}

# Filter by session source
dimension_filter = {
    "filter": {
        "fieldName": "sessionSource",
        "stringFilter": {"value": "google"}
    }
}
```

### Numeric Filters
```python
# Sessions greater than 100
metric_filter = {
    "filter": {
        "fieldName": "sessions",
        "numericFilter": {
            "operation": "GREATER_THAN",
            "value": {"int64Value": "100"}
        }
    }
}
```

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `EXACT` | Exact match | Country = "United States" |
| `BEGINS_WITH` | Starts with | Page path starts with "/blog" |
| `ENDS_WITH` | Ends with | Page path ends with ".html" |
| `CONTAINS` | Contains substring | Page title contains "guide" |
| `REGEX` | Regular expression | Path matches pattern |

## Order By

Sort results by metrics or dimensions:

```python
# Order by sessions descending
order_bys = [{
    "metric": {"metricName": "sessions"},
    "desc": True
}]

# Order by page path ascending
order_bys = [{
    "dimension": {"dimensionName": "pagePath"},
    "desc": False
}]
```

## API Response Structure

```python
{
    "dimensionHeaders": [
        {"name": "sessionSource"},
        {"name": "sessionMedium"}
    ],
    "metricHeaders": [
        {"name": "sessions", "type": "TYPE_INTEGER"},
        {"name": "bounceRate", "type": "TYPE_FLOAT"}
    ],
    "rows": [
        {
            "dimensionValues": [
                {"value": "google"},
                {"value": "organic"}
            ],
            "metricValues": [
                {"value": "1250"},
                {"value": "0.45"}
            ]
        }
    ],
    "rowCount": 1,
    "metadata": {...}
}
```

## Best Practices

### Performance
- Request only needed metrics and dimensions
- Use date ranges that balance detail and performance
- Limit results with `limit` parameter (max 100,000)
- Use pagination for large datasets

### Accuracy
- Allow 24-48 hours for data processing
- Use `yesterday` instead of `today` for complete data
- Be aware of sampling in large datasets
- Check `metadata.samplingMetadatas` in responses

### Analysis
- Compare periods for context (week-over-week, month-over-month)
- Segment by meaningful dimensions (device, source, location)
- Focus on engagement metrics, not just volume
- Track trends over time, not just snapshots

## Common Calculations

### Conversion Rate
```
conversion_rate = (conversions / sessions) * 100
```

### Average Order Value
```
aov = purchaseRevenue / transactions
```

### Pages per Session
```
pages_per_session = screenPageViews / sessions
```

### Engagement Rate
```
engagement_rate = (engagedSessions / sessions) * 100
```

### Revenue per User
```
rpu = totalRevenue / activeUsers
```

## Resources

- [GA4 Dimensions & Metrics Explorer](https://ga-dev-tools.google/ga4/dimensions-metrics-explorer/)
- [GA4 API Reference](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [GA4 Query Explorer](https://ga-dev-tools.google/ga4/query-explorer/)
