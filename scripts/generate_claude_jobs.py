import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv
import time
import re

# Load environment variables
load_dotenv()

def scrape_with_rapidapi_jobs():
    """
    Use RapidAPI Jobs Search to find Claude-related positions
    """
    jobs = []
    try:
        print("🔍 Searching with RapidAPI Jobs API for Claude positions...")
        
        rapidapi_key = os.getenv("RAPIDAPI_KEY")
        if not rapidapi_key:
            print("⚠️ Warning: No RapidAPI key found, skipping")
            return jobs
        
        url = "https://jobs-search-realtime-data-api.p.rapidapi.com/jobs/search"
        
        # Search for Claude-specific terms
        search_queries = [
            "Claude Code",
            "Anthropic Claude", 
            "Claude AI developer",
            "Claude assistant engineer"
        ]
        
        headers = {
            "x-rapidapi-key": rapidapi_key,
            "x-rapidapi-host": "jobs-search-realtime-data-api.p.rapidapi.com"
        }
        
        for query in search_queries:
            querystring = {
                "query": query,
                "location": "Remote",
                "num_results": "20"
            }
            
            response = requests.get(url, headers=headers, params=querystring)
            
            if response.status_code == 200:
                data = response.json()
                job_results = data.get('jobs', [])
                
                for job_data in job_results:
                    # Extract job information
                    job = {
                        'company': job_data.get('company_name', 'Unknown'),
                        'company_icon': job_data.get('company_logo', get_company_icon(job_data.get('company_name', ''))),
                        'location': job_data.get('location', 'Remote'),
                        'description': truncate_description(job_data.get('description', job_data.get('title', ''))),
                        'job_link': job_data.get('url', ''),
                        'source': 'RapidAPI Jobs',
                        'date_posted': job_data.get('date_posted', ''),
                        'salary': extract_salary_from_text(job_data.get('description', ''))
                    }
                    
                    # Validate it actually mentions Claude
                    full_text = f"{job_data.get('title', '')} {job_data.get('description', '')}"
                    if is_claude_code_related(full_text):
                        jobs.append(job)
            
            time.sleep(1)  # Rate limiting
        
        print(f"✅ Found {len(jobs)} jobs from RapidAPI")
        
    except Exception as e:
        print(f"⚠️ Error with RapidAPI: {e}")
    
    return jobs

def scrape_with_serper_jobs():
    """
    Use Google Serper API to find Claude positions
    """
    jobs = []
    try:
        print("🔍 Searching with Google Serper API for Claude positions...")
        
        serper_key = os.getenv("SERPER_API_KEY")
        if not serper_key:
            print("⚠️ Warning: No Serper API key found, skipping")
            return jobs
        
        print(f"  🔑 Using Serper key: {serper_key[:8]}...{serper_key[-4:]}")
        
        import http.client
        
        search_queries = [
            "Claude Code developer jobs",
            "Anthropic Claude engineer hiring", 
            "Claude AI programming job",
            "Claude assistant developer position",
            "Anthropic engineer jobs",
            "Claude developer careers"
        ]
        
        conn = http.client.HTTPSConnection("google.serper.dev")
        
        for query in search_queries:
            print(f"  🔍 Searching: '{query}'")
            
            payload = json.dumps({
                "q": f"{query} site:linkedin.com OR site:indeed.com OR site:glassdoor.com OR site:jobs.anthropic.com",
                "type": "search",
                "num": 20
            })
            
            headers = {
                'X-API-KEY': serper_key,
                'Content-Type': 'application/json'
            }
            
            conn.request("POST", "/search", payload, headers)
            res = conn.getresponse()
            data_raw = res.read()
            
            if res.status == 200:
                try:
                    data = json.loads(data_raw.decode("utf-8"))
                    search_results = data.get('organic', [])
                    print(f"    Found {len(search_results)} search results")
                    
                    for result in search_results:
                        title = result.get('title', '')
                        snippet = result.get('snippet', '')
                        link = result.get('link', '')
                        
                        # Check if this looks like a job posting
                        full_text = f"{title} {snippet}"
                        if is_claude_code_related(full_text) and is_job_posting(full_text):
                            
                            # Extract better job information
                            job_info = extract_job_info_from_serper(title, snippet, link)
                            
                            if job_info:  # Only add if we could extract meaningful info
                                jobs.append(job_info)
                            
                except json.JSONDecodeError as e:
                    print(f"    ❌ JSON decode error: {e}")
            else:
                print(f"    ❌ Error {res.status}: {data_raw.decode('utf-8')[:200]}...")
            
            time.sleep(1)  # Rate limiting
        
        conn.close()
        print(f"✅ Found {len(jobs)} jobs from Google Serper")
        
    except Exception as e:
        print(f"⚠️ Error with Google Serper API: {e}")
    
    return jobs

def is_job_posting(text):
    """Check if text looks like a job posting"""
    job_indicators = [
        'hiring', 'job', 'position', 'career', 'apply', 'join',
        'engineer', 'developer', 'programmer', 'architect',
        'we are looking', 'seeking', 'opportunity', 'role'
    ]
    text_lower = text.lower()
    return any(indicator in text_lower for indicator in job_indicators)

def extract_job_info_from_serper(title, snippet, link):
    """Extract clean job information from Serper search result"""
    
    # Skip generic search results
    if any(skip in title.lower() for skip in ['jobs, employment', 'jobs available', 'browse', 'discover']):
        return None
    
    # Extract company name
    company = extract_company_name_improved(title, snippet, link)
    
    # Extract job title
    job_title = extract_job_title(title, snippet)
    
    # Extract location
    location = extract_location_improved(title, snippet)
    
    # Only return if we have meaningful data
    if not job_title or len(job_title) < 5:
        return None
    
    return {
        'company': company,
        'company_icon': get_company_icon(company),
        'job_title': job_title,
        'location': location,
        'description': truncate_description(snippet),
        'job_link': link,
        'source': 'Google Serper',
        'date_posted': '',
        'salary': extract_salary_from_text(snippet)
    }

def extract_company_name_improved(title, snippet, link):
    """Improved company name extraction"""
    
    # Priority: Check for Anthropic first (most common)
    if 'anthropic' in (title + snippet + link).lower():
        return 'Anthropic'
    
    # LinkedIn specific extraction
    if 'linkedin.com/jobs/view/' in link:
        # Extract from URL - LinkedIn URLs often contain company info
        # Format: linkedin.com/jobs/view/job-title-at-company-name-jobid
        url_parts = link.split('-at-')
        if len(url_parts) > 1:
            company_part = url_parts[1].split('-')[0]  # Get first part after -at-
            if company_part and len(company_part) > 2:
                return company_part.replace('-', ' ').title()
        
        # Extract from title patterns like "Job Title at Company Name"
        at_match = re.search(r'\s+at\s+([^-\d]+)', title)
        if at_match:
            company = at_match.group(1).strip()
            # Clean up common LinkedIn patterns
            company = re.sub(r'\s*\d+$', '', company)  # Remove trailing numbers
            company = re.sub(r'\s+\d+$', '', company)  # Remove numbers at end
            if len(company) > 2 and company.lower() not in ['view', 'join', 'apply']:
                return company
    
    # Extract from title patterns
    hiring_patterns = [
        r'([A-Z][a-zA-Z\s&.]+)\s+hiring\s+',
        r'^([A-Z][a-zA-Z\s&.]+):\s+',
        r'Join\s+([A-Z][a-zA-Z\s&.]+)',
        r'([A-Z][a-zA-Z\s&.]+)\s+is\s+looking',
        r'([A-Z][a-zA-Z\s&.]+)\s+seeks?',
    ]
    
    for pattern in hiring_patterns:
        match = re.search(pattern, title)
        if match:
            company = match.group(1).strip()
            if len(company) > 2 and company not in ['View', 'Join', 'Apply', 'Software', 'Senior']:
                return company
    
    # Extract from snippet
    snippet_patterns = [
        r'Jobs at ([A-Z][a-zA-Z\s&.]+)',
        r'([A-Z][a-zA-Z\s&.]+) is hiring',
        r'Work at ([A-Z][a-zA-Z\s&.]+)',
        r'Join ([A-Z][a-zA-Z\s&.]+)',
    ]
    
    for pattern in snippet_patterns:
        match = re.search(pattern, snippet)
        if match:
            company = match.group(1).strip()
            if len(company) > 2:
                return company
    
    # Check if it's a well-known company based on domain or context
    known_companies = {
        'google': 'Google',
        'microsoft': 'Microsoft', 
        'meta': 'Meta',
        'apple': 'Apple',
        'amazon': 'Amazon',
        'openai': 'OpenAI',
        'github': 'GitHub',
        'stripe': 'Stripe',
        'shopify': 'Shopify'
    }
    
    text_lower = (title + snippet + link).lower()
    for keyword, company_name in known_companies.items():
        if keyword in text_lower:
            return company_name
    
    return 'Unknown Company'

def extract_job_title(title, snippet):
    """Extract job title from search result"""
    
    # LinkedIn format: "Job Title at Company"
    at_match = re.search(r'^(.+?)\s+at\s+', title)
    if at_match:
        return at_match.group(1).strip()
    
    # Anthropic hiring format: "Anthropic hiring Job Title in Location"
    hiring_match = re.search(r'hiring\s+(.+?)\s+in\s+', title)
    if hiring_match:
        return hiring_match.group(1).strip()
    
    # Company: Job Title format
    colon_match = re.search(r':\s+(.+?)\s+-', title)
    if colon_match:
        return colon_match.group(1).strip()
    
    # Extract from title before dash
    dash_match = re.search(r'^(.+?)\s+-\s+', title)
    if dash_match:
        job_title = dash_match.group(1).strip()
        # Clean up common patterns
        job_title = re.sub(r'^(View|Apply to|Join)\s+', '', job_title)
        if len(job_title) > 5:
            return job_title
    
    # Fallback: use full title if it looks like a job title
    if any(keyword in title.lower() for keyword in ['engineer', 'developer', 'manager', 'analyst', 'scientist', 'architect']):
        return title.strip()
    
    return None

def extract_location_improved(title, snippet):
    """Improved location extraction"""
    text = f"{title} {snippet}"
    
    # Remote indicators
    if any(keyword in text.lower() for keyword in ['remote', 'anywhere', 'distributed', 'work from home']):
        return 'Remote'
    
    # City, State patterns
    city_state_patterns = [
        r'in\s+([A-Z][a-z]+,\s*[A-Z]{2})',  # "in Seattle, WA"
        r'([A-Z][a-z]+,\s*[A-Z]{2})\s+',    # "Seattle, WA "
        r'([San Francisco|New York|Los Angeles|Chicago|Boston|Austin|Denver],\s*[A-Z]{2})',
    ]
    
    for pattern in city_state_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    
    # Major cities without state
    major_cities = ['Seattle', 'Francisco', 'Chicago', 'Boston', 'Austin', 'Denver', 'Portland', 'Miami']
    for city in major_cities:
        if city in text:
            return f"{city}"
    
    return 'On-site'

def extract_salary_from_text(text):
    """Extract salary information from job description text"""
    if not text:
        return 0
    
    # Look for common salary patterns
    salary_patterns = [
        r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|thousand)',
        r'\$(\d{1,3}(?:,\d{3})*)',
        r'(\d{1,3})k',
    ]
    
    for pattern in salary_patterns:
        matches = re.findall(pattern, text.lower())
        if matches:
            try:
                salary = int(matches[0].replace(',', '').replace('.', ''))
                if 'k' in text.lower() or 'thousand' in text.lower():
                    salary *= 1000
                return salary
            except:
                continue
    
    return 0

def extract_salary_from_google_job(job_data):
    """Extract salary from Google Jobs specific structure"""
    salary_info = job_data.get('detected_extensions', {})
    
    # Look for salary in extensions
    if 'salary' in salary_info:
        salary_text = salary_info['salary']
        return extract_salary_from_text(salary_text)
    
    return 0

def scrape_github_jobs():
    """
    Scrape GitHub Jobs for Claude Code positions
    """
    jobs = []
    try:
        # GitHub Jobs API is deprecated, but we can search GitHub Issues/Discussions
        # or use GitHub's search API for job repositories
        print("🔍 Searching GitHub for Claude Code job postings...")
        
        # Search in common job posting repositories
        job_repos = [
            "remoteintech/remote-jobs",
            "lukasz-madon/awesome-remote-job", 
            "yanirs/established-remote"
        ]
        
        headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'claude-code-templates-job-scraper'
        }
        
        github_token = os.getenv("GITHUB_TOKEN")
        if github_token:
            headers['Authorization'] = f'token {github_token}'
        
        # Search ONLY for Claude-specific job postings
        search_url = "https://api.github.com/search/issues"
        search_params = {
            'q': '("claude code" OR "anthropic claude" OR "claude ai" OR "claude") AND (hiring OR job OR position OR engineer OR developer) NOT pull NOT merge NOT bug NOT feature',
            'sort': 'updated',
            'order': 'desc',
            'per_page': 50
        }
        
        response = requests.get(search_url, headers=headers, params=search_params)
        if response.status_code == 200:
            results = response.json()
            for item in results.get('items', []):
                job = extract_job_from_github_issue(item)
                if job:
                    jobs.append(job)
        
        print(f"✅ Found {len(jobs)} potential jobs from GitHub")
        
    except Exception as e:
        print(f"⚠️ Error scraping GitHub jobs: {e}")
    
    return jobs

def scrape_ycombinator_jobs():
    """
    Scrape YCombinator Who's Hiring threads for Claude Code mentions
    """
    jobs = []
    try:
        print("🔍 Searching YC Who's Hiring for Claude Code positions...")
        
        # Search HackerNews API for recent "Who is hiring" threads
        hn_search_url = "https://hn.algolia.com/api/v1/search"
        search_params = {
            'query': 'who is hiring',
            'tags': 'story',
            'hitsPerPage': 5,
            'numericFilters': f'created_at_i>{int(time.time()) - 86400*60}'  # Last 60 days
        }
        
        response = requests.get(hn_search_url, params=search_params)
        if response.status_code == 200:
            threads = response.json().get('hits', [])
            
            for thread in threads:
                story_id = thread.get('objectID')
                if story_id:
                    # Get comments from this hiring thread
                    comments_url = f"https://hn.algolia.com/api/v1/search"
                    comment_params = {
                        'query': 'claude code OR anthropic claude OR claude ai OR claude',
                        'tags': f'comment,story_{story_id}',
                        'hitsPerPage': 50
                    }
                    
                    comment_response = requests.get(comments_url, params=comment_params)
                    if comment_response.status_code == 200:
                        comments = comment_response.json().get('hits', [])
                        
                        for comment in comments:
                            job = extract_job_from_hn_comment(comment, thread.get('title', ''))
                            if job:
                                jobs.append(job)
                    
                    time.sleep(0.5)  # Rate limiting
        
        print(f"✅ Found {len(jobs)} jobs from YC Who's Hiring")
        
    except Exception as e:
        print(f"⚠️ Error scraping YC jobs: {e}")
    
    return jobs

def extract_job_from_hn_comment(comment, thread_title):
    """
    Extract job information from HackerNews comment
    """
    text = comment.get('comment_text', '') or ''
    
    if not is_claude_code_related(text):
        return None
    
    # Extract basic info from comment
    company = extract_company_from_hn_comment(text)
    location = extract_location_from_hn_comment(text)
    
    return {
        'company': company,
        'company_icon': get_company_icon(company),
        'location': location,
        'description': truncate_description(text.replace('<p>', ' ').replace('</p>', ' ')),
        'job_link': f"https://news.ycombinator.com/item?id={comment.get('objectID', '')}",
        'source': 'YCombinator',
        'date_posted': comment.get('created_at', ''),
        'salary': 0
    }

def extract_company_from_hn_comment(text):
    """Extract company name from HN comment"""
    patterns = [
        r'([A-Z][a-zA-Z]+)\s+is\s+hiring',
        r'We\s+are\s+([A-Z][a-zA-Z]+)',
        r'Join\s+([A-Z][a-zA-Z]+)',
        r'([A-Z][a-zA-Z]+)\s+\-\s+',
        r'Company:\s+([A-Z][a-zA-Z]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    
    return 'Startup'

def extract_location_from_hn_comment(text):
    """Extract location from HN comment"""
    if any(keyword in text.lower() for keyword in ['remote', 'anywhere', 'distributed']):
        return 'Remote'
    
    # Look for city patterns
    location_patterns = [
        r'Location:\s*([^.\n]+)',
        r'Based in ([^,\n]+)',
        r'([A-Z][a-z]+,\s*[A-Z]{2,3})',  # City, State/Country
    ]
    
    for pattern in location_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    
    return 'On-site'

def scrape_remote_ok():
    """
    Scrape Remote OK for Claude Code positions
    """
    jobs = []
    try:
        print("🔍 Searching Remote OK for Claude Code positions...")
        
        # Remote OK has an API but might be rate limited
        url = "https://remoteok.io/api"
        headers = {
            'User-Agent': 'claude-code-templates-job-scraper'
        }
        
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            for job_data in data[1:]:  # First item is metadata
                description = job_data.get('description', '')
                tags = job_data.get('tags', [])
                tags_str = ' '.join(tags) if isinstance(tags, list) else str(tags)
                
                if is_claude_code_related(description + ' ' + tags_str):
                    job = {
                        'company': job_data.get('company', 'Unknown'),
                        'company_icon': job_data.get('company_logo', ''),
                        'location': 'Remote' if job_data.get('location') == 'Worldwide' else job_data.get('location', 'Remote'),
                        'description': truncate_description(job_data.get('description', '')),
                        'job_link': f"https://remoteok.io/remote-jobs/{job_data.get('id', '')}",
                        'source': 'RemoteOK',
                        'date_posted': job_data.get('date', ''),
                        'salary': job_data.get('salary_min', 0)
                    }
                    jobs.append(job)
        
        print(f"✅ Found {len(jobs)} jobs from Remote OK")
        
    except Exception as e:
        print(f"⚠️ Error scraping Remote OK: {e}")
    
    return jobs

def scrape_weworkremotely():
    """
    Scrape We Work Remotely for Claude Code positions
    """
    jobs = []
    try:
        print("🔍 Searching We Work Remotely for Claude Code positions...")
        
        # We Work Remotely RSS feed approach
        import xml.etree.ElementTree as ET
        
        rss_url = "https://weworkremotely.com/categories/remote-programming-jobs.rss"
        headers = {
            'User-Agent': 'claude-code-templates-job-scraper'
        }
        
        response = requests.get(rss_url, headers=headers)
        if response.status_code == 200:
            root = ET.fromstring(response.content)
            
            for item in root.findall('.//item'):
                title = item.find('title').text if item.find('title') is not None else ''
                description = item.find('description').text if item.find('description') is not None else ''
                link = item.find('link').text if item.find('link') is not None else ''
                pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ''
                
                full_text = title + ' ' + description
                
                if is_claude_code_related(full_text):
                    # Extract company from title (usually format: "Company: Job Title")
                    company_match = re.match(r'^([^:]+):', title)
                    company = company_match.group(1).strip() if company_match else 'Remote Company'
                    
                    job = {
                        'company': company,
                        'company_icon': get_company_icon(company),
                        'location': 'Remote',  # WWR is all remote
                        'description': truncate_description(title),
                        'job_link': link,
                        'source': 'WeWorkRemotely',
                        'date_posted': pub_date,
                        'salary': 0
                    }
                    jobs.append(job)
        
        print(f"✅ Found {len(jobs)} jobs from We Work Remotely")
        
    except Exception as e:
        print(f"⚠️ Error scraping WWR: {e}")
    
    return jobs

def scrape_indie_hackers():
    """
    Scrape Indie Hackers for Claude Code positions
    """
    jobs = []
    try:
        print("🔍 Searching Indie Hackers for Claude Code positions...")
        
        # Use general web search for Indie Hackers job posts mentioning Claude Code
        search_terms = [
            'site:indiehackers.com "claude code" hiring',
            'site:indiehackers.com "anthropic claude" job',
            'site:indiehackers.com "claude ai" developer'
        ]
        
        # This would require a web search API like Google Custom Search
        # For now, placeholder but structure is ready
        
        print(f"✅ Indie Hackers scraping structure ready")
        
    except Exception as e:
        print(f"⚠️ Error scraping Indie Hackers: {e}")
    
    return jobs

def extract_job_from_github_issue(item):
    """
    Extract job information from a GitHub issue/discussion
    """
    title = item.get('title', '') or ''
    body = item.get('body', '') or ''
    
    # Check if it's actually a job posting mentioning Claude Code
    if not is_claude_code_related(title + ' ' + body):
        return None
    
    # Extract company name from repository or issue title
    repo_name = item.get('repository_url', '').split('/')[-1] if item.get('repository_url') else 'Unknown'
    
    return {
        'company': extract_company_name(title, body, repo_name),
        'company_icon': get_company_icon(extract_company_name(title, body, repo_name)),
        'location': extract_location(title, body),
        'description': truncate_description(title),
        'job_link': item.get('html_url', ''),
        'source': 'GitHub',
        'date_posted': item.get('updated_at', ''),
        'salary': 0
    }

def is_claude_code_related(text):
    """
    Check if text specifically mentions Claude (very strict filtering)
    """
    if not text:
        return False
        
    text_lower = str(text).lower()
    
    # ONLY Claude-specific keywords - must contain "claude"
    claude_keywords = [
        'claude code', 'claude-code', 'anthropic claude', 'claude ai', 
        'claude coder', 'claude assistant', 'claude developer', 'claude engineer',
        'work with claude', 'using claude', 'claude experience', 'claude integration'
    ]
    
    # Must explicitly mention Claude in some form
    has_claude_mention = any(keyword in text_lower for keyword in claude_keywords)
    
    # Additional check: just "claude" + job context
    has_claude_word = 'claude' in text_lower
    job_words = ['hiring', 'position', 'engineer', 'developer', 'role', 'job', 'career', 'experience', 'skills']
    has_job_context = any(word in text_lower for word in job_words)
    
    # Return True only if Claude is mentioned AND it's in a job context
    return has_claude_mention or (has_claude_word and has_job_context)

def extract_company_name(title, body, fallback):
    """
    Extract company name from job posting
    """
    # Common patterns in job titles
    patterns = [
        r'(\w+)\s+is\s+hiring',
        r'(\w+)\s+hiring',
        r'join\s+(\w+)',
        r'(\w+)\s+looking\s+for',
        r'(\w+)\s+seeks?',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, title + ' ' + body, re.IGNORECASE)
        if match:
            return match.group(1).title()
    
    return fallback.title()

def extract_location(title, body):
    """
    Extract location from job posting
    """
    remote_keywords = ['remote', 'anywhere', 'distributed', 'work from home']
    location_patterns = [
        r'location[:\s]+([^,\n]+)',
        r'based in ([^,\n]+)',
        r'(\w+,\s*\w+)',  # City, State/Country
    ]
    
    text = (title + ' ' + body).lower()
    
    # Check for remote first
    if any(keyword in text for keyword in remote_keywords):
        return 'Remote'
    
    # Look for specific locations
    for pattern in location_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().title()
    
    return 'On-site'

def get_company_icon(company_name):
    """
    Get company icon URL with comprehensive company icon dictionary
    """
    # Comprehensive company icons dictionary
    company_icons = {
        # AI/Tech Companies
        'anthropic': 'https://www.anthropic.com/favicon.ico',
        'openai': 'https://openai.com/favicon.ico',
        'claude code': 'https://www.anthropic.com/favicon.ico',
        
        # Major Tech Companies
        'google': 'https://www.google.com/favicon.ico',
        'microsoft': 'https://www.microsoft.com/favicon.ico',
        'meta': 'https://www.facebook.com/favicon.ico',
        'apple': 'https://www.apple.com/favicon.ico',
        'amazon': 'https://www.amazon.com/favicon.ico',
        'netflix': 'https://www.netflix.com/favicon.ico',
        'tesla': 'https://www.tesla.com/favicon.ico',
        'nvidia': 'https://www.nvidia.com/favicon.ico',
        
        # Startups/Scale-ups
        'stripe': 'https://stripe.com/favicon.ico',
        'airbnb': 'https://airbnb.com/favicon.ico',
        'uber': 'https://uber.com/favicon.ico',
        'shopify': 'https://shopify.com/favicon.ico',
        'twilio': 'https://twilio.com/favicon.ico',
        'github': 'https://github.com/favicon.ico',
        'gitlab': 'https://gitlab.com/favicon.ico',
        'atlassian': 'https://atlassian.com/favicon.ico',
        'slack': 'https://slack.com/favicon.ico',
        'discord': 'https://discord.com/favicon.ico',
        'notion': 'https://notion.so/favicon.ico',
        'figma': 'https://figma.com/favicon.ico',
        'vercel': 'https://vercel.com/favicon.ico',
        'supabase': 'https://supabase.com/favicon.ico',
        
        # Consulting/Services
        'accenture': 'https://accenture.com/favicon.ico',
        'deloitte': 'https://deloitte.com/favicon.ico',
        'mckinsey': 'https://mckinsey.com/favicon.ico',
        
        # Finance/Fintech
        'goldman sachs': 'https://goldmansachs.com/favicon.ico',
        'jpmorgan': 'https://jpmorgan.com/favicon.ico',
        'coinbase': 'https://coinbase.com/favicon.ico',
        'robinhood': 'https://robinhood.com/favicon.ico',
        
        # Generic/Fallback companies
        'unknown company': 'https://www.aitmpl.com/static/img/logo.png',
        'company': 'https://www.aitmpl.com/static/img/logo.png',
    }
    
    company_lower = company_name.lower().strip()
    
    # Direct match first
    if company_lower in company_icons:
        return company_icons[company_lower]
    
    # Partial match for company names containing key terms
    for key, icon in company_icons.items():
        if key in company_lower or company_lower in key:
            return icon
    
    # Default fallback to our custom icon
    return 'https://www.aitmpl.com/static/img/logo.png'

def truncate_description(description, max_length=100):
    """
    Truncate description to specified length
    """
    if not description:
        return ''
    
    # Clean HTML tags and extra whitespace
    clean_desc = re.sub(r'<[^>]+>', '', description)
    clean_desc = re.sub(r'\s+', ' ', clean_desc).strip()
    
    if len(clean_desc) <= max_length:
        return clean_desc
    
    # Truncate at word boundary
    truncated = clean_desc[:max_length].rsplit(' ', 1)[0]
    return truncated + '...'

def generate_sample_jobs():
    """
    Generate sample jobs for demonstration purposes
    """
    sample_jobs = [
        {
            'company': 'Anthropic',
            'company_icon': 'https://anthropic.com/favicon.ico',
            'location': 'Remote',
            'description': 'Senior AI Developer to enhance Claude Code capabilities and integrations...',
            'job_link': 'https://anthropic.com/careers/claude-code-developer',
            'source': 'Company Website',
            'date_posted': '2025-09-10T10:00:00Z',
            'salary': 150000
        },
        {
            'company': 'OpenAI',
            'company_icon': 'https://openai.com/favicon.ico', 
            'location': 'San Francisco, CA',
            'description': 'Looking for engineers experienced with Claude Code and AI development tools...',
            'job_link': 'https://openai.com/careers/claude-integration-engineer',
            'source': 'LinkedIn',
            'date_posted': '2025-09-09T14:30:00Z',
            'salary': 140000
        },
        {
            'company': 'StartupTech',
            'company_icon': 'https://logo.clearbit.com/startuptech.com',
            'location': 'Remote',
            'description': 'Full-stack developer with Claude Code experience for AI-powered development team...',
            'job_link': 'https://jobs.startuptech.com/claude-developer-2025',
            'source': 'AngelList',
            'date_posted': '2025-09-08T09:15:00Z',
            'salary': 90000
        },
        {
            'company': 'TechCorp',
            'company_icon': 'https://logo.clearbit.com/techcorp.com',
            'location': 'New York, NY',
            'description': 'Senior Software Engineer - AI Tools (Claude Code, GitHub Copilot, etc.)...',
            'job_link': 'https://careers.techcorp.com/positions/senior-ai-tools-engineer',
            'source': 'Indeed',
            'date_posted': '2025-09-07T16:45:00Z',
            'salary': 120000
        }
    ]
    
    return sample_jobs

def generate_claude_jobs_json():
    """
    Main function to scrape and generate Claude Code jobs JSON
    """
    print("🚀 Starting Claude Code jobs scraping...")
    
    all_jobs = []
    
    # Skip sample jobs - looking for real results only
    
    # Use professional job APIs (more reliable than scraping)
    api_scrapers = [
        scrape_with_rapidapi_jobs,
        scrape_with_serper_jobs,
    ]
    
    # Fallback to traditional scraping if APIs are not available
    scraping_sources = [
        scrape_github_jobs,
        scrape_ycombinator_jobs,
        scrape_weworkremotely,
    ]
    
    # Try API sources first
    for scraper in api_scrapers:
        try:
            jobs = scraper()
            all_jobs.extend(jobs)
            time.sleep(1)
        except Exception as e:
            print(f"⚠️ Error with API scraper {scraper.__name__}: {e}")
    
    # If no jobs from APIs, try traditional scraping
    if len(all_jobs) == 0:
        print("📡 No results from APIs, trying traditional scraping...")
        print("💡 Tip: Add valid API keys to .env for better results")
        scrapers = scraping_sources
    else:
        print(f"🎯 Got {len(all_jobs)} jobs from APIs, skipping traditional scraping")
        scrapers = []
    
    for scraper in scrapers:
        try:
            jobs = scraper()
            all_jobs.extend(jobs)
            time.sleep(1)  # Rate limiting
        except Exception as e:
            print(f"⚠️ Error with scraper {scraper.__name__}: {e}")
    
    # Remove duplicates based on job_link
    seen_links = set()
    unique_jobs = []
    for job in all_jobs:
        if job['job_link'] not in seen_links:
            seen_links.add(job['job_link'])
            unique_jobs.append(job)
    
    # Sort by date_posted (most recent first)
    unique_jobs.sort(key=lambda x: x.get('date_posted', ''), reverse=True)
    
    # Structure the final data
    jobs_data = {
        'jobs': unique_jobs,
        'generated_at': datetime.now().isoformat(),
        'total_count': len(unique_jobs),
        'sources': list(set([job['source'] for job in unique_jobs]))
    }
    
    # Save to docs directory
    output_path = 'docs/claude-jobs.json'
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(jobs_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Successfully generated {output_path}")
        
        # Log summary
        print("\n--- Scraping Summary ---")
        print(f"Total unique jobs found: {len(unique_jobs)}")
        
        sources_count = {}
        for job in unique_jobs:
            source = job['source']
            sources_count[source] = sources_count.get(source, 0) + 1
        
        for source, count in sources_count.items():
            print(f"  - {source}: {count} jobs")
        
        remote_jobs = len([job for job in unique_jobs if 'remote' in job['location'].lower()])
        onsite_jobs = len(unique_jobs) - remote_jobs
        print(f"  - Remote: {remote_jobs}, On-site: {onsite_jobs}")
        print("-----------------------")
        
    except IOError as e:
        print(f"❌ Error writing to {output_path}: {e}")

if __name__ == '__main__':
    generate_claude_jobs_json()