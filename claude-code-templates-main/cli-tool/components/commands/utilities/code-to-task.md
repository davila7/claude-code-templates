# Convert Code Analysis to Linear Tasks

Convert code analysis to Linear tasks

## Purpose
This command scans your codebase for TODO/FIXME comments, technical debt markers, deprecated code, and other indicators that should be tracked as tasks. It automatically creates organized, prioritized Linear tasks to ensure important code improvements aren't forgotten.

## Usage
```bash
# Scan entire codebase for TODOs and create tasks
claude "Create tasks from all TODO comments in the codebase"

# Scan specific directory or module
claude "Find TODOs in src/api and create Linear tasks"

# Create tasks from specific patterns
claude "Create tasks for all deprecated functions"

# Generate technical debt report
claude "Analyze technical debt in the project and create improvement tasks"
```

## Instructions

### 1. Scan for Task Markers
Search for common patterns indicating needed work:

```bash
# Find TODO comments
rg "TODO|FIXME|HACK|XXX|OPTIMIZE|REFACTOR" --type-add 'code:*.{js,ts,py,java,go,rb,php}' -t code

# Find deprecated markers
rg "@deprecated|DEPRECATED|@obsolete" -t code

# Find temporary code
rg "TEMPORARY|TEMP|REMOVE BEFORE|DELETE ME" -t code -i

# Find technical debt markers
rg "TECHNICAL DEBT|TECH DEBT|REFACTOR|NEEDS REFACTORING" -t code -i

# Find security concerns
rg "SECURITY|INSECURE|VULNERABILITY|CVE-" -t code -i

# Find performance issues
rg "SLOW|PERFORMANCE|OPTIMIZE|BOTTLENECK" -t code -i
```

### 2. Parse Comment Context
Extract meaningful information from comments:

```javascript
class CommentParser {
  parseComment(file, lineNumber, comment) {
    const parsed = {
      type: 'todo',
      priority: 'medium',
      title: '',
      description: '',
      author: null,
      date: null,
      tags: [],
      code_context: '',
      file_path: file,
      line_number: lineNumber
    };
    
    // Detect comment type
    if (comment.match(/FIXME/i)) {
      parsed.type = 'fixme';
      parsed.priority = 'high';
    } else if (comment.match(/HACK|XXX/i)) {
      parsed.type = 'hack';
      parsed.priority = 'high';
    } else if (comment.match(/OPTIMIZE|PERFORMANCE/i)) {
      parsed.type = 'optimization';
    } else if (comment.match(/DEPRECATED/i)) {
      parsed.type = 'deprecation';
      parsed.priority = 'high';
    } else if (comment.match(/SECURITY/i)) {
      parsed.type = 'security';
      parsed.priority = 'urgent';
    }
    
    // Extract author and date
    const authorMatch = comment.match(/@(\w+)|by (\w+)/i);
    if (authorMatch) {
      parsed.author = authorMatch[1] || authorMatch[2];
    }
    
    const dateMatch = comment.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateMatch) {
      parsed.date = dateMatch[0];
    }
    
    // Extract title and description
    const cleanComment = comment
      .replace(/^\/\/\s*|^\/\*\s*|\*\/\s*$|^#\s*/g, '')
      .replace(/TODO|FIXME|HACK|XXX/i, '')
      .trim();
    
    const parts = cleanComment.split(/[:\-–—]/);
    if (parts.length > 1) {
      parsed.title = parts[0].trim();
      parsed.description = parts.slice(1).join(':').trim();
    } else {
      parsed.title = cleanComment;
    }
    
    // Extract tags
    const tagMatch = comment.match(/#(\w+)/g);
    if (tagMatch) {
      parsed.tags = tagMatch.map(tag => tag.substring(1));
    }
    
    return parsed;
  }
  
  getCodeContext(file, lineNumber, contextLines = 5) {
    const lines = readFileLines(file);
    const start = Math.max(0, lineNumber - contextLines);
    const end = Math.min(lines.length, lineNumber + contextLines);
    
    return lines.slice(start, end).map((line, i) => ({
      number: start + i + 1,
      content: line,
      isTarget: start + i + 1 === lineNumber
    }));
  }
}
```

### 3. Group and Deduplicate
Organize found issues intelligently:

```javascript
class TaskGrouper {
  groupTasks(parsedComments) {
    const groups = {
      byFile: new Map(),
      byType: new Map(),
      byAuthor: new Map(),
      byModule: new Map()
    };
    
    for (const comment of parsedComments) {
      // Group by file
      if (!groups.byFile.has(comment.file_path)) {
        groups.byFile.set(comment.file_path, []);
      }
      groups.byFile.get(comment.file_path).push(comment);
      
      // Group by type
      if (!groups.byType.has(comment.type)) {
        groups.byType.set(comment.type, []);
      }
      groups.byType.get(comment.type).push(comment);
      
      // Group by module
      const module = this.extractModule(comment.file_path);
      if (!groups.byModule.has(module)) {
        groups.byModule.set(module, []);
      }
      groups.byModule.get(module).push(comment);
    }
    
    return groups;
  }
  
  mergeSimilarTasks(tasks) {
    const merged = [];
    const seen = new Set();
    
    for (const task of tasks) {
      if (seen.has(task)) continue;
      
      // Find similar tasks
      const similar = tasks.filter(t => 
        t !== task &&
        !seen.has(t) &&
        this.areSimilar(task, t)
      );
      
      if (similar.length > 0) {
        // Merge into one task
        const mergedTask = {
          ...task,
          title: this.generateMergedTitle(task, similar),
          description: this.generateMergedDescription(task, similar),
          locations: [task, ...similar].map(t => ({
            file: t.file_path,
            line: t.line_number
          }))
        };
        merged.push(mergedTask);
        seen.add(task);
        similar.forEach(t => seen.add(t));
      } else {
        merged.push(task);
        seen.add(task);
      }
    }
    
    return merged;
  }
}
```

### 4. Analyze Technical Debt
Identify code quality issues:

```javascript
class TechnicalDebtAnalyzer {
  async analyzeFile(filePath) {
    const issues = [];
    const content = await readFile(filePath);
    const lines = content.split('\n');
    
    // Check for long functions
    const functionMatches = content.matchAll(/function\s+(\w+)|(\w+)\s*=\s*\(.*?\)\s*=>/g);
    for (const match of functionMatches) {
      const functionName = match[1] || match[2];
      const startLine = getLineNumber(content, match.index);
      const functionLength = this.getFunctionLength(lines, startLine);
      
      if (functionLength > 50) {
        issues.push({
          type: 'long_function',
          severity: functionLength > 100 ? 'high' : 'medium',
          title: `Refactor long function: ${functionName}`,
          description: `Function ${functionName} is ${functionLength} lines long. Consider breaking it into smaller functions.`,
          file_path: filePath,
          line_number: startLine
        });
      }
    }
    
    // Check for duplicate code
    const duplicates = await this.findDuplicateCode(filePath);
    for (const dup of duplicates) {
      issues.push({
        type: 'duplicate_code',
        severity: 'medium',
        title: 'Remove duplicate code',
        description: `Similar code found in ${dup.otherFile}:${dup.otherLine}`,
        file_path: filePath,
        line_number: dup.line
      });
    }
    
    // Check for complex conditionals
    const complexConditions = content.matchAll(/if\s*\([^)]{50,}\)/g);
    for (const match of complexConditions) {
      issues.push({
        type: 'complex_condition',
        severity: 'low',
        title: 'Simplify complex conditional',
        description: 'Consider extracting conditional logic into named variables or functions',
        file_path: filePath,
        line_number: getLineNumber(content, match.index)
      });
    }
    
    // Check for outdated dependencies
    if (filePath.endsWith('package.json')) {
      const outdated = await this.checkOutdatedDependencies(filePath);
      for (const dep of outdated) {
        issues.push({
          type: 'outdated_dependency',
          severity: dep.major ? 'high' : 'low',
          title: `Update ${dep.name} from ${dep.current} to ${dep.latest}`,
          description: dep.major ? 'Major version update available' : 'Minor update available',
          file_path: filePath
        });
      }
    }
    
    return issues;
  }
}
```

### 5. Create Linear Tasks
Convert findings into actionable tasks:

```javascript
async function createLinearTasks(groupedTasks, options = {}) {
  const created = [];
  const skipped = [];
  
  // Check for existing tasks to avoid duplicates
  const existingTasks = await linear.searchTasks('TODO OR FIXME');
  const existingTitles = new Set(existingTasks.map(t => t.title));
  
  // Create parent task for large groups
  if (options.createEpic && groupedTasks.length > 10) {
    const epic = await linear.createTask({
      title: `Technical Debt: ${options.module || 'Codebase'} Cleanup`,
      description: `Parent task for ${groupedTasks.length} code improvements`,
      priority: 2,
      labels: ['technical-debt', 'code-quality']
    });
    options.parentId = epic.id;
  }
  
  for (const task of groupedTasks) {
    // Skip if similar task exists
    if (existingTitles.has(task.title)) {
      skipped.push({ task, reason: 'duplicate' });
      continue;
    }
    
    // Build task description
    const description = buildTaskDescription(task);
    
    // Map priority
    const priorityMap = {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 4
    };
    
    try {
      const linearTask = await linear.createTask({
        title: task.title,
        description,
        priority: priorityMap[task.priority] || 3,
        labels: getLabelsForTask(task),
        parentId: options.parentId,
        estimate: estimateTaskSize(task)
      });
      
      created.push({
        linear: linearTask,
        source: task
      });
      
      // Add code link as comment
      await linear.createComment({
        issueId: linearTask.id,
        body: `📍 Code location: \`${task.file_path}:${task.line_number}\``
      });
      
    } catch (error) {
      skipped.push({ task, reason: error.message });
    }
  }
  
  return { created, skipped };
}

function buildTaskDescription(task) {
  let description = task.description || '';
  
  // Add code context
  if (task.code_context) {
    description += '\n\n### Code Context\n```\n';
    task.code_context.forEach(line => {
      const prefix = line.isTarget ? '>>> ' : '    ';
      description += `${prefix}${line.number}: ${line.content}\n`;
    });
    description += '```\n';
  }
  
  // Add metadata
  description += '\n\n### Details\n';
  description += `- **Type**: ${task.type}\n`;
  description += `- **File**: \`${task.file_path}\`\n`;
  description += `- **Line**: ${task.line_number}\n`;
  
  if (task.author) {
    description += `- **Author**: @${task.author}\n`;
  }
  if (task.date) {
    description += `- **Date**: ${task.date}\n`;
  }
  if (task.tags.length > 0) {
    description += `- **Tags**: ${task.tags.join(', ')}\n`;
  }
  
  // Add suggestions
  if (task.type === 'deprecated') {
    description += '\n### Suggested Actions\n';
    description += '1. Identify all usages of this deprecated code\n';
    description += '2. Update to use the recommended alternative\n';
    description += '3. Add deprecation warnings if not present\n';
    description += '4. Schedule for removal in next major version\n';
  }
  
  return description;
}
```

### 6. Generate Summary Report
Create overview of findings:

```javascript
function generateReport(scanResults, createdTasks) {
  const report = {
    summary: {
      totalFound: scanResults.length,
      tasksCreated: createdTasks.created.length,
      tasksSkipped: createdTasks.skipped.length,
      byType: {},
      byPriority: {},
      byFile: {}
    },
    details: [],
    recommendations: []
  };
  
  // Analyze distribution
  for (const result of scanResults) {
    report.summary.byType[result.type] = (report.summary.byType[result.type] || 0) + 1;
    report.summary.byPriority[result.priority] = (report.summary.byPriority[result.priority] || 0) + 1;
  }
  
  // Generate recommendations
  if (report.summary.byType.security > 0) {
    report.recommendations.push({
      priority: 'urgent',
      action: 'Address security-related TODOs immediately',
      tasks: scanResults.filter(r => r.type === 'security').length
    });
  }
  
  if (report.summary.byType.deprecated > 5) {
    report.recommendations.push({
      priority: 'high',
      action: 'Create deprecation removal sprint',
      tasks: report.summary.byType.deprecated
    });
  }
  
  return report;
}
```

### 7. Error Handling
```javascript
// Handle access errors
try {
  await scanDirectory(path);
} catch (error) {
  if (error.code === 'EACCES') {
    console.warn(`Skipping ${path} - permission denied`);
  }
}

// Handle Linear API limits
const rateLimiter = {
  tasksCreated: 0,
  resetTime: Date.now() + 3600000,
  
  async createTask(taskData) {
    if (this.tasksCreated >= 50) {
      console.log('Rate limit approaching, batching remaining tasks...');
      // Create single task with list of TODOs
      return this.createBatchTask(remainingTasks);
    }
    this.tasksCreated++;
    return linear.createTask(taskData);
  }
};

// Handle malformed comments
const safeParser = {
  parse(comment) {
    try {
      return this.parseComment(comment);
    } catch (error) {
      return {
        type: 'todo',
        title: comment.substring(0, 50) + '...',
        priority: 'low',
        parseError: true
      };
    }
  }
};
```

## Example Output

```
Scanning codebase for TODOs and technical debt...

📊 Scan Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 47 items across 23 files:
  • 24 TODOs
  • 8 FIXMEs 
  • 5 Deprecated functions
  • 3 Security concerns
  • 7 Performance optimizations

🔍 Breakdown by Priority:
  🔴 Urgent: 3 (security related)
  🟠 High: 13 (FIXMEs + deprecations)
  🟡 Medium: 24 (standard TODOs)
  🟢 Low: 7 (optimizations)

📁 Hotspot Files:
  1. src/api/auth.js - 8 items
  2. src/utils/validation.js - 6 items
  3. src/models/User.js - 5 items

🚨 Critical Findings:

1. SECURITY: Hardcoded API key
   File: src/config/api.js:45
   TODO: Remove hardcoded key and use env variable
   → Creating task with URGENT priority

2. DEPRECATED: Legacy authentication method
   File: src/api/auth.js:120
   Multiple usages found in 4 files
   → Creating migration task

3. FIXME: Race condition in concurrent updates
   File: src/services/sync.js:78
   Author: @alice (2024-01-03)
   → Creating high-priority bug task

📝 Task Creation Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Created 32 Linear tasks:
   - Epic: "Q1 Technical Debt Cleanup" (LIN-456)
   - 3 urgent security tasks
   - 10 high-priority fixes
   - 19 medium-priority improvements

⏭️ Skipped 15 items:
   - 8 duplicates (tasks already exist)
   - 4 low-value comments (e.g., "TODO: think about this")
   - 3 external dependencies (waiting on upstream)

📊 Estimates:
   - Total story points: 89
   - Estimated effort: 2-3 sprints
   - Recommended team size: 2-3 developers

🎯 Recommended Actions:
1. Schedule security sprint immediately (3 urgent items)
2. Assign deprecation removal to next sprint (5 items)
3. Create coding standards to reduce future TODOs
4. Set up pre-commit hook to limit new TODOs

View all created tasks:
https://linear.app/yourteam/project/q1-technical-debt-cleanup
```

## Advanced Features

### Custom Patterns
Define project-specific patterns:
```bash
# Add custom markers to scan
claude "Scan for REVIEW, QUESTION, and ASSUMPTION comments"
```

### Integration with CI/CD
```bash
# Fail build if critical TODOs found
claude "Check for SECURITY or FIXME comments and exit with error if found"
```

### Scheduled Scans
```bash
# Weekly technical debt report
claude "Generate weekly technical debt report and create tasks for new items"
```

## Tips
- Run regularly to prevent TODO accumulation
- Use consistent comment formats across the team
- Include author and date in TODOs
- Link TODOs to existing Linear issues when possible
- Set up IDE snippets for properly formatted TODOs
- Review and close completed TODO tasks
- Use TODO comments as a quality gate in PR reviews