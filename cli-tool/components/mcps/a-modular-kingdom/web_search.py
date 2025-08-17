# tools/web_search.py

import httpx
from bs4 import BeautifulSoup
import json

def perform_web_search(query: str) -> str:
    """
    Searches the web for information using DuckDuckGo.
    Args:
        query: The search query.
    Returns:
        A JSON string containing the search results or an error message.
    """
    print(f"Tool: web_search, Query: {query}")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        with httpx.Client(headers=headers, follow_redirects=True, timeout=15) as client:
            response = client.get("https://duckduckgo.com/html/", params={"q": query})
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            snippets = [div.get_text(strip=True) for div in soup.select('a.result__snippet')[:5]]
            results = "\n".join(snippets) if snippets else "No search results found."
            return json.dumps({"results": results})
    except Exception as e:
        return json.dumps({"error": f"Error during web search: {e}"})