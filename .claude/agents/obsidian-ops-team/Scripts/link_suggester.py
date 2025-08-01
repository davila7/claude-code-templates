#!/usr/bin/env python3
"""
Link Suggester for Obsidian Vault
Identifies potential connections between notes based on content analysis.
"""

import os
import re
from pathlib import Path
from collections import defaultdict, Counter
import argparse
import json

class LinkSuggester:
    def __init__(self, vault_path):
        self.vault_path = Path(vault_path)
        self.notes = {}
        self.entity_mentions = defaultdict(set)
        self.potential_links = []
        
        # Common entities to look for
        self.entities = {
            'technologies': [
                'langchain', 'langgraph', 'mcp', 'model context protocol',
                'graphrag', 'openai', 'anthropic', 'claude', 'gpt', 'llm',
                'ollama', 'huggingface', 'github', 'python', 'javascript',
                'cloudflare', 'supabase', 'vector database', 'embedding',
                'ai agent', 'autonomous agent', 'rag', 'retrieval augmented'
            ],
            'concepts': [
                'machine learning', 'deep learning', 'neural network',
                'transformer', 'attention mechanism', 'fine-tuning',
                'prompt engineering', 'chain of thought', 'reasoning',
                'multimodal', 'text generation', 'code generation',
                'tool use', 'function calling', 'api integration'
            ],
            'companies': [
                'google', 'microsoft', 'amazon', 'meta', 'apple',
                'nvidia', 'intel', 'amd', 'tesla', 'stripe',
                'y combinator', 'techstars', 'propel', 'dental'
            ],
            'people': [
                'andrew ng', 'geoffrey hinton', 'yann lecun', 'ilya sutskever',
                'sam altman', 'dario amodei', 'demis hassabis', 'jensen huang'
            ]
        }
        
        # Flatten entities for easier searching
        self.all_entities = []
        for category, entities in self.entities.items():
            self.all_entities.extend(entities)
    
    def load_notes(self):
        """Load all markdown files and their content."""
        skip_dirs = {'.obsidian', '.trash', 'System_Files', '.git'}
        
        for file_path in self.vault_path.rglob('*.md'):
            if any(skip_dir in file_path.parts for skip_dir in skip_dirs):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract title
                title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                title = title_match.group(1) if title_match else file_path.stem
                
                # Extract existing links
                existing_links = set(re.findall(r'\[\[([^\]]+)\]\]', content))
                
                self.notes[file_path] = {
                    'title': title,
                    'content': content.lower(),
                    'existing_links': existing_links,
                    'word_count': len(content.split())
                }
                
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
    
    def find_entity_mentions(self):
        """Find mentions of entities across all notes."""
        for file_path, note_data in self.notes.items():
            content = note_data['content']
            
            for entity in self.all_entities:
                if entity in content:
                    self.entity_mentions[entity].add(file_path)
    
    def suggest_links_by_entities(self):
        """Suggest links based on common entity mentions."""
        suggestions = []
        
        for entity, files in self.entity_mentions.items():
            if len(files) >= 2:  # Entity mentioned in at least 2 files
                file_list = list(files)
                
                for i, file1 in enumerate(file_list):
                    for file2 in file_list[i+1:]:
                        # Check if files don't already link to each other
                        note1 = self.notes[file1]
                        note2 = self.notes[file2]
                        
                        if (note2['title'] not in note1['existing_links'] and
                            note1['title'] not in note2['existing_links']):
                            
                            suggestions.append({
                                'file1': file1,
                                'file2': file2,
                                'title1': note1['title'],
                                'title2': note2['title'],
                                'common_entity': entity,
                                'type': 'entity_mention',
                                'confidence': len(files) / 10  # Simple confidence score
                            })
        
        return suggestions
    
    def suggest_links_by_keywords(self):
        """Suggest links based on keyword overlap."""
        suggestions = []
        
        # Extract keywords from titles and content
        for file_path, note_data in self.notes.items():
            if note_data['word_count'] < 100:  # Skip very short notes
                continue
            
            # Get keywords from title
            title_words = set(re.findall(r'\b\w{4,}\b', note_data['title'].lower()))
            
            # Find other notes with similar keywords
            for other_path, other_data in self.notes.items():
                if file_path == other_path:
                    continue
                
                other_title_words = set(re.findall(r'\b\w{4,}\b', other_data['title'].lower()))
                
                # Check for keyword overlap
                common_words = title_words.intersection(other_title_words)
                if len(common_words) >= 2:  # At least 2 common significant words
                    
                    # Check if files don't already link to each other
                    if (other_data['title'] not in note_data['existing_links'] and
                        note_data['title'] not in other_data['existing_links']):
                        
                        suggestions.append({
                            'file1': file_path,
                            'file2': other_path,
                            'title1': note_data['title'],
                            'title2': other_data['title'],
                            'common_words': list(common_words),
                            'type': 'keyword_overlap',
                            'confidence': len(common_words) / 5
                        })
        
        return suggestions
    
    def find_orphaned_notes(self):
        """Find notes with no incoming or outgoing links."""
        orphaned = []
        
        for file_path, note_data in self.notes.items():
            if len(note_data['existing_links']) == 0:
                # Check if any other notes link to this one
                mentioned_in = []
                for other_path, other_data in self.notes.items():
                    if note_data['title'] in other_data['existing_links']:
                        mentioned_in.append(other_path)
                
                if not mentioned_in:
                    orphaned.append({
                        'file': file_path,
                        'title': note_data['title'],
                        'word_count': note_data['word_count']
                    })
        
        return orphaned
    
    def analyze_vault(self):
        """Perform complete analysis of the vault."""
        print("Loading notes...")
        self.load_notes()
        print(f"Loaded {len(self.notes)} notes")
        
        print("Finding entity mentions...")
        self.find_entity_mentions()
        
        print("Generating link suggestions...")
        entity_suggestions = self.suggest_links_by_entities()
        keyword_suggestions = self.suggest_links_by_keywords()
        orphaned_notes = self.find_orphaned_notes()
        
        return {
            'entity_suggestions': entity_suggestions,
            'keyword_suggestions': keyword_suggestions,
            'orphaned_notes': orphaned_notes,
            'stats': {
                'total_notes': len(self.notes),
                'entity_suggestions': len(entity_suggestions),
                'keyword_suggestions': len(keyword_suggestions),
                'orphaned_notes': len(orphaned_notes)
            }
        }
    
    def generate_report(self, results, output_file=None):
        """Generate a human-readable report."""
        report = []
        
        report.append("# Link Suggestions Report")
        report.append(f"Generated for vault: {self.vault_path}")
        report.append(f"Total notes analyzed: {results['stats']['total_notes']}")
        report.append("")
        
        # Entity-based suggestions
        report.append("## Entity-Based Link Suggestions")
        report.append(f"Found {len(results['entity_suggestions'])} potential connections")
        report.append("")
        
        # Group by entity
        entity_groups = defaultdict(list)
        for suggestion in results['entity_suggestions']:
            entity_groups[suggestion['common_entity']].append(suggestion)
        
        for entity, suggestions in sorted(entity_groups.items()):
            report.append(f"### {entity.title()}")
            for suggestion in suggestions[:5]:  # Top 5 per entity
                report.append(f"- [[{suggestion['title1']}]] ↔ [[{suggestion['title2']}]]")
            report.append("")
        
        # Keyword-based suggestions
        report.append("## Keyword-Based Link Suggestions")
        report.append(f"Found {len(results['keyword_suggestions'])} potential connections")
        report.append("")
        
        # Sort by confidence
        sorted_keywords = sorted(results['keyword_suggestions'], 
                               key=lambda x: x['confidence'], reverse=True)
        
        for suggestion in sorted_keywords[:20]:  # Top 20
            common_words = ', '.join(suggestion['common_words'])
            report.append(f"- [[{suggestion['title1']}]] ↔ [[{suggestion['title2']}]]")
            report.append(f"  Common words: {common_words}")
            report.append("")
        
        # Orphaned notes
        report.append("## Orphaned Notes (No Links)")
        report.append(f"Found {len(results['orphaned_notes'])} notes with no connections")
        report.append("")
        
        # Sort by word count (longer notes first)
        sorted_orphaned = sorted(results['orphaned_notes'], 
                               key=lambda x: x['word_count'], reverse=True)
        
        for note in sorted_orphaned[:30]:  # Top 30
            report.append(f"- [[{note['title']}]] ({note['word_count']} words)")
        
        report_text = '\n'.join(report)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(report_text)
            print(f"Report saved to: {output_file}")
        
        return report_text

def main():
    parser = argparse.ArgumentParser(description='Suggest links for Obsidian vault')
    parser.add_argument('--vault', default='/Users/cam/VAULT01',
                       help='Path to Obsidian vault')
    parser.add_argument('--output', 
                       default='/Users/cam/VAULT01/System_Files/Link_Suggestions_Report.md',
                       help='Output file for report')
    parser.add_argument('--json', 
                       help='Output JSON file for programmatic use')
    
    args = parser.parse_args()
    
    suggester = LinkSuggester(args.vault)
    results = suggester.analyze_vault()
    
    # Generate report
    report = suggester.generate_report(results, args.output)
    
    # Save JSON if requested
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"JSON data saved to: {args.json}")
    
    # Print summary
    print("\n" + "="*50)
    print("LINK SUGGESTIONS SUMMARY")
    print("="*50)
    print(f"Total notes: {results['stats']['total_notes']}")
    print(f"Entity-based suggestions: {results['stats']['entity_suggestions']}")
    print(f"Keyword-based suggestions: {results['stats']['keyword_suggestions']}")
    print(f"Orphaned notes: {results['stats']['orphaned_notes']}")

if __name__ == '__main__':
    main()