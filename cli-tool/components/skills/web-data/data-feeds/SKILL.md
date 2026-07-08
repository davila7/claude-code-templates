---
name: data-feeds
description: Extract structured data from 40+ websites including Amazon, LinkedIn, Instagram, TikTok, Facebook, YouTube, and more. Uses Bright Data's Web Data APIs with automatic polling. Returns clean JSON with product details, profiles, reviews, posts, and comments.
---

# Bright Data - Structured Data Feeds

Extract structured data from major websites with automatic parsing. No scraping logic needed - just provide a URL and get clean JSON data.

## Setup

### Environment Variables (Required)
```bash
export BRIGHTDATA_API_KEY="your-api-key"
```

### Optional
```bash
export BRIGHTDATA_POLLING_TIMEOUT=600  # Max seconds to wait (default: 600)
```

Get your API key from [Bright Data Dashboard](https://brightdata.com/cp).

## Usage

```bash
bash scripts/datasets.sh <dataset_type> <url> [additional_params...]
```

## Available Datasets

### E-Commerce

| Dataset | Command | Description |
|---------|---------|-------------|
| Amazon Product | `datasets.sh amazon_product <url>` | Product details, pricing, ratings |
| Amazon Reviews | `datasets.sh amazon_product_reviews <url>` | Customer reviews for a product |
| Amazon Search | `datasets.sh amazon_product_search <keyword> <domain_url>` | Search results |
| Walmart Product | `datasets.sh walmart_product <url>` | Product details from Walmart |
| Walmart Seller | `datasets.sh walmart_seller <url>` | Seller information |
| eBay Product | `datasets.sh ebay_product <url>` | eBay listing details |
| Home Depot | `datasets.sh homedepot_products <url>` | Home Depot product data |
| Zara | `datasets.sh zara_products <url>` | Zara product details |
| Etsy | `datasets.sh etsy_products <url>` | Etsy listing data |
| Best Buy | `datasets.sh bestbuy_products <url>` | Best Buy product info |

### Professional Networks

| Dataset | Command | Description |
|---------|---------|-------------|
| LinkedIn Person | `datasets.sh linkedin_person_profile <url>` | Profile data (experience, skills) |
| LinkedIn Company | `datasets.sh linkedin_company_profile <url>` | Company page data |
| LinkedIn Jobs | `datasets.sh linkedin_job_listings <url>` | Job posting details |
| LinkedIn Posts | `datasets.sh linkedin_posts <url>` | Post content and engagement |
| LinkedIn Search | `datasets.sh linkedin_people_search <url> <first> <last>` | Find people |
| Crunchbase | `datasets.sh crunchbase_company <url>` | Company funding, employees |
| ZoomInfo | `datasets.sh zoominfo_company_profile <url>` | Company profile data |

### Instagram

| Dataset | Command | Description |
|---------|---------|-------------|
| Profiles | `datasets.sh instagram_profiles <url>` | Bio, followers, following |
| Posts | `datasets.sh instagram_posts <url>` | Post details, likes, captions |
| Reels | `datasets.sh instagram_reels <url>` | Reel data and metrics |
| Comments | `datasets.sh instagram_comments <url>` | Post comments |

### Facebook

| Dataset | Command | Description |
|---------|---------|-------------|
| Posts | `datasets.sh facebook_posts <url>` | Post content and reactions |
| Marketplace | `datasets.sh facebook_marketplace_listings <url>` | Listing details |
| Reviews | `datasets.sh facebook_company_reviews <url> [num]` | Company reviews |
| Events | `datasets.sh facebook_events <url>` | Event details |

### TikTok

| Dataset | Command | Description |
|---------|---------|-------------|
| Profiles | `datasets.sh tiktok_profiles <url>` | Creator profile data |
| Posts | `datasets.sh tiktok_posts <url>` | Video details and metrics |
| Shop | `datasets.sh tiktok_shop <url>` | TikTok Shop product data |
| Comments | `datasets.sh tiktok_comments <url>` | Video comments |

### YouTube

| Dataset | Command | Description |
|---------|---------|-------------|
| Profiles | `datasets.sh youtube_profiles <url>` | Channel data |
| Videos | `datasets.sh youtube_videos <url>` | Video details and stats |
| Comments | `datasets.sh youtube_comments <url> [num]` | Video comments (default: 10) |

### Other Social

| Dataset | Command | Description |
|---------|---------|-------------|
| X (Twitter) | `datasets.sh x_posts <url>` | Tweet data |
| Reddit | `datasets.sh reddit_posts <url>` | Post and comment data |

### Google Services

| Dataset | Command | Description |
|---------|---------|-------------|
| Maps Reviews | `datasets.sh google_maps_reviews <url> [days]` | Business reviews (default: 3 days) |
| Shopping | `datasets.sh google_shopping <url>` | Product comparison data |
| Play Store | `datasets.sh google_play_store <url>` | App details and reviews |

### Other

| Dataset | Command | Description |
|---------|---------|-------------|
| Apple App Store | `datasets.sh apple_app_store <url>` | iOS app data |
| Reuters News | `datasets.sh reuter_news <url>` | News article content |
| GitHub | `datasets.sh github_repository_file <url>` | Repository file data |
| Yahoo Finance | `datasets.sh yahoo_finance_business <url>` | Stock and company data |
| Zillow | `datasets.sh zillow_properties_listing <url>` | Property listing details |
| Booking.com | `datasets.sh booking_hotel_listings <url>` | Hotel listing data |

## Examples

### Get LinkedIn Profile
```bash
bash scripts/datasets.sh linkedin_person_profile "https://www.linkedin.com/in/satyanadella/"
```

### Get Amazon Product
```bash
bash scripts/datasets.sh amazon_product "https://www.amazon.com/dp/B09V3KXJPB"
```

### Get Instagram Profile
```bash
bash scripts/datasets.sh instagram_profiles "https://www.instagram.com/natgeo/"
```

### Get YouTube Comments
```bash
bash scripts/datasets.sh youtube_comments "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 20
```

### Search Amazon
```bash
bash scripts/datasets.sh amazon_product_search "wireless headphones" "https://www.amazon.com"
```

## Output Format

Returns structured JSON with website-specific fields. Example for LinkedIn profile:

```json
{
  "name": "Satya Nadella",
  "headline": "Chairman and CEO at Microsoft",
  "location": "Greater Seattle Area",
  "connections": "500+",
  "experience": [...],
  "education": [...],
  "skills": [...]
}
```

## How It Works

1. **Trigger**: Sends URL to Bright Data's Web Data API
2. **Poll**: Waits for data collection to complete (checks every second)
3. **Return**: Outputs structured JSON when ready

The polling mechanism handles rate limits and ensures data quality by waiting for full extraction.

## Advanced: Direct Fetch

For custom dataset IDs or advanced use cases:

```bash
bash scripts/fetch.sh <dataset_id> '<json_input>'
```

Example:
```bash
bash scripts/fetch.sh gd_l1viktl72bvl7bjuj0 '{"url":"https://linkedin.com/in/someone"}'
```
