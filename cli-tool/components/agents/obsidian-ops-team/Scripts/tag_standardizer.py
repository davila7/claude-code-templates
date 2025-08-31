#!/usr/bin/env python3
"""
Tag Standardizer for Obsidian Vault
Normalizes and standardizes tags across all notes.
"""

import os
import re
import yaml
from pathlib import Path
from collections import defaultdict, Counter
import argparse

class TagStandardizer:
    def __init__(self, vault_path):
        self.vault_path = Path(vault_path)
        self.tag_mappings = {}
        self.tag_stats = Counter()
        self.files_processed = 0
        self.files_updated = 0
        
        # Define standard tag mappings
        self.standard_mappings = {
            # Color codes to semantic tags
            '#F0EEE6': 'clippings',
            '#e0e0e0': 'reference',
            '#f0f0f0': 'note',
            
            # Technology standardization
            'langchain': 'langchain',
            'lang-chain': 'langchain',
            'LangChain': 'langchain',
            'langgraph': 'langgraph',
            'lang-graph': 'langgraph',
            'LangGraph': 'langgraph',
            'mcp': 'mcp',
            'MCP': 'mcp',
            'model-context-protocol': 'mcp',
            'Model Context Protocol': 'mcp',
            'graphrag': 'graphrag',
            'GraphRAG': 'graphrag',
            'graph-rag': 'graphrag',
            'openai': 'openai',
            'OpenAI': 'openai',
            'anthropic': 'anthropic',
            'Anthropic': 'anthropic',
            'claude': 'anthropic',
            'Claude': 'anthropic',
            'llm': 'ai/llm',
            'LLM': 'ai/llm',
            'ai-agents': 'ai/agents',
            'AI Agents': 'ai/agents',
            'embeddings': 'ai/embeddings',
            'vector-db': 'ai/embeddings',
            'rag': 'ai/embeddings',
            'RAG': 'ai/embeddings',
            
            # Common case standardizations
            'MOC': 'moc',
            'API': 'api',
            'RSS': 'rss',
            'UI': 'ui',
            'AI': 'ai',
            
            # Content type standardization
            'research': 'research',
            'Research': 'research',
            'tutorial': 'tutorial',
            'Tutorial': 'tutorial',
            'how-to': 'tutorial',
            'guide': 'tutorial',
            'reference': 'reference',
            'Reference': 'reference',
            'docs': 'reference',
            'documentation': 'reference',
            'idea': 'idea',
            'Idea': 'idea',
            'ideas': 'idea',
            'brainstorm': 'idea',
            'concept': 'idea',
            'meeting': 'meeting',
            'Meeting': 'meeting',
            'notes': 'meeting',
            'email': 'email',
            'Email': 'email',
            'correspondence': 'email',
            'daily': 'daily',
            'Daily': 'daily',
            'journal': 'daily',
            'Journal': 'daily',
            'log': 'daily',
            
            # Business tags
            'client': 'client',
            'Client': 'client',
            'business': 'business',
            'Business': 'business',
            'startup': 'startup',
            'Startup': 'startup',
            'freelance': 'freelance',
            'Freelance': 'freelance',
            'project': 'project',
            'Project': 'project',
            
            # Status tags
            'active': 'status/active',
            'Active': 'status/active',
            'draft': 'status/draft',
            'Draft': 'status/draft',
            'completed': 'status/completed',
            'Completed': 'status/completed',
            'archived': 'status/archived',
            'Archived': 'status/archived',
            'todo': 'action/todo',
            'TODO': 'action/todo',
            'follow-up': 'action/follow-up',
            'Follow-up': 'action/follow-up',
            
            # Learning tags
            'course': 'learning/course',
            'Course': 'learning/course',
            'certification': 'learning/certification',
            'Certification': 'learning/certification',
            'book': 'learning/book',
            'Book': 'learning/book',
            'video': 'learning/video',
            'Video': 'learning/video',
            'podcast': 'learning/podcast',
            'Podcast': 'learning/podcast',
            'conference': 'learning/conference',
            'Conference': 'learning/conference',
            'webinar': 'learning/webinar',
            'Webinar': 'learning/webinar'
        }
    
    def extract_frontmatter(self, content):
        """Extract YAML frontmatter from content."""
        if not content.strip().startswith('---'):
            return None, content
        
        # Find the end of frontmatter
        lines = content.split('\n')
        if len(lines) < 3:
            return None, content
        
        end_idx = None
        for i in range(1, len(lines)):
            if lines[i].strip() == '---':
                end_idx = i
                break
        
        if end_idx is None:
            return None, content
        
        try:
            frontmatter_text = '\n'.join(lines[1:end_idx])
            frontmatter = yaml.safe_load(frontmatter_text)
            remaining_content = '\n'.join(lines[end_idx + 1:])
            return frontmatter, remaining_content
        except yaml.YAMLError:
            return None, content
    
    def normalize_tag(self, tag):
        """Normalize a single tag."""
        # Remove leading/trailing whitespace
        tag = tag.strip()
        
        # Remove hash if present
        if tag.startswith('#'):
            tag = tag[1:]
        
        # Apply standard mappings
        if tag in self.standard_mappings:
            return self.standard_mappings[tag]
        
        # Handle date-based tags
        if re.match(r'\d{4}/\d{2}', tag):
            return f'daily/{tag}'
        
        # Handle file paths as tags
        if '/' in tag and not tag.startswith(('ai/', 'client/', 'learning/', 'status/', 'action/')):
            # Convert path-like tags to hierarchical tags
            parts = tag.split('/')
            if len(parts) >= 2:
                category = parts[0].lower()
                if category in ['ai', 'client', 'learning', 'business', 'project']:
                    return f"{category}/{'/'.join(parts[1:]).lower()}"
        
        # Default normalization
        return tag.lower().replace(' ', '-')
    
    def standardize_tags(self, tags):
        """Standardize a list of tags."""
        if not tags:
            return []
        
        # Handle different tag formats
        if isinstance(tags, str):
            # Single tag as string
            return [self.normalize_tag(tags)]
        
        if isinstance(tags, list):
            standardized = []
            for tag in tags:
                if isinstance(tag, str):
                    normalized = self.normalize_tag(tag)
                    if normalized and normalized not in standardized:
                        standardized.append(normalized)
                        self.tag_stats[normalized] += 1
            return standardized
        
        return []
    
    def process_file(self, file_path, dry_run=False):
        """Process a single file and standardize its tags."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            frontmatter, remaining_content = self.extract_frontmatter(content)
            
            if frontmatter is None:
                return False  # No frontmatter to process
            
            # Get current tags
            current_tags = frontmatter.get('tags', [])
            
            # Standardize tags
            standardized_tags = self.standardize_tags(current_tags)
            
            # Check if tags changed
            if standardized_tags != current_tags:
                if not dry_run:
                    # Update frontmatter
                    frontmatter['tags'] = standardized_tags
                    
                    # Reconstruct content
                    new_frontmatter = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
                    new_content = f"---\n{new_frontmatter}---\n{remaining_content}"
                    
                    # Write back to file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                
                return True  # File was updated
            
            return False  # No changes needed
            
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return False
    
    def analyze_existing_tags(self):
        """Analyze existing tags in the vault."""
        tag_files = defaultdict(list)
        
        for file_path in self.vault_path.rglob('*.md'):
            if any(skip_dir in file_path.parts for skip_dir in {'.obsidian', '.trash', 'System_Files', '.git'}):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                frontmatter, _ = self.extract_frontmatter(content)
                
                if frontmatter and 'tags' in frontmatter:
                    tags = frontmatter['tags']
                    if isinstance(tags, list):
                        for tag in tags:
                            if isinstance(tag, str):
                                tag_files[tag].append(file_path)
                    elif isinstance(tags, str):
                        tag_files[tags].append(file_path)
            
            except Exception as e:
                print(f"Error analyzing {file_path}: {e}")
        
        return tag_files
    
    def generate_tag_report(self):
        """Generate a report of current tags and suggested changes."""
        print("Analyzing existing tags...")
        tag_files = self.analyze_existing_tags()
        
        report = []
        report.append("# Tag Standardization Report")
        report.append(f"Generated for vault: {self.vault_path}")
        report.append(f"Total unique tags: {len(tag_files)}")
        report.append("")
        
        # Group tags by frequency
        tag_frequency = [(tag, len(files)) for tag, files in tag_files.items()]
        tag_frequency.sort(key=lambda x: x[1], reverse=True)
        
        report.append("## Current Tags by Frequency")
        for tag, count in tag_frequency:
            normalized = self.normalize_tag(tag)
            if normalized != tag:
                report.append(f"- `{tag}` ({count} files) → `{normalized}`")
            else:
                report.append(f"- `{tag}` ({count} files)")
        report.append("")
        
        # Suggest consolidations
        report.append("## Suggested Consolidations")
        consolidations = defaultdict(list)
        
        for tag, files in tag_files.items():
            normalized = self.normalize_tag(tag)
            if normalized != tag:
                consolidations[normalized].append((tag, len(files)))
        
        for normalized_tag, original_tags in consolidations.items():
            if len(original_tags) > 1:
                report.append(f"### {normalized_tag}")
                total_files = sum(count for _, count in original_tags)
                report.append(f"Total files: {total_files}")
                for original, count in original_tags:
                    report.append(f"- `{original}` ({count} files)")
                report.append("")
        
        return '\n'.join(report)
    
    def process_vault(self, dry_run=False):
        """Process all files in the vault."""
        skip_dirs = {'.obsidian', '.trash', 'System_Files', '.git'}
        
        for file_path in self.vault_path.rglob('*.md'):
            if any(skip_dir in file_path.parts for skip_dir in skip_dirs):
                continue
            
            self.files_processed += 1
            
            if self.process_file(file_path, dry_run):
                self.files_updated += 1
                if not dry_run:
                    print(f"Updated: {file_path.relative_to(self.vault_path)}")
        
        return {
            'processed': self.files_processed,
            'updated': self.files_updated,
            'tag_stats': dict(self.tag_stats)
        }

def main():
    parser = argparse.ArgumentParser(description='Standardize tags in Obsidian vault')
    parser.add_argument('--vault', default='/Users/cam/VAULT01',
                       help='Path to Obsidian vault')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be changed without making changes')
    parser.add_argument('--report', action='store_true',
                       help='Generate analysis report of current tags')
    parser.add_argument('--output', 
                       default='/Users/cam/VAULT01/System_Files/Tag_Analysis_Report.md',
                       help='Output file for report')
    
    args = parser.parse_args()
    
    standardizer = TagStandardizer(args.vault)
    
    if args.report:
        report = standardizer.generate_tag_report()
        
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"Tag analysis report saved to: {args.output}")
    
    else:
        print(f"Processing vault at: {args.vault}")
        print("Dry run mode" if args.dry_run else "Making changes")
        print("-" * 50)
        
        results = standardizer.process_vault(dry_run=args.dry_run)
        
        print("-" * 50)
        print(f"Files processed: {results['processed']}")
        print(f"Files updated: {results['updated']}")
        
        if results['tag_stats']:
            print("\nTop standardized tags:")
            for tag, count in Counter(results['tag_stats']).most_common(10):
                print(f"  {tag}: {count}")

if __name__ == '__main__':
    main()