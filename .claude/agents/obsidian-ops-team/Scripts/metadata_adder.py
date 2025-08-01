#!/usr/bin/env python3
"""
Metadata Adder for Obsidian Vault
Adds standardized frontmatter to markdown files that lack it.
"""

import os
import re
from datetime import datetime
from pathlib import Path
import argparse

class MetadataAdder:
    def __init__(self, vault_path):
        self.vault_path = Path(vault_path)
        self.stats = {
            'processed': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0
        }
        
    def get_file_creation_date(self, file_path):
        """Get file creation date from filesystem."""
        try:
            stat = os.stat(file_path)
            # Use birthtime on macOS, ctime on others
            timestamp = stat.st_birthtime if hasattr(stat, 'st_birthtime') else stat.st_ctime
            return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')
        except:
            return datetime.now().strftime('%Y-%m-%d')
    
    def determine_file_type(self, file_path):
        """Determine the type of note based on path and content."""
        path_str = str(file_path).lower()
        
        if 'moc' in path_str or 'map of content' in path_str:
            return 'map-of-content'
        elif 'daily notes' in path_str or 'daily note' in path_str:
            return 'daily'
        elif 'research' in path_str or 'articles' in path_str:
            return 'research'
        elif 'client' in path_str or 'camrohn llc' in path_str:
            return 'client-work'
        elif 'tutorial' in path_str or 'course' in path_str:
            return 'tutorial'
        elif 'idea' in path_str:
            return 'idea'
        elif 'meeting' in path_str:
            return 'meeting'
        elif 'email' in path_str:
            return 'email'
        else:
            return 'note'
    
    def generate_tags_from_path(self, file_path):
        """Generate tags based on file path."""
        tags = []
        path_parts = file_path.relative_to(self.vault_path).parts[:-1]  # Exclude filename
        
        # Map directory names to tags
        tag_mapping = {
            'ai development': 'ai/development',
            'ai articles': 'ai/research',
            'ai courses': 'tutorial/course',
            'ai ideas': 'idea',
            'camrohn llc': 'client',
            'daily notes': 'daily',
            'clippings': 'clippings',
            'mcp': 'mcp',
            'langchain': 'langchain',
            'graphrag': 'graphrag'
        }
        
        for part in path_parts:
            part_lower = part.lower()
            for key, tag in tag_mapping.items():
                if key in part_lower:
                    tags.append(tag)
                    break
        
        # Add date tags for daily notes
        if 'daily' in tags:
            created_date = self.get_file_creation_date(file_path)
            year_month = datetime.strptime(created_date, '%Y-%m-%d').strftime('%Y/%m')
            tags.append(f'daily/{year_month}')
        
        return list(set(tags))  # Remove duplicates
    
    def has_frontmatter(self, content):
        """Check if content already has frontmatter."""
        return content.strip().startswith('---')
    
    def create_frontmatter(self, file_path, existing_content):
        """Create appropriate frontmatter for the file."""
        created_date = self.get_file_creation_date(file_path)
        file_type = self.determine_file_type(file_path)
        tags = self.generate_tags_from_path(file_path)
        
        # Extract title from first heading or filename
        title_match = re.search(r'^#\s+(.+)$', existing_content, re.MULTILINE)
        if title_match:
            title = title_match.group(1)
        else:
            title = file_path.stem.replace('_', ' ').replace('-', ' ')
        
        frontmatter = f"""---
tags: {tags}
type: {file_type}
created: {created_date}
modified: {datetime.now().strftime('%Y-%m-%d')}
status: active
related: []
aliases: []
---

"""
        
        return frontmatter
    
    def process_file(self, file_path):
        """Process a single markdown file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if self.has_frontmatter(content):
                self.stats['skipped'] += 1
                return False
            
            # Create and prepend frontmatter
            frontmatter = self.create_frontmatter(file_path, content)
            new_content = frontmatter + content
            
            # Write back to file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            self.stats['updated'] += 1
            return True
            
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            self.stats['errors'] += 1
            return False
    
    def process_vault(self, dry_run=False):
        """Process all markdown files in the vault."""
        # Directories to skip
        skip_dirs = {'.obsidian', '.trash', 'System_Files', '.git'}
        
        for file_path in self.vault_path.rglob('*.md'):
            # Skip files in excluded directories
            if any(skip_dir in file_path.parts for skip_dir in skip_dirs):
                continue
            
            self.stats['processed'] += 1
            
            if dry_run:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if not self.has_frontmatter(content):
                    print(f"Would update: {file_path.relative_to(self.vault_path)}")
                    self.stats['updated'] += 1
                else:
                    self.stats['skipped'] += 1
            else:
                if self.process_file(file_path):
                    print(f"Updated: {file_path.relative_to(self.vault_path)}")
        
        return self.stats

def main():
    parser = argparse.ArgumentParser(description='Add metadata to Obsidian vault files')
    parser.add_argument('--vault', default='/Users/cam/VAULT01', 
                       help='Path to Obsidian vault')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be updated without making changes')
    
    args = parser.parse_args()
    
    adder = MetadataAdder(args.vault)
    print(f"Processing vault at: {args.vault}")
    print("Dry run mode" if args.dry_run else "Making changes")
    print("-" * 50)
    
    stats = adder.process_vault(dry_run=args.dry_run)
    
    print("-" * 50)
    print(f"Files processed: {stats['processed']}")
    print(f"Files updated: {stats['updated']}")
    print(f"Files skipped (already have metadata): {stats['skipped']}")
    print(f"Errors: {stats['errors']}")

if __name__ == '__main__':
    main()