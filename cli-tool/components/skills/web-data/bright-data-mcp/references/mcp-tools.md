# Bright Data MCP Tools Reference

Complete reference for all Bright Data MCP server tools, organized by mode and category.

## Rapid (Free) Tools

Available by default, no special configuration needed.

### search_engine
Scrape search results from Google, Bing, or Yandex. Returns SERP results in JSON for Google and Markdown for Bing/Yandex. Supports pagination with the `cursor` parameter.

### scrape_as_markdown
Scrape a single webpage with advanced extraction and return Markdown. Uses Bright Data's unlocker to handle bot protection and CAPTCHA.

### search_engine_batch
Run up to 10 search queries in parallel. Returns JSON for Google results and Markdown for Bing/Yandex. Requires `advanced_scraping` group or Pro mode.

### scrape_batch
Scrape up to 10 webpages in one request and return an array of URL/content pairs in Markdown format. Requires `advanced_scraping` group or Pro mode.

---

## Pro Tools by Group

### Advanced Scraping Group (`advanced_scraping`)

| Tool | Description |
|------|-------------|
| `scrape_as_html` | Scrape a webpage and return raw HTML. Handles bot detection and CAPTCHA. |
| `extract` | Scrape a webpage as Markdown, then convert to structured JSON using AI. Accepts optional custom extraction prompt. |
| `session_stats` | Report how many times each tool has been called during the current MCP session. |
| `search_engine_batch` | Run up to 10 search queries in parallel. |
| `scrape_batch` | Scrape up to 10 webpages in one request. |

### E-Commerce Group (`ecommerce`)

| Tool | URL Requirement | Description |
|------|-----------------|-------------|
| `web_data_amazon_product` | Must contain `/dp/` | Structured Amazon product data (title, price, rating, images, etc.) |
| `web_data_amazon_product_reviews` | Must contain `/dp/` | Structured Amazon review data |
| `web_data_amazon_product_search` | Requires keyword + Amazon domain URL | Structured search results (first page only) |
| `web_data_walmart_product` | Must contain `/ip/` | Structured Walmart product data |
| `web_data_walmart_seller` | Valid Walmart seller URL | Structured seller data |
| `web_data_ebay_product` | Valid eBay product URL | Structured eBay listing data |
| `web_data_homedepot_products` | Valid homedepot.com URL | Structured Home Depot data |
| `web_data_zara_products` | Valid Zara product URL | Structured Zara data |
| `web_data_etsy_products` | Valid Etsy product URL | Structured Etsy data |
| `web_data_bestbuy_products` | Valid Best Buy product URL | Structured Best Buy data |
| `web_data_google_shopping` | Valid Google Shopping URL | Structured Google Shopping data |

### Social Media Group (`social`)

| Tool | URL Requirement | Description |
|------|-----------------|-------------|
| `web_data_linkedin_person_profile` | Valid LinkedIn profile URL | Profile data (experience, skills, education) |
| `web_data_linkedin_company_profile` | Valid LinkedIn company URL | Company profile data |
| `web_data_linkedin_job_listings` | Valid LinkedIn jobs URL | Job listing details |
| `web_data_linkedin_posts` | Valid LinkedIn post URL | Post content and engagement |
| `web_data_linkedin_people_search` | LinkedIn people search URL | People search results |
| `web_data_instagram_profiles` | Valid Instagram profile URL | Bio, followers, following |
| `web_data_instagram_posts` | Valid Instagram post URL | Post details, likes, captions |
| `web_data_instagram_reels` | Valid Instagram reel URL | Reel data and metrics |
| `web_data_instagram_comments` | Valid Instagram URL | Post comments |
| `web_data_facebook_posts` | Valid Facebook post URL | Post content and reactions |
| `web_data_facebook_marketplace_listings` | Valid Marketplace listing URL | Listing details |
| `web_data_facebook_company_reviews` | Valid Facebook company URL (+ optional review count) | Company reviews |
| `web_data_facebook_events` | Valid Facebook event URL | Event details |
| `web_data_tiktok_profiles` | Valid TikTok profile URL | Creator profile data |
| `web_data_tiktok_posts` | Valid TikTok post URL | Video details and metrics |
| `web_data_tiktok_shop` | Valid TikTok Shop product URL | Product data |
| `web_data_tiktok_comments` | Valid TikTok video URL | Video comments |
| `web_data_x_posts` | Valid X (Twitter) post URL | Tweet data |
| `web_data_youtube_videos` | Valid YouTube video URL | Video metadata |
| `web_data_youtube_profiles` | Valid YouTube channel URL | Channel profile data |
| `web_data_youtube_comments` | Valid YouTube video URL (+ optional num_of_comments, default 10) | Video comments |
| `web_data_reddit_posts` | Valid Reddit post URL | Post and comment data |

### Business Intelligence Group (`business`)

| Tool | URL Requirement | Description |
|------|-----------------|-------------|
| `web_data_crunchbase_company` | Valid Crunchbase company URL | Company funding, employees, rounds |
| `web_data_zoominfo_company_profile` | Valid ZoomInfo company URL | Company profile data |
| `web_data_google_maps_reviews` | Valid Google Maps URL (+ optional days_limit, default 3) | Business reviews |
| `web_data_zillow_properties_listing` | Valid Zillow listing URL | Property listing data |

### Finance Group (`finance`)

| Tool | URL Requirement | Description |
|------|-----------------|-------------|
| `web_data_yahoo_finance_business` | Valid Yahoo Finance business URL | Company profile and stock data |

### Research Group (`research`)

| Tool | URL Requirement | Description |
|------|-----------------|-------------|
| `web_data_reuter_news` | Valid Reuters news article URL | Structured news data |
| `web_data_github_repository_file` | Valid GitHub file URL | Repository file data |

### App Stores Group (`app_stores`)

| Tool | URL Requirement | Description |
|------|-----------------|-------------|
| `web_data_google_play_store` | Valid Play Store app URL | App data and reviews |
| `web_data_apple_app_store` | Valid App Store app URL | App data and reviews |

### Travel Group (`travel`)

| Tool | URL Requirement | Description |
|------|-----------------|-------------|
| `web_data_booking_hotel_listings` | Valid Booking.com listing URL | Hotel listing data |

### Browser Automation Group (`browser`)

Use these tools in sequence for interactive web automation.

| Tool | Description |
|------|-------------|
| `scraping_browser_navigate` | Open or reuse a session, navigate to URL. Resets tracked network requests. |
| `scraping_browser_go_back` | Navigate back to the previous page. |
| `scraping_browser_go_forward` | Navigate forward to the next page. |
| `scraping_browser_snapshot` | Capture ARIA snapshot listing interactive elements with refs. |
| `scraping_browser_click_ref` | Click an element by its ref from the ARIA snapshot. Requires ref + human-readable description. |
| `scraping_browser_type_ref` | Fill an input element by ref. Optionally press Enter after typing. |
| `scraping_browser_screenshot` | Capture screenshot. Supports optional `full_page` mode. |
| `scraping_browser_network_requests` | List network requests since page load (method, URL, status). |
| `scraping_browser_wait_for_ref` | Wait until an element becomes visible (optional timeout in ms). |
| `scraping_browser_get_text` | Return the text content of the page body. |
| `scraping_browser_get_html` | Return page HTML. Avoid `full_page` unless head/script tags are needed. |
| `scraping_browser_scroll` | Scroll to the bottom of the page. |
| `scraping_browser_scroll_to_ref` | Scroll until a specific element (by ARIA ref) is in view. |

#### Browser Automation Best Practices

1. Always start with `scraping_browser_navigate` to open the target URL
2. Use `scraping_browser_snapshot` to discover interactive elements before clicking/typing
3. Use refs from the snapshot (not selectors) for all interactions
4. After interactions, take a new `scraping_browser_snapshot` to see updated state
5. Use `scraping_browser_screenshot` to visually verify state when debugging
6. Use `scraping_browser_wait_for_ref` before interacting with elements that load dynamically
7. Extract final content with `scraping_browser_get_text` or `scraping_browser_get_html`

---

## Available Groups Summary

| Group | Description | Key Tools |
|-------|-------------|-----------|
| `ecommerce` | E-commerce platforms | Amazon, Walmart, eBay, Best Buy, Etsy, etc. |
| `social` | Social media & professional | LinkedIn, Instagram, Facebook, TikTok, YouTube, X, Reddit |
| `business` | Business intelligence | Crunchbase, ZoomInfo, Google Maps, Zillow |
| `finance` | Financial data | Yahoo Finance |
| `research` | Research & news | Reuters, GitHub |
| `app_stores` | App stores | Google Play, Apple App Store |
| `travel` | Travel platforms | Booking.com |
| `browser` | Browser automation | Navigate, click, type, screenshot, extract |
| `advanced_scraping` | Advanced extraction | HTML scraping, AI extraction, batch operations |
