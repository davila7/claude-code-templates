#!/bin/bash
# Bright Data - Dataset Wrapper
# Provides easy access to all supported datasets

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATASET_TYPE="$1"
shift

declare -A DATASETS=(
    ["amazon_product"]="gd_l7q7dkf244hwjntr0"
    ["amazon_product_reviews"]="gd_le8e811kzy4ggddlq"
    ["amazon_product_search"]="gd_lwdb4vjm1ehb499uxs"
    ["walmart_product"]="gd_l95fol7l1ru6rlo116"
    ["walmart_seller"]="gd_m7ke48w81ocyu4hhz0"
    ["ebay_product"]="gd_ltr9mjt81n0zzdk1fb"
    ["homedepot_products"]="gd_lmusivh019i7g97q2n"
    ["zara_products"]="gd_lct4vafw1tgx27d4o0"
    ["etsy_products"]="gd_ltppk0jdv1jqz25mz"
    ["bestbuy_products"]="gd_ltre1jqe1jfr7cccf"
    ["linkedin_person_profile"]="gd_l1viktl72bvl7bjuj0"
    ["linkedin_company_profile"]="gd_l1vikfnt1wgvvqz95w"
    ["linkedin_job_listings"]="gd_lpfll7v5hcqtkxl6l"
    ["linkedin_posts"]="gd_lyy3tktm25m4avu764"
    ["linkedin_people_search"]="gd_m8d03he47z8nwb5xc"
    ["crunchbase_company"]="gd_l1vijqt9jfj7olije"
    ["zoominfo_company_profile"]="gd_m0ci4a4ivx3j5l6nx"
    ["instagram_profiles"]="gd_l1vikfch901nx3by4"
    ["instagram_posts"]="gd_lk5ns7kz21pck8jpis"
    ["instagram_reels"]="gd_lyclm20il4r5helnj"
    ["instagram_comments"]="gd_ltppn085pokosxh13"
    ["facebook_posts"]="gd_lyclm1571iy3mv57zw"
    ["facebook_marketplace_listings"]="gd_lvt9iwuh6fbcwmx1a"
    ["facebook_company_reviews"]="gd_m0dtqpiu1mbcyc2g86"
    ["facebook_events"]="gd_m14sd0to1jz48ppm51"
    ["tiktok_profiles"]="gd_l1villgoiiidt09ci"
    ["tiktok_posts"]="gd_lu702nij2f790tmv9h"
    ["tiktok_shop"]="gd_m45m1u911dsa4274pi"
    ["tiktok_comments"]="gd_lkf2st302ap89utw5k"
    ["x_posts"]="gd_lwxkxvnf1cynvib9co"
    ["youtube_profiles"]="gd_lk538t2k2p1k3oos71"
    ["youtube_videos"]="gd_lk56epmy2i5g7lzu0k"
    ["youtube_comments"]="gd_lk9q0ew71spt1mxywf"
    ["reddit_posts"]="gd_lvz8ah06191smkebj4"
    ["google_maps_reviews"]="gd_luzfs1dn2oa0teb81"
    ["google_shopping"]="gd_ltppk50q18kdw67omz"
    ["google_play_store"]="gd_lsk382l8xei8vzm4u"
    ["apple_app_store"]="gd_lsk9ki3u2iishmwrui"
    ["reuter_news"]="gd_lyptx9h74wtlvpnfu"
    ["github_repository_file"]="gd_lyrexgxc24b3d4imjt"
    ["yahoo_finance_business"]="gd_lmrpz3vxmz972ghd7"
    ["zillow_properties_listing"]="gd_lfqkr8wm13ixtbd8f5"
    ["booking_hotel_listings"]="gd_m5mbdl081229ln6t4a"
)

if [ -z "$DATASET_TYPE" ]; then
    echo "Usage: $0 <dataset_type> <url> [additional_params...]" >&2
    echo "" >&2
    echo "Available datasets:" >&2
    echo "" >&2
    echo "E-COMMERCE:" >&2
    echo "  amazon_product <url>              - Amazon product data" >&2
    echo "  amazon_product_reviews <url>      - Amazon product reviews" >&2
    echo "  amazon_product_search <keyword> <domain_url> - Amazon search" >&2
    echo "  walmart_product <url>             - Walmart product data" >&2
    echo "  walmart_seller <url>              - Walmart seller data" >&2
    echo "  ebay_product <url>                - eBay product data" >&2
    echo "  homedepot_products <url>          - Home Depot product data" >&2
    echo "  zara_products <url>               - Zara product data" >&2
    echo "  etsy_products <url>               - Etsy product data" >&2
    echo "  bestbuy_products <url>            - Best Buy product data" >&2
    echo "" >&2
    echo "PROFESSIONAL NETWORKS:" >&2
    echo "  linkedin_person_profile <url>     - LinkedIn person profile" >&2
    echo "  linkedin_company_profile <url>    - LinkedIn company profile" >&2
    echo "  linkedin_job_listings <url>       - LinkedIn job listings" >&2
    echo "  linkedin_posts <url>              - LinkedIn posts" >&2
    echo "  linkedin_people_search <url> <first_name> <last_name> - LinkedIn people search" >&2
    echo "  crunchbase_company <url>          - Crunchbase company data" >&2
    echo "  zoominfo_company_profile <url>    - ZoomInfo company profile" >&2
    echo "" >&2
    echo "SOCIAL MEDIA - INSTAGRAM:" >&2
    echo "  instagram_profiles <url>          - Instagram profile data" >&2
    echo "  instagram_posts <url>             - Instagram post data" >&2
    echo "  instagram_reels <url>             - Instagram reel data" >&2
    echo "  instagram_comments <url>          - Instagram comments" >&2
    echo "" >&2
    echo "SOCIAL MEDIA - FACEBOOK:" >&2
    echo "  facebook_posts <url>              - Facebook post data" >&2
    echo "  facebook_marketplace_listings <url> - Facebook marketplace" >&2
    echo "  facebook_company_reviews <url> <num_reviews> - Company reviews" >&2
    echo "  facebook_events <url>             - Facebook events" >&2
    echo "" >&2
    echo "SOCIAL MEDIA - TIKTOK:" >&2
    echo "  tiktok_profiles <url>             - TikTok profile data" >&2
    echo "  tiktok_posts <url>                - TikTok post data" >&2
    echo "  tiktok_shop <url>                 - TikTok shop product" >&2
    echo "  tiktok_comments <url>             - TikTok video comments" >&2
    echo "" >&2
    echo "SOCIAL MEDIA - OTHER:" >&2
    echo "  x_posts <url>                     - X (Twitter) post data" >&2
    echo "  youtube_profiles <url>            - YouTube channel data" >&2
    echo "  youtube_videos <url>              - YouTube video data" >&2
    echo "  youtube_comments <url> [num]      - YouTube comments (default: 10)" >&2
    echo "  reddit_posts <url>                - Reddit post data" >&2
    echo "" >&2
    echo "GOOGLE SERVICES:" >&2
    echo "  google_maps_reviews <url> [days]  - Google Maps reviews (default: 3 days)" >&2
    echo "  google_shopping <url>             - Google Shopping product" >&2
    echo "  google_play_store <url>           - Google Play Store app" >&2
    echo "" >&2
    echo "OTHER:" >&2
    echo "  apple_app_store <url>             - Apple App Store app" >&2
    echo "  reuter_news <url>                 - Reuters news article" >&2
    echo "  github_repository_file <url>      - GitHub repository file" >&2
    echo "  yahoo_finance_business <url>      - Yahoo Finance business" >&2
    echo "  zillow_properties_listing <url>   - Zillow property listing" >&2
    echo "  booking_hotel_listings <url>      - Booking.com hotel" >&2
    exit 1
fi

# Get dataset ID
DATASET_ID="${DATASETS[$DATASET_TYPE]}"

if [ -z "$DATASET_ID" ]; then
    echo "Error: Unknown dataset type '$DATASET_TYPE'" >&2
    echo "Run '$0' without arguments to see available datasets" >&2
    exit 1
fi

case "$DATASET_TYPE" in
    amazon_product_search)
        KEYWORD="$1"
        DOMAIN_URL="$2"
        if [ -z "$KEYWORD" ] || [ -z "$DOMAIN_URL" ]; then
            echo "Usage: $0 amazon_product_search <keyword> <domain_url>" >&2
            exit 1
        fi
        INPUT_JSON=$(jq -n --arg keyword "$KEYWORD" --arg url "$DOMAIN_URL" \
            '{keyword: $keyword, url: $url, pages_to_search: "1"}')
        ;;
    linkedin_people_search)
        URL="$1"
        FIRST_NAME="$2"
        LAST_NAME="$3"
        if [ -z "$URL" ] || [ -z "$FIRST_NAME" ] || [ -z "$LAST_NAME" ]; then
            echo "Usage: $0 linkedin_people_search <url> <first_name> <last_name>" >&2
            exit 1
        fi
        INPUT_JSON=$(jq -n --arg url "$URL" --arg first "$FIRST_NAME" --arg last "$LAST_NAME" \
            '{url: $url, first_name: $first, last_name: $last}')
        ;;
    facebook_company_reviews)
        URL="$1"
        NUM_REVIEWS="${2:-10}"
        if [ -z "$URL" ]; then
            echo "Usage: $0 facebook_company_reviews <url> [num_reviews]" >&2
            exit 1
        fi
        INPUT_JSON=$(jq -n --arg url "$URL" --arg num "$NUM_REVIEWS" \
            '{url: $url, num_of_reviews: $num}')
        ;;
    google_maps_reviews)
        URL="$1"
        DAYS_LIMIT="${2:-3}"
        if [ -z "$URL" ]; then
            echo "Usage: $0 google_maps_reviews <url> [days_limit]" >&2
            exit 1
        fi
        INPUT_JSON=$(jq -n --arg url "$URL" --arg days "$DAYS_LIMIT" \
            '{url: $url, days_limit: $days}')
        ;;
    youtube_comments)
        URL="$1"
        NUM_COMMENTS="${2:-10}"
        if [ -z "$URL" ]; then
            echo "Usage: $0 youtube_comments <url> [num_comments]" >&2
            exit 1
        fi
        INPUT_JSON=$(jq -n --arg url "$URL" --arg num "$NUM_COMMENTS" \
            '{url: $url, num_of_comments: $num}')
        ;;
    *)
        # Default: just URL input
        URL="$1"
        if [ -z "$URL" ]; then
            echo "Usage: $0 $DATASET_TYPE <url>" >&2
            exit 1
        fi
        INPUT_JSON=$(jq -n --arg url "$URL" '{url: $url}')
        ;;
esac

# Call the fetch script
exec "$SCRIPT_DIR/fetch.sh" "$DATASET_ID" "$INPUT_JSON"
