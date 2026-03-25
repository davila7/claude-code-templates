#!/usr/bin/env python3
"""Find and implement keyword-based connections between files."""

import os
import re
from collections import Counter, defaultdict
from pathlib import Path

# Priority keywords to focus on
PRIORITY_KEYWORDS = {
    'llm', 'langchain', 'langgraph', 'rag', 'embedding', 'vector',
    'agent', 'automation', 'workflow', 'pipeline', 'mcp', 'api',
    'anthropic', 'openai', 'google', 'claude', 'gpt', 'model',
    'context', 'protocol', 'fastapi', 'docker', 'cloudflare', 
    'supabase', 'integration', 'framework', 'retrieval', 'augmented',
    'generation', 'prompt', 'engineering', 'multimodal', 'function',
    'calling', 'tool', 'use', 'chain', 'thought', 'reasoning'
}

def extract_keywords_from_file(file_path):
    """Extract meaningful keywords from a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().lower()
        
        # Extract words (alphanumeric plus hyphens)
        words = re.findall(r'\b[a-z0-9-]+\b', content)
        
        # Filter for priority keywords and count occurrences
        keyword_counts = Counter()
        for word in words:
            if word in PRIORITY_KEYWORDS:
                keyword_counts[word] += 1
        
        return keyword_counts
    except:
        return Counter()

def find_keyword_connections(vault_root):
    """Find files that share multiple priority keywords."""
    search_dirs = [
        vault_root / "AI Development",
        vault_root / "AI Articles and Research",
        vault_root / "AI IDEAS",
        vault_root / "AI Courses",
        vault_root / "CamRohn LLC",
        vault_root / "Clippings"
    ]
    
    # Collect keyword data for all files
    file_keywords = {}
    print("Analyzing files for keywords...")
    
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
            
        for root, dirs, files in os.walk(search_dir):
            for file in files:
                if file.endswith('.md'):
                    file_path = Path(root) / file
                    keywords = extract_keywords_from_file(file_path)
                    if keywords:
                        file_keywords[file_path] = keywords
    
    print(f"Analyzed {len(file_keywords)} files")
    
    # Find connections between files
    connections = []
    processed_pairs = set()
    
    files = list(file_keywords.keys())
    for i, file1 in enumerate(files):
        if i % 100 == 0:
            print(f"Processing file {i+1}/{len(files)}...")
            
        for j, file2 in enumerate(files[i+1:], start=i+1):
            # Skip if already processed
            pair = tuple(sorted([str(file1), str(file2)]))
            if pair in processed_pairs:
                continue
            processed_pairs.add(pair)
            
            # Find common keywords
            common_keywords = set(file_keywords[file1].keys()) & set(file_keywords[file2].keys())
            
            if len(common_keywords) >= 5:  # At least 5 common keywords
                # Calculate relevance score
                score = sum(
                    min(file_keywords[file1][kw], file_keywords[file2][kw])
                    for kw in common_keywords
                )
                
                connections.append({
                    'file1': file1,
                    'file2': file2,
                    'keywords': list(common_keywords),
                    'score': score
                })
    
    # Sort by score
    connections.sort(key=lambda x: x['score'], reverse=True)
    
    return connections

def add_link_to_file(file_path, link_to_add, link_text=None):
    """Add a link to a file if it doesn't already exist."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract just the filename for the link
        link_filename = Path(link_to_add).stem
        
        # Check if link already exists
        if f'[[{link_filename}]]' in content:
            return False
        
        # Find or create Related section
        related_match = re.search(r'^## Related\s*$', content, re.MULTILINE)
        
        if related_match:
            # Insert after the Related header
            insert_pos = related_match.end()
            # Skip to next line
            next_line = content.find('\n', insert_pos)
            if next_line != -1:
                insert_pos = next_line + 1
        else:
            # Add Related section at end
            if not content.endswith('\n'):
                content += '\n'
            content += '\n## Related\n'
            insert_pos = len(content)
        
        # Create the link line
        if link_text:
            link_line = f"- [[{link_filename}]] - {link_text}\n"
        else:
            link_line = f"- [[{link_filename}]]\n"
        
        # Insert the link
        new_content = content[:insert_pos] + link_line + content[insert_pos:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return True
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        return False

def implement_keyword_connections(connections, limit=50):
    """Implement the top keyword-based connections."""
    connections_made = 0
    keyword_clusters = defaultdict(list)
    
    for conn in connections[:limit]:
        file1 = conn['file1']
        file2 = conn['file2']
        keywords = conn['keywords']
        
        # Create descriptive text
        keyword_text = f"Shares keywords: {', '.join(sorted(keywords)[:5])}"
        
        # Add bidirectional links
        if add_link_to_file(file1, file2, keyword_text):
            connections_made += 1
            print(f"Connected {file1.name} ↔ {file2.name}")
            
            # Track keyword clusters
            for kw in keywords:
                keyword_clusters[kw].append((file1.name, file2.name))
        
        if add_link_to_file(file2, file1, keyword_text):
            connections_made += 1
    
    return connections_made, keyword_clusters

def main():
    vault_root = Path("/Users/cam/VAULT01")
    
    print("Finding keyword-based connections...")
    connections = find_keyword_connections(vault_root)
    
    print(f"\nFound {len(connections)} potential keyword connections")
    
    # Show top connections
    print("\nTop 10 keyword connections by relevance:")
    for i, conn in enumerate(connections[:10]):
        print(f"{i+1}. {conn['file1'].name} ↔ {conn['file2'].name}")
        print(f"   Keywords ({len(conn['keywords'])}): {', '.join(sorted(conn['keywords'])[:8])}")
        print(f"   Score: {conn['score']}")
    
    # Implement connections
    print("\nImplementing connections...")
    connections_made, keyword_clusters = implement_keyword_connections(connections)
    
    print(f"\n=== Keyword Connection Report ===")
    print(f"Total connections made: {connections_made}")
    
    print("\nMost connected keywords:")
    sorted_keywords = sorted(keyword_clusters.items(), key=lambda x: len(x[1]), reverse=True)[:10]
    for keyword, connections in sorted_keywords:
        print(f"  {keyword}: {len(connections)} connections")
    
    # Find cross-domain connections
    print("\nCross-domain connections:")
    cross_domain = 0
    for i, (keyword, conn_list) in enumerate(sorted_keywords[:5]):
        print(f"\n{keyword}-related cross-domain connections:")
        for file1_name, file2_name in conn_list[:3]:  # Show first 3 for each keyword
            print(f"  - {file1_name} ↔ {file2_name}")

if __name__ == "__main__":
    main()