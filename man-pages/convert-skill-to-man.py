#!/usr/bin/env python3
"""
Convert Claude Code SKILL.md files to Linux man page format.
"""

import re
import sys
import os
from pathlib import Path
from datetime import datetime
import argparse


def parse_yaml_frontmatter(content):
    """Extract YAML front matter from markdown."""
    if not content.startswith('---'):
        return {}, content
    
    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}, content
    
    yaml_content = parts[1].strip()
    markdown_content = parts[2].strip()
    
    metadata = {}
    for line in yaml_content.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            metadata[key.strip()] = value.strip()
    
    return metadata, markdown_content


def markdown_to_man(text):
    """Convert markdown formatting to man page macros."""
    # Convert headers
    text = re.sub(r'^# (.+)$', r'.SH \1', text, flags=re.MULTILINE)
    text = re.sub(r'^## (.+)$', r'.SS \1', text, flags=re.MULTILINE)
    text = re.sub(r'^### (.+)$', r'.SS \1', text, flags=re.MULTILINE)
    
    # Convert code blocks to .EX/.EE (example blocks)
    def convert_code_block(match):
        lang = match.group(1) if match.group(1) else ''
        code = match.group(2)
        return f'.EX\n{code}\n.EE'
    
    text = re.sub(r'```(\w*)\n(.*?)\n```', convert_code_block, text, flags=re.DOTALL)
    
    # Convert inline code to bold
    text = re.sub(r'`([^`]+)`', r'\\fB\1\\fR', text)
    
    # Convert bold
    text = re.sub(r'\*\*([^*]+)\*\*', r'\\fB\1\\fR', text)
    
    # Convert italic
    text = re.sub(r'\*([^*]+)\*', r'\\fI\1\\fR', text)
    text = re.sub(r'_([^_]+)_', r'\\fI\1\\fR', text)
    
    # Convert bullet lists
    lines = text.split('\n')
    result = []
    in_list = False
    
    for line in lines:
        # Bullet list items
        if re.match(r'^[-*]\s+', line):
            if not in_list:
                result.append('.RS')
                in_list = True
            item = re.sub(r'^[-*]\s+', '', line)
            result.append(f'.IP \\(bu 2')
            result.append(item)
        # Numbered list items
        elif re.match(r'^\d+\.\s+', line):
            if not in_list:
                result.append('.RS')
                in_list = True
            item = re.sub(r'^\d+\.\s+', '', line)
            num = re.match(r'^(\d+)\.', line).group(1)
            result.append(f'.IP {num}. 3')
            result.append(item)
        else:
            if in_list and line.strip() and not line.startswith(' '):
                result.append('.RE')
                in_list = False
            result.append(line)
    
    if in_list:
        result.append('.RE')
    
    return '\n'.join(result)


def convert_skill_to_man(skill_path, output_path=None, prefix='skill'):
    """Convert a SKILL.md file to man page format."""
    with open(skill_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse YAML front matter
    metadata, markdown = parse_yaml_frontmatter(content)
    
    skill_name = metadata.get('name', os.path.basename(os.path.dirname(skill_path)))
    description = metadata.get('description', '')
    
    # Create man page name
    man_name = f"{prefix}-{skill_name}".upper().replace(' ', '-')
    man_command = f"{prefix}-{skill_name}".lower().replace(' ', '-')
    
    # Generate man page header
    date = datetime.now().strftime('%B %Y')
    man_content = f'''.TH {man_name} 1 "{date}" "Claude Code Templates" "Skills Manual"
.SH NAME
{man_command} \\- {description}
'''
    
    # Convert markdown to man format
    man_body = markdown_to_man(markdown)
    
    # Clean up section names for man page conventions
    man_body = man_body.replace('.SH Quick Start', '.SH SYNOPSIS')
    man_body = man_body.replace('.SH Quick start', '.SH SYNOPSIS')
    man_body = man_body.replace('.SH When to Use This Skill', '.SH DESCRIPTION')
    man_body = man_body.replace('.SH What This Skill Does', '.SH DESCRIPTION')
    man_body = man_body.replace('.SH How to Use', '.SH EXAMPLES')
    man_body = man_body.replace('.SH Examples', '.SH EXAMPLES')
    man_body = man_body.replace('.SH Common Commands', '.SH EXAMPLES')
    man_body = man_body.replace('.SH Resources', '.SH SEE ALSO')
    man_body = man_body.replace('.SH Related Use Cases', '.SH SEE ALSO')
    
    # Uppercase section headers
    man_body = re.sub(r'^\.SH ([A-Za-z ]+)', lambda m: f'.SH {m.group(1).upper()}', man_body, flags=re.MULTILINE)
    
    man_content += man_body
    
    # Add footer
    man_content += f'''
.SH AUTHOR
Claude Code Templates contributors
.SH REPORTING BUGS
Report bugs at: https://github.com/davila7/claude-code-templates/issues
.SH COPYRIGHT
Copyright © 2024 Claude Code Templates. License MIT.
.SH SEE ALSO
Full documentation at: https://docs.aitmpl.com/
'''
    
    # Determine output path
    if output_path is None:
        output_path = f"man1/{man_command}.1"
    
    # Write man page
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(man_content)
    
    print(f"Created: {output_file}")
    return str(output_file)


def main():
    parser = argparse.ArgumentParser(
        description='Convert Claude Code SKILL.md files to Linux man pages'
    )
    parser.add_argument('skill_path', help='Path to SKILL.md file')
    parser.add_argument('-o', '--output', help='Output path for man page')
    parser.add_argument('-p', '--prefix', default='skill', help='Prefix for man page name (default: skill)')
    parser.add_argument('--compress', action='store_true', help='Compress output with gzip')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.skill_path):
        print(f"Error: File not found: {args.skill_path}", file=sys.stderr)
        sys.exit(1)
    
    output_path = convert_skill_to_man(args.skill_path, args.output, args.prefix)
    
    if args.compress:
        import gzip
        import shutil
        with open(output_path, 'rb') as f_in:
            with gzip.open(f"{output_path}.gz", 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        os.remove(output_path)
        print(f"Compressed: {output_path}.gz")


if __name__ == '__main__':
    main()

