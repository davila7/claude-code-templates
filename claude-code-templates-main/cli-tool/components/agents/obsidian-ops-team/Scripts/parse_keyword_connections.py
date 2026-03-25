#!/usr/bin/env python3
"""Parse keyword connections from Link Suggestions Report."""

import re
import sys
from pathlib import Path

def parse_keyword_connections(report_path):
    """Parse keyword connections from the report and find meaningful ones."""
    
    with open(report_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the keyword-based section
    keyword_section_start = content.find("## Keyword-Based Link Suggestions")
    if keyword_section_start == -1:
        print("Could not find keyword-based section")
        return []
    
    # Find the next section (orphaned notes)
    orphaned_section_start = content.find("## Orphaned Notes", keyword_section_start)
    if orphaned_section_start == -1:
        keyword_section = content[keyword_section_start:]
    else:
        keyword_section = content[keyword_section_start:orphaned_section_start]
    
    # Pattern to match connections
    pattern = r'- \[\[([^\]]+)\]\] ↔ \[\[([^\]]+)\]\]\s*\n\s*Common words: ([^\n]+)'
    
    connections = []
    for match in re.finditer(pattern, keyword_section):
        file1 = match.group(1).strip()
        file2 = match.group(2).strip()
        keywords = match.group(3).strip()
        
        # Skip self-connections
        if file1 == file2:
            continue
            
        # Count keywords
        keyword_list = [k.strip() for k in keywords.split(',')]
        keyword_count = len(keyword_list)
        
        # Only include connections with 5+ keywords
        if keyword_count >= 5:
            connections.append({
                'file1': file1,
                'file2': file2,
                'keywords': keyword_list,
                'count': keyword_count
            })
    
    # Sort by keyword count descending
    connections.sort(key=lambda x: x['count'], reverse=True)
    
    return connections

def main():
    report_path = Path("/Users/cam/VAULT01/System_Files/Link_Suggestions_Report.md")
    
    connections = parse_keyword_connections(report_path)
    
    print(f"Found {len(connections)} meaningful keyword connections (5+ keywords)\n")
    
    # Group by keyword themes
    tech_keywords = {'llm', 'langchain', 'langgraph', 'rag', 'embedding', 'vector', 'agent', 'model', 'api', 'mcp'}
    framework_keywords = {'langchain', 'langgraph', 'fastapi', 'docker', 'cloudflare', 'supabase'}
    company_keywords = {'openai', 'anthropic', 'google', 'microsoft', 'meta'}
    concept_keywords = {'automation', 'workflow', 'pipeline', 'integration', 'generation', 'retrieval'}
    
    tech_connections = []
    framework_connections = []
    company_connections = []
    concept_connections = []
    
    for conn in connections:
        keywords_lower = [k.lower() for k in conn['keywords']]
        
        tech_score = len([k for k in keywords_lower if any(tech in k for tech in tech_keywords)])
        framework_score = len([k for k in keywords_lower if any(fw in k for fw in framework_keywords)])
        company_score = len([k for k in keywords_lower if any(comp in k for comp in company_keywords)])
        concept_score = len([k for k in keywords_lower if any(conc in k for conc in concept_keywords)])
        
        if tech_score >= 2:
            tech_connections.append(conn)
        if framework_score >= 2:
            framework_connections.append(conn)
        if company_score >= 1:
            company_connections.append(conn)
        if concept_score >= 2:
            concept_connections.append(conn)
    
    print("## High-Priority Technical Connections")
    print(f"Found {len(tech_connections)} connections with technical keywords\n")
    for i, conn in enumerate(tech_connections[:20]):  # Top 20
        print(f"{i+1}. [[{conn['file1']}]] ↔ [[{conn['file2']}]]")
        print(f"   Keywords ({conn['count']}): {', '.join(conn['keywords'][:10])}")
        print()
    
    print("\n## Framework-Related Connections")
    print(f"Found {len(framework_connections)} connections with framework keywords\n")
    for i, conn in enumerate(framework_connections[:15]):  # Top 15
        print(f"{i+1}. [[{conn['file1']}]] ↔ [[{conn['file2']}]]")
        print(f"   Keywords ({conn['count']}): {', '.join(conn['keywords'][:10])}")
        print()
    
    print("\n## Company/Provider Connections")
    print(f"Found {len(company_connections)} connections with company keywords\n")
    for i, conn in enumerate(company_connections[:10]):  # Top 10
        print(f"{i+1}. [[{conn['file1']}]] ↔ [[{conn['file2']}]]")
        print(f"   Keywords ({conn['count']}): {', '.join(conn['keywords'][:10])}")
        print()
    
    print("\n## Concept/Workflow Connections")
    print(f"Found {len(concept_connections)} connections with concept keywords\n")
    for i, conn in enumerate(concept_connections[:10]):  # Top 10
        print(f"{i+1}. [[{conn['file1']}]] ↔ [[{conn['file2']}]]")
        print(f"   Keywords ({conn['count']}): {', '.join(conn['keywords'][:10])}")
        print()

if __name__ == "__main__":
    main()