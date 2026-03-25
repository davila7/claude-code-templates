#!/usr/bin/env python3
"""Implement entity-based connections from Link Suggestions Report."""

import re
import os
from pathlib import Path

# Priority entities to focus on
PRIORITY_ENTITIES = {
    'langchain', 'langgraph', 'llm', 'rag', 'embedding', 'vector', 
    'mcp', 'model context protocol', 'api integration', 'function calling',
    'anthropic', 'openai', 'google', 'claude', 'gpt',
    'autonomous agent', 'ai agent', 'chain of thought', 'prompt engineering',
    'retrieval augmented', 'graphrag', 'multimodal', 'tool use'
}

def read_file(file_path):
    """Read file content."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        return None

def write_file(file_path, content):
    """Write content to file."""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except:
        return False

def find_file(filename, search_dirs):
    """Find a file in the vault."""
    for dir_path in search_dirs:
        for root, dirs, files in os.walk(dir_path):
            for file in files:
                if file == filename or file == filename + '.md':
                    return os.path.join(root, file)
    return None

def add_link_to_file(file_path, link_to_add, link_text=None):
    """Add a link to a file if it doesn't already exist."""
    content = read_file(file_path)
    if not content:
        return False
    
    # Check if link already exists
    if f'[[{link_to_add}]]' in content:
        return False
    
    # Find a good place to add the link
    # Look for existing "Related:" or "See also:" sections
    related_patterns = [
        r'^#+\s*Related.*?$',
        r'^#+\s*See also.*?$',
        r'^#+\s*Links.*?$',
        r'^#+\s*References.*?$'
    ]
    
    insert_pos = None
    for pattern in related_patterns:
        match = re.search(pattern, content, re.MULTILINE | re.IGNORECASE)
        if match:
            # Find the end of this section
            insert_pos = match.end()
            # Skip to next line
            next_line = content.find('\n', insert_pos)
            if next_line != -1:
                insert_pos = next_line + 1
            break
    
    # If no related section found, add at the end of frontmatter
    if insert_pos is None:
        # Find end of frontmatter
        frontmatter_end = content.find('---', 3)
        if frontmatter_end != -1:
            insert_pos = content.find('\n', frontmatter_end + 3) + 1
        else:
            # No frontmatter, add at beginning
            insert_pos = 0
    
    # Create the link line
    if link_text:
        link_line = f"- [[{link_to_add}]] - {link_text}\n"
    else:
        link_line = f"- [[{link_to_add}]]\n"
    
    # If we're not in a list section, create one
    if insert_pos is None or (insert_pos > 0 and content[insert_pos-2:insert_pos] != '\n\n'):
        # Check if we need to add a Related section
        needs_section = True
        for pattern in related_patterns:
            if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
                needs_section = False
                break
        
        if needs_section:
            # Add at end of file with new Related section
            if not content.endswith('\n'):
                content += '\n'
            content += '\n## Related\n'
            content += link_line
        else:
            # Insert in existing section
            new_content = content[:insert_pos] + link_line + content[insert_pos:]
            content = new_content
    else:
        # Insert at found position
        new_content = content[:insert_pos] + link_line + content[insert_pos:]
        content = new_content
    
    return write_file(file_path, content)

def implement_connections():
    """Implement priority entity connections."""
    vault_root = Path("/Users/cam/VAULT01")
    search_dirs = [
        vault_root / "AI Development",
        vault_root / "AI Articles and Research", 
        vault_root / "AI IDEAS",
        vault_root / "AI Courses",
        vault_root / "CamRohn LLC",
        vault_root / "Clippings"
    ]
    
    # Read the report
    report_path = vault_root / "System_Files" / "Link_Suggestions_Report.md"
    report_content = read_file(report_path)
    
    if not report_content:
        print("Could not read report")
        return
    
    # Parse entity connections
    connections_made = 0
    connections_by_entity = {}
    
    # Find entity sections
    entity_pattern = r'^### (.+)$'
    connection_pattern = r'- \[\[([^\]]+)\]\] ↔ \[\[([^\]]+)\]\]'
    
    current_entity = None
    for line in report_content.split('\n'):
        # Check for entity header
        entity_match = re.match(entity_pattern, line)
        if entity_match:
            current_entity = entity_match.group(1).strip().lower()
            continue
        
        # Check for connection
        if current_entity and current_entity in [e.lower() for e in PRIORITY_ENTITIES]:
            conn_match = re.match(connection_pattern, line)
            if conn_match:
                file1 = conn_match.group(1).strip()
                file2 = conn_match.group(2).strip()
                
                # Skip self-connections
                if file1 == file2:
                    continue
                
                # Find actual file paths
                file1_path = find_file(file1 + '.md', search_dirs)
                file2_path = find_file(file2 + '.md', search_dirs)
                
                if file1_path and file2_path:
                    # Add bidirectional links
                    if add_link_to_file(file1_path, file2, f"Related to {current_entity}"):
                        connections_made += 1
                        if current_entity not in connections_by_entity:
                            connections_by_entity[current_entity] = 0
                        connections_by_entity[current_entity] += 1
                        print(f"Added link from {file1} to {file2}")
                    
                    if add_link_to_file(file2_path, file1, f"Related to {current_entity}"):
                        connections_made += 1
                        if current_entity not in connections_by_entity:
                            connections_by_entity[current_entity] = 0
                        connections_by_entity[current_entity] += 1
                        print(f"Added link from {file2} to {file1}")
    
    # Generate report
    print("\n=== Connection Implementation Report ===")
    print(f"Total connections made: {connections_made}")
    print("\nConnections by entity:")
    for entity, count in sorted(connections_by_entity.items(), key=lambda x: x[1], reverse=True):
        print(f"  {entity}: {count} connections")
    
    # Find cross-domain connections
    print("\nCross-domain connections created:")
    # This would require more complex analysis of file paths

if __name__ == "__main__":
    implement_connections()