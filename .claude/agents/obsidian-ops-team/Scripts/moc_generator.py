#!/usr/bin/env python3
"""
MOC (Map of Content) Generator for Obsidian Vault
Automatically generates MOCs for directories and topics.
"""

import os
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import argparse

class MOCGenerator:
    def __init__(self, vault_path):
        self.vault_path = Path(vault_path)
        self.directory_stats = {}
        self.topic_clusters = defaultdict(list)
        
    def analyze_directory(self, directory_path):
        """Analyze a directory and its contents."""
        stats = {
            'total_files': 0,
            'md_files': 0,
            'subdirectories': [],
            'file_types': defaultdict(int),
            'common_topics': defaultdict(int)
        }
        
        try:
            for item in directory_path.iterdir():
                if item.is_file():
                    stats['total_files'] += 1
                    if item.suffix == '.md':
                        stats['md_files'] += 1
                        # Extract topics from filename
                        topics = self.extract_topics_from_filename(item.name)
                        for topic in topics:
                            stats['common_topics'][topic] += 1
                    stats['file_types'][item.suffix] += 1
                elif item.is_dir() and not item.name.startswith('.'):
                    stats['subdirectories'].append(item.name)
        except PermissionError:
            print(f"Permission denied: {directory_path}")
            
        return stats
    
    def extract_topics_from_filename(self, filename):
        """Extract potential topics from filename."""
        # Remove extension and common prefixes
        name = filename.replace('.md', '')
        name = re.sub(r'^\d{4}-\d{2}-\d{2}[_-]', '', name)  # Remove date prefix
        name = re.sub(r'^MOC[_-]', '', name)  # Remove MOC prefix
        
        # Split on common separators and filter
        words = re.split(r'[_\-\s]+', name)
        topics = []
        
        # Filter out common words and keep meaningful terms
        stop_words = {'and', 'the', 'for', 'with', 'to', 'of', 'in', 'on', 'at', 'by'}
        
        for word in words:
            if len(word) > 2 and word.lower() not in stop_words:
                topics.append(word.lower())
        
        return topics
    
    def generate_moc_content(self, directory_path, title, description=""):
        """Generate MOC content for a directory."""
        stats = self.analyze_directory(directory_path)
        
        # Create frontmatter
        frontmatter = f"""---
tags: [MOC, {directory_path.name.lower().replace(' ', '-')}]
type: map-of-content
created: {datetime.now().strftime('%Y-%m-%d')}
modified: {datetime.now().strftime('%Y-%m-%d')}
status: active
cssclass: moc
aliases: [{title} Hub, {title} Overview]
hub_for: [{directory_path.name}]
related_mocs: []
---

"""
        
        # Create content
        content = f"""# {title} Map of Content

## Overview
{description if description else f"This MOC organizes all content related to {title.lower()}."}

**Directory**: `{directory_path.name}/`
**Total Files**: {stats['md_files']} markdown files
**Last Updated**: {datetime.now().strftime('%Y-%m-%d')}

"""
        
        # Add subdirectories if any
        if stats['subdirectories']:
            content += "## Subdirectories\n\n"
            for subdir in sorted(stats['subdirectories']):
                content += f"### {subdir}\n"
                content += f"- [[MOC - {subdir}|{subdir} Overview]]\n\n"
        
        # Organize files by topic
        content += self.organize_files_by_topic(directory_path, stats)
        
        # Add common topics section
        if stats['common_topics']:
            content += "## Key Topics\n\n"
            sorted_topics = sorted(stats['common_topics'].items(), key=lambda x: x[1], reverse=True)
            for topic, count in sorted_topics[:10]:  # Top 10 topics
                content += f"- **{topic.title()}** ({count} files)\n"
            content += "\n"
        
        # Add templates and resources
        content += """## Related MOCs
- [[MOC - AI Development|AI Development]]
- [[MOC - Learning Resources|Learning Resources]]
- [[Master Index|🗂️ Master Index]]

## Status & Progress
- [ ] Organize files by topic
- [ ] Add cross-references
- [ ] Review and update links
- [ ] Add examples and tutorials

## Next Steps
- Review all files in this directory
- Create sub-MOCs for large topic clusters
- Add relevant tags to all files
- Connect to related MOCs

---
*This MOC was auto-generated. Please review and customize as needed.*
"""
        
        return frontmatter + content
    
    def organize_files_by_topic(self, directory_path, stats):
        """Organize files by topic clusters."""
        content = "## Content Organization\n\n"
        
        # Group files by topic
        topic_files = defaultdict(list)
        ungrouped_files = []
        
        try:
            for file_path in directory_path.glob('*.md'):
                if file_path.name.startswith('MOC'):
                    continue  # Skip existing MOCs
                
                topics = self.extract_topics_from_filename(file_path.name)
                if topics:
                    # Use first topic as primary grouping
                    primary_topic = topics[0]
                    topic_files[primary_topic].append(file_path)
                else:
                    ungrouped_files.append(file_path)
        
        except Exception as e:
            print(f"Error organizing files: {e}")
            return content
        
        # Sort topics by number of files
        sorted_topics = sorted(topic_files.items(), key=lambda x: len(x[1]), reverse=True)
        
        for topic, files in sorted_topics:
            if len(files) > 1:  # Only create sections for topics with multiple files
                content += f"### {topic.title()}\n"
                for file_path in sorted(files):
                    title = file_path.stem.replace('_', ' ').replace('-', ' ')
                    content += f"- [[{title}]]\n"
                content += "\n"
        
        # Add ungrouped files
        if ungrouped_files:
            content += "### Other Files\n"
            for file_path in sorted(ungrouped_files):
                title = file_path.stem.replace('_', ' ').replace('-', ' ')
                content += f"- [[{title}]]\n"
            content += "\n"
        
        return content
    
    def create_moc_file(self, directory_path, title, description="", output_path=None):
        """Create a MOC file for a directory."""
        content = self.generate_moc_content(directory_path, title, description)
        
        if output_path is None:
            # Create MOCs in the centralized map-of-content directory
            moc_dir = self.vault_path / "map-of-content"
            moc_dir.mkdir(exist_ok=True)
            output_path = moc_dir / f"MOC - {title}.md"
        
        # Check if file already exists
        if output_path.exists():
            print(f"MOC already exists: {output_path}")
            return False
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Created MOC: {output_path}")
            return True
        except Exception as e:
            print(f"Error creating MOC: {e}")
            return False
    
    def suggest_mocs(self):
        """Suggest MOCs for directories that don't have them."""
        suggestions = []
        
        # Skip these directories
        skip_dirs = {'.obsidian', '.trash', 'System_Files', '.git'}
        
        for directory in self.vault_path.iterdir():
            if not directory.is_dir() or directory.name in skip_dirs:
                continue
            
            stats = self.analyze_directory(directory)
            
            # Check if directory has enough content to warrant a MOC
            if stats['md_files'] >= 3:
                # Check if MOC already exists
                existing_mocs = list(directory.glob('MOC*.md'))
                if not existing_mocs:
                    suggestions.append({
                        'directory': directory,
                        'title': directory.name,
                        'file_count': stats['md_files'],
                        'subdirs': len(stats['subdirectories']),
                        'top_topics': sorted(stats['common_topics'].items(), 
                                          key=lambda x: x[1], reverse=True)[:5]
                    })
        
        return suggestions

def main():
    parser = argparse.ArgumentParser(description='Generate MOCs for Obsidian vault')
    parser.add_argument('--vault', default='/Users/cam/VAULT01',
                       help='Path to Obsidian vault')
    parser.add_argument('--directory', 
                       help='Specific directory to create MOC for')
    parser.add_argument('--title',
                       help='Title for the MOC')
    parser.add_argument('--description',
                       help='Description for the MOC')
    parser.add_argument('--suggest', action='store_true',
                       help='Suggest directories that need MOCs')
    parser.add_argument('--create-all', action='store_true',
                       help='Create MOCs for all suggested directories')
    
    args = parser.parse_args()
    
    generator = MOCGenerator(args.vault)
    
    if args.suggest or args.create_all:
        suggestions = generator.suggest_mocs()
        
        if args.suggest:
            print("MOC Suggestions:")
            print("="*50)
            for suggestion in suggestions:
                print(f"Directory: {suggestion['directory'].name}")
                print(f"  Files: {suggestion['file_count']}")
                print(f"  Subdirs: {suggestion['subdirs']}")
                if suggestion['top_topics']:
                    topics = [f"{topic} ({count})" for topic, count in suggestion['top_topics']]
                    print(f"  Topics: {', '.join(topics)}")
                print()
        
        if args.create_all:
            for suggestion in suggestions:
                generator.create_moc_file(
                    suggestion['directory'],
                    suggestion['title']
                )
    
    elif args.directory:
        directory_path = Path(args.vault) / args.directory
        if not directory_path.exists():
            print(f"Directory not found: {directory_path}")
            return
        
        title = args.title or directory_path.name
        description = args.description or ""
        
        generator.create_moc_file(directory_path, title, description)
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()