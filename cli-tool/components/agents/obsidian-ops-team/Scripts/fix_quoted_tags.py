#!/usr/bin/env python3
"""
Fix quoted tags in frontmatter by converting single-quoted tags to unquoted format.
"""

import os
import re
import yaml
from pathlib import Path

def fix_quoted_tags(vault_path):
    """Fix single-quoted tags in all markdown files."""
    vault_path = Path(vault_path)
    files_updated = 0
    
    for file_path in vault_path.rglob('*.md'):
        if any(skip in file_path.parts for skip in ['.obsidian', '.trash', '.git']):
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if file has frontmatter
            if not content.strip().startswith('---'):
                continue
                
            # Find frontmatter boundaries
            lines = content.split('\n')
            if len(lines) < 3:
                continue
                
            end_idx = None
            for i in range(1, len(lines)):
                if lines[i].strip() == '---':
                    end_idx = i
                    break
                    
            if end_idx is None:
                continue
                
            # Extract frontmatter
            frontmatter_text = '\n'.join(lines[1:end_idx])
            
            # Check if tags line has quoted values
            if re.search(r"tags:\s*\[['\"]", frontmatter_text):
                # Parse frontmatter
                try:
                    frontmatter = yaml.safe_load(frontmatter_text)
                    if frontmatter and 'tags' in frontmatter:
                        # Update tags (remove quotes)
                        tags = frontmatter['tags']
                        if isinstance(tags, list):
                            # Tags are already in list format, just ensure they're not quoted
                            frontmatter['tags'] = [str(tag) for tag in tags]
                            
                            # Reconstruct content
                            new_frontmatter = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
                            remaining_content = '\n'.join(lines[end_idx + 1:])
                            new_content = f"---\n{new_frontmatter}---\n{remaining_content}"
                            
                            # Write back
                            with open(file_path, 'w', encoding='utf-8') as f:
                                f.write(new_content)
                            
                            files_updated += 1
                            print(f"Fixed: {file_path.relative_to(vault_path)}")
                            
                except yaml.YAMLError as e:
                    print(f"YAML error in {file_path}: {e}")
                    
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    return files_updated

if __name__ == '__main__':
    vault_path = '/Users/cam/VAULT01'
    print(f"Fixing quoted tags in: {vault_path}")
    
    updated = fix_quoted_tags(vault_path)
    print(f"\nTotal files updated: {updated}")