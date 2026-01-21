#!/usr/bin/env python3
"""
Generate a lightweight agents API endpoint from components.json
This creates docs/api/agents.json for the CLI tool to use
"""

import json
import os

def generate_agents_api():
    """Generate the agents API file from components.json"""
    
    # Read the components.json file
    components_path = 'docs/components.json'
    output_path = 'docs/api/agents.json'
    
    if not os.path.exists(components_path):
        print(f"Error: {components_path} not found")
        return False
    
    try:
        with open(components_path, 'r', encoding='utf-8') as f:
            components_data = json.load(f)
        
        # Extract agents and format them for the API
        agents = []
        if 'agents' in components_data:
            for agent in components_data['agents']:
                # Extract category from path
                path_parts = agent['path'].split('/')
                category = path_parts[0] if len(path_parts) > 1 else 'root'
                name = path_parts[-1]
                
                # Remove .md extension from name if present
                if name.endswith('.md'):
                    name = name[:-3]
                
                agents.append({
                    'name': name,
                    'path': agent['path'].replace('.md', ''),  # Remove .md from path too
                    'category': category,
                    'description': agent.get('description', '')[:100]  # Truncate description for size
                })
        
        # Create output directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Write the API file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({
                'agents': agents,
                'version': '1.0.0',
                'total': len(agents)
            }, f, indent=2)
        
        print(f"✅ Generated agents API with {len(agents)} agents")
        print(f"📄 Output: {output_path}")
        return True
        
    except Exception as e:
        print(f"Error generating agents API: {e}")
        return False

if __name__ == '__main__':
    generate_agents_api()