#!/usr/bin/env python3
"""
Daily Notes Connectivity Agent
Analyzes daily notes and creates meaningful connections between them and other vault content.
"""

import os
import re
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
import json

class DailyNotesConnector:
    def __init__(self, vault_path):
        self.vault_path = Path(vault_path)
        self.connections_made = 0
        self.notes_processed = 0
        self.patterns = {
            'project': r'(?:project|AI IDEAS|idea|experiment|build|develop)',
            'meeting': r'(?:meeting|call|discussion|client|consultation)',
            'technical': r'(?:MCP|LangChain|GraphRAG|AI|ML|model|agent|tool)',
            'client': r'(?:client|consulting|business|CamRohn)',
            'personal': r'(?:family|personal|reflection|stoic|goal)',
            'research': r'(?:research|paper|study|article|documentation)',
            'community': r'(?:Austin|LangChain|meetup|community|conference)'
        }
        self.connection_map = defaultdict(list)
        
    def find_daily_notes(self):
        """Find all daily notes across the vault."""
        daily_notes = []
        
        # Search patterns for daily notes
        patterns = [
            self.vault_path / "Daily Notes" / "*.md",
            self.vault_path / "REMOTE_VAULT01" / "Daily Notes" / "*.md",
            self.vault_path / "Daily Email" / "*.md",
            self.vault_path / "_PERSONAL_" / "JOURNAL" / "**" / "*.md"
        ]
        
        for pattern in patterns:
            for file_path in self.vault_path.glob(str(pattern).split(str(self.vault_path) + "/")[1]):
                # Check if filename matches date pattern
                if re.match(r'\d{4}-\d{2}-\d{2}', file_path.stem):
                    daily_notes.append(file_path)
                    
        return sorted(daily_notes)
    
    def extract_frontmatter(self, file_path):
        """Extract frontmatter from a markdown file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if content.startswith('---'):
            try:
                end_index = content.index('---', 3)
                frontmatter_text = content[3:end_index].strip()
                return yaml.safe_load(frontmatter_text), content[end_index+3:]
            except:
                return {}, content
        return {}, content
    
    def update_frontmatter(self, file_path, frontmatter, body):
        """Update the frontmatter of a file."""
        yaml_content = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
        new_content = f"---\n{yaml_content}---\n{body}"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    
    def analyze_content(self, content):
        """Analyze content to identify topics and themes."""
        content_lower = content.lower()
        topics = defaultdict(int)
        
        for topic, pattern in self.patterns.items():
            matches = re.findall(pattern, content_lower)
            topics[topic] = len(matches)
            
        # Extract specific mentions
        mentions = {
            'projects': re.findall(r'\[\[([^]]+)\]\]', content),
            'headers': re.findall(r'^#+\s+(.+)$', content, re.MULTILINE),
            'urls': re.findall(r'https?://[^\s\]]+', content),
            'tags': re.findall(r'#(\w+)', content)
        }
        
        return topics, mentions
    
    def find_related_content(self, topics, mentions, current_file):
        """Find related content based on topics and mentions."""
        related = []
        
        # Map topics to vault directories
        topic_dirs = {
            'project': ['AI IDEAS', 'AI Development'],
            'meeting': ['CamRohn LLC/Client Work', 'Austin LangChain'],
            'technical': ['AI Development', 'Model Context Protocol (MCP)'],
            'client': ['CamRohn LLC', 'Second Opinion DDS'],
            'research': ['AI Articles and Research', 'Clippings'],
            'community': ['Austin LangChain', 'AI Conferences and Competitions']
        }
        
        # Find files based on dominant topics
        for topic, count in sorted(topics.items(), key=lambda x: x[1], reverse=True):
            if count > 0 and topic in topic_dirs:
                for dir_name in topic_dirs[topic]:
                    dir_path = self.vault_path / dir_name
                    if dir_path.exists():
                        # Add MOC if exists
                        moc_path = dir_path / f"MOC - {dir_name.split('/')[-1]}.md"
                        if moc_path.exists():
                            related.append((moc_path, f"{topic} reference"))
                        
                        # Add specific mentioned files
                        for mention in mentions['projects']:
                            if dir_name in mention:
                                file_path = self.vault_path / f"{mention}.md"
                                if file_path.exists() and file_path != current_file:
                                    related.append((file_path, "direct mention"))
        
        return related[:10]  # Limit to top 10 connections
    
    def find_temporal_connections(self, file_path, all_notes):
        """Find temporal connections (previous/next days, weekly summaries)."""
        temporal = []
        
        # Extract date from filename
        date_match = re.match(r'(\d{4})-(\d{2})-(\d{2})', file_path.stem)
        if not date_match:
            return temporal
            
        current_date = datetime(int(date_match.group(1)), 
                                int(date_match.group(2)), 
                                int(date_match.group(3)))
        
        # Find previous and next days
        for days_offset in [-1, 1]:
            target_date = current_date + timedelta(days=days_offset)
            target_str = target_date.strftime('%Y-%m-%d')
            
            for note in all_notes:
                if target_str in note.stem:
                    temporal.append((note, f"{'Previous' if days_offset < 0 else 'Next'} day"))
                    break
        
        # Find weekly connections (same week)
        week_start = current_date - timedelta(days=current_date.weekday())
        week_end = week_start + timedelta(days=6)
        
        for note in all_notes:
            date_match = re.match(r'(\d{4})-(\d{2})-(\d{2})', note.stem)
            if date_match:
                note_date = datetime(int(date_match.group(1)), 
                                     int(date_match.group(2)), 
                                     int(date_match.group(3)))
                if week_start <= note_date <= week_end and note != file_path:
                    temporal.append((note, "Same week"))
        
        return temporal
    
    def process_daily_note(self, file_path, all_notes):
        """Process a single daily note and add connections."""
        print(f"Processing: {file_path.relative_to(self.vault_path)}")
        
        frontmatter, body = self.extract_frontmatter(file_path)
        topics, mentions = self.analyze_content(body)
        
        # Find related content
        content_related = self.find_related_content(topics, mentions, file_path)
        temporal_related = self.find_temporal_connections(file_path, all_notes)
        
        # Build related list
        new_related = []
        
        # Add temporal connections first
        for related_file, relation_type in temporal_related:
            if "Previous" in relation_type or "Next" in relation_type:
                relative_path = related_file.relative_to(self.vault_path)
                link = f"[[{relative_path.with_suffix('').as_posix()}]]"
                if relation_type == "Previous day":
                    new_related.insert(0, f"{link} # {relation_type}")
                else:
                    new_related.append(f"{link} # {relation_type}")
        
        # Add content-based connections
        for related_file, relation_type in content_related:
            relative_path = related_file.relative_to(self.vault_path)
            link = f"[[{relative_path.with_suffix('').as_posix()}]]"
            comment = f" # {relation_type.title()}"
            new_related.append(f"{link}{comment}")
        
        # Update frontmatter if we found new connections
        if new_related:
            existing_related = frontmatter.get('related', [])
            if isinstance(existing_related, list):
                # Merge and deduplicate - convert lists to strings for deduplication
                combined = existing_related + new_related
                seen = set()
                all_related = []
                for item in combined:
                    if item not in seen:
                        seen.add(item)
                        all_related.append(item)
            else:
                all_related = new_related
            
            frontmatter['related'] = all_related
            self.update_frontmatter(file_path, frontmatter, body)
            self.connections_made += len(new_related)
            
        self.notes_processed += 1
        
        # Track patterns for reporting
        for topic, count in topics.items():
            if count > 0:
                self.connection_map[topic].append(file_path.stem)
    
    def generate_report(self):
        """Generate a report of connections made."""
        report = f"""# Daily Notes Connectivity Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}

## Summary
- Total daily notes processed: {self.notes_processed}
- Total connections created: {self.connections_made}
- Average connections per note: {self.connections_made / max(self.notes_processed, 1):.1f}

## Connection Patterns Discovered

"""
        
        for topic, dates in self.connection_map.items():
            if dates:
                report += f"### {topic.title()} Topics\n"
                report += f"Found in {len(dates)} daily notes:\n"
                # Show recent examples
                for date in sorted(dates)[-5:]:
                    report += f"- [[{date}]]\n"
                report += "\n"
        
        report += """## Themes Across Time Periods

### Recent Trends (Last 30 days)
"""
        
        # Analyze recent trends
        recent_date = datetime.now() - timedelta(days=30)
        recent_topics = defaultdict(int)
        
        for topic, dates in self.connection_map.items():
            for date_str in dates:
                try:
                    date_match = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_str)
                    if date_match:
                        note_date = datetime(int(date_match.group(1)), 
                                             int(date_match.group(2)), 
                                             int(date_match.group(3)))
                        if note_date >= recent_date:
                            recent_topics[topic] += 1
                except:
                    pass
        
        for topic, count in sorted(recent_topics.items(), key=lambda x: x[1], reverse=True):
            report += f"- **{topic.title()}**: {count} occurrences\n"
        
        report += "\n## Recommendations\n\n"
        report += "1. Consider creating weekly/monthly summary notes to consolidate themes\n"
        report += "2. Review orphaned daily notes that lack connections\n"
        report += "3. Add more content to empty daily notes for better connectivity\n"
        
        return report
    
    def run(self):
        """Main execution method."""
        print("Daily Notes Connectivity Agent Starting...")
        print(f"Vault path: {self.vault_path}")
        
        # Find all daily notes
        daily_notes = self.find_daily_notes()
        print(f"Found {len(daily_notes)} daily notes")
        
        # Process each note
        for note in daily_notes:
            try:
                self.process_daily_note(note, daily_notes)
            except Exception as e:
                print(f"Error processing {note}: {e}")
        
        # Generate and save report
        report = self.generate_report()
        report_path = self.vault_path / "System_Files" / "Daily_Notes_Connectivity_Report.md"
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"\nComplete! Report saved to: {report_path}")
        print(f"Processed {self.notes_processed} notes, created {self.connections_made} connections")

if __name__ == "__main__":
    vault_path = "/Users/cam/VAULT01"
    connector = DailyNotesConnector(vault_path)
    connector.run()