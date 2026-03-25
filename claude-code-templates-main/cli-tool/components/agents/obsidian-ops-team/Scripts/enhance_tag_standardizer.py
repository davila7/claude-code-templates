#!/usr/bin/env python3
"""
Enhanced Tag Standardizer for hierarchical tag structure.
Consolidates similar tags and applies hierarchical organization.
"""

import os
import re
import yaml
from pathlib import Path
from collections import defaultdict, Counter

class EnhancedTagStandardizer:
    def __init__(self, vault_path):
        self.vault_path = Path(vault_path)
        self.files_updated = 0
        
        # Enhanced mappings for better consolidation
        self.enhanced_mappings = {
            # AI hierarchy consolidation
            'ai-development': 'ai/development',
            'ai-ideas': 'idea',  # Ideas are tracked with 'idea' tag
            'ai-tools': 'ai/tools',
            'ai-consulting': 'consulting',
            'ai-courses': 'learning/course',
            'ai-conferences-and-competitions': 'learning/conference',
            'ai-articles-and-research': 'ai/research',
            'ai-agent': 'ai/agents',
            'ai-community': 'community',
            'ai-integration': 'ai/development',
            'ai-services': 'ai/tools',
            
            # Business hierarchy
            'business-strategy': 'business/strategy',
            'business-development': 'business/development',
            'business-intelligence': 'business/analytics',
            'business-model': 'business/strategy',
            'business-automation': 'automation',
            'business-systems': 'business/systems',
            'business-case': 'business/strategy',
            'business-context': 'business',
            'business-research': 'business/research',
            'business-mapping': 'business/strategy',
            'business-report': 'business/analytics',
            'business-operations': 'business/operations',
            'business-plan': 'business/strategy',
            'business-transformation': 'business/strategy',
            'business-solutions': 'business/solutions',
            'business-assets': 'business/assets',
            
            # Client work standardization
            'client-work': 'client',
            'client-materials': 'client',
            'client-analytics': 'client',
            'client-communication': 'client',
            
            # Learning hierarchy
            'tutorial/course': 'learning/course',
            'learning-paths': 'learning',
            'courses': 'learning/course',
            'tutorials': 'tutorial',
            'guides': 'tutorial',
            'training': 'learning',
            'certifications': 'learning/certification',
            
            # Technical tags
            'development-tools': 'ai/tools',
            'tools': 'ai/tools',
            'apis': 'api',
            'api-integration': 'api',
            'api-testing': 'testing',
            
            # Content organization
            'daily-notes': 'daily',
            'daily-email': 'email',
            'email-summary': 'email',
            'email-processing': 'email',
            'email-marketing': 'marketing',
            
            # Web development
            'web-development': 'development',
            'web-presence': 'business/web-presence',
            '_web-presence-development': 'business/web-presence',
            
            # Personal tags
            '_personal_': 'personal',
            'personal-development': 'personal/development',
            
            # Project management
            'project-management': 'project',
            'project-timeline': 'project',
            
            # Marketing & content
            'content-strategy': 'marketing/content',
            'content-marketing': 'marketing/content',
            'content-calendar': 'marketing/calendar',
            'content-distribution': 'marketing/distribution',
            'marketing-strategy': 'marketing/strategy',
            
            # Technical infrastructure
            'it-infrastructure': 'infrastructure',
            'server-management': 'infrastructure',
            'server-setup': 'infrastructure',
            
            # Data and analytics
            'data-processing': 'data',
            'data-sources': 'data',
            'data-security': 'security',
            
            # Remove underscores from tags
            '_tutorials_': 'tutorial',
            '_business-formation_': 'business/formation',
            
            # Standardize compound words
            'meeting-notes': 'meeting',
            'meetings': 'meeting',
            
            # Standardize plural forms
            'agents': 'ai/agents',
            'templates': 'template',
            'projects': 'project',
            'tasks': 'action/todo',
            'sources': 'source',
            'systems': 'system',
            'solutions': 'solution',
            'recommendations': 'recommendation',
            'transcripts': 'transcript',
            'discussions': 'discussion',
            'platforms': 'platform',
            'frameworks': 'framework',
            'pipelines': 'pipeline',
            'servers': 'server',
            'summaries': 'summary',
            'conferences': 'conference',
            'opportunities': 'opportunity',
            'datasets': 'dataset',
            
            # Consolidate similar concepts
            'thought-leadership': 'authority-building',
            'technical-authority': 'authority-building',
            'brainstorming': 'idea',
            'strategic-planning': 'strategy',
            'strategic-decision-making': 'strategy',
            'strategic-overview': 'strategy',
            'strategic-connections': 'strategy',
            
            # Standardize vendor/tool names
            'anthropic_blog': 'anthropic',
            'anthropic_github': 'anthropic',
            'github_topic_-_mcp': 'mcp',
            'github_topic_-_mcp_server': 'mcp',
            'mcp_reddit': 'mcp',
            'mcp_documentation': 'mcp',
            'mcp_github_discussions': 'mcp',
            'mcp-server': 'mcp',
            'npm_-_mcp_packages': 'mcp',
            'dev.to_mcp_tag': 'mcp',
            'medium_-_mcp_topics': 'mcp',
            'pulsemcp_blog': 'pulsemcp',
            
            # Clean up system tags
            'system_files': 'system',
            'remote_vault01': 'remote-sync',
            
            # Consolidate database tags
            'graph-db': 'database',
            'graph-databases': 'database',
            'vector-databases': 'database',
            'database-queries': 'database',
            'database-updates': 'database',
            
            # Consolidate AI concepts
            'ai/rag': 'ai/embeddings',
            'agentic-rag': 'ai/embeddings',
            'knowledge-graph': 'graphrag',
            'knowledge-network': 'graphrag',
            'knowledge-management': 'knowledge-base',
            
            # Family tags
            'family-projects': 'family/projects',
            'family/index': 'family',
            
            # Visual content
            'visual-assets': 'visual-assets',
            'visual-organization': 'visual-assets',
            'visual-learning': 'visual-assets',
            'visual-search': 'visual-assets',
            'image-gallery': 'gallery',
            'image-generation': 'ai/tools',
            'screenshots': 'visual-assets',
            'screenshots-and-references': 'visual-assets',
            'infographics': 'visual-assets',
            'charts': 'visual-assets',
            'images': 'visual-assets',
            'snagit-captures': 'visual-assets',
            
            # Analytics and metrics
            'analytics': 'analytics',
            'client-analytics': 'analytics',
            'revenue-analytics': 'analytics',
            'performance-metrics': 'analytics',
            'financial-analysis': 'finance',
            'roi-analysis': 'roi',
            'roi-calculator': 'roi',
            
            # Simplify compound concepts
            'complexity-analysis': 'analysis',
            'connection-analysis': 'analysis',
            'network-analysis': 'analysis',
            'schema-analysis': 'analysis',
            'competitive-intelligence': 'analysis',
            'competitor-tracking': 'analysis',
            
            # Standardize workflow tags
            'workflow': 'workflows',
            
            # Clean up misc tags
            '--ollama-deep-research': 'ollama',
            'second-opinion-dds': 'dental',
            'austin-langchain': 'community',
            'the-build': 'build',
            'mcpcentral.io': 'mcpcentral',
        }
    
    def extract_frontmatter(self, content):
        """Extract YAML frontmatter from content."""
        if not content.strip().startswith('---'):
            return None, content
        
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
    
    def enhance_tag(self, tag):
        """Apply enhanced tag standardization."""
        # Remove leading/trailing whitespace
        tag = tag.strip()
        
        # Remove hash if present
        if tag.startswith('#'):
            tag = tag[1:]
        
        # Apply enhanced mappings
        if tag in self.enhanced_mappings:
            return self.enhanced_mappings[tag]
        
        # Default: lowercase and replace spaces with hyphens
        return tag.lower().replace(' ', '-')
    
    def process_file(self, file_path):
        """Process a single file with enhanced tag standardization."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            frontmatter, remaining_content = self.extract_frontmatter(content)
            
            if frontmatter is None or 'tags' not in frontmatter:
                return False
            
            # Get current tags
            current_tags = frontmatter.get('tags', [])
            if not current_tags:
                return False
            
            # Standardize tags
            if isinstance(current_tags, list):
                new_tags = []
                changed = False
                
                for tag in current_tags:
                    if isinstance(tag, str):
                        enhanced = self.enhance_tag(tag)
                        if enhanced != tag:
                            changed = True
                        if enhanced and enhanced not in new_tags:
                            new_tags.append(enhanced)
                
                if changed:
                    # Update frontmatter
                    frontmatter['tags'] = new_tags
                    
                    # Reconstruct content
                    new_frontmatter = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
                    new_content = f"---\n{new_frontmatter}---\n{remaining_content}"
                    
                    # Write back to file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    
                    print(f"Enhanced: {file_path.relative_to(self.vault_path)}")
                    return True
            
            return False
            
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return False
    
    def process_vault(self):
        """Process all files in the vault."""
        skip_dirs = {'.obsidian', '.trash', '.git'}
        
        for file_path in self.vault_path.rglob('*.md'):
            if any(skip_dir in file_path.parts for skip_dir in skip_dirs):
                continue
            
            if self.process_file(file_path):
                self.files_updated += 1
        
        return self.files_updated

def main():
    vault_path = '/Users/cam/VAULT01'
    print(f"Enhanced tag standardization for: {vault_path}")
    print("This will consolidate similar tags and apply hierarchical organization")
    print("-" * 60)
    
    standardizer = EnhancedTagStandardizer(vault_path)
    updated = standardizer.process_vault()
    
    print("-" * 60)
    print(f"Total files updated: {updated}")

if __name__ == '__main__':
    main()