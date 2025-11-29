# Gemini CLI Prompt Templates

Reusable prompt templates for common operations.

## Code Generation

### Single-File Application
```bash
gemini "Create a [description] with [features]. Include [requirements]. Output the complete file content." --yolo -o text
```

**Example:**
```bash
gemini "Create a single-file HTML/CSS/JS calculator with: basic operations, history display, keyboard support, dark mode toggle, responsive design. Output the complete file content." --yolo -o text
```

### Multi-File Project
```bash
gemini "Create a [project type] with [stack]. Include [features]. Create all necessary files and make it runnable. Use modern best practices. START BUILDING NOW." --yolo -o text
```

**Example:**
```bash
gemini "Create a REST API with Express, SQLite, and JWT auth. Include user CRUD, input validation, error handling. Create all necessary files and make it runnable. START BUILDING NOW." --yolo -o text
```

### Component/Module
```bash
gemini "Create a [component type] that [functionality]. Follow [standards]. Include [requirements]. Output the code." --yolo -o text
```

**Example:**
```bash
gemini "Create a React hook useLocalStorage that syncs state with localStorage. Follow React 18 best practices. Include TypeScript types. Output the code." --yolo -o text
```

## Code Review

### Comprehensive Review
```bash
gemini "Review [file] and tell me:
1) What features it has
2) Any bugs or security issues
3) Suggestions for improvement
4) Code quality assessment" -o text
```

### Security-Focused Review
```bash
gemini "Review [file] for security vulnerabilities including:
- XSS (cross-site scripting)
- SQL injection
- Command injection
- Insecure data handling
- Authentication issues
Report findings with severity levels." -o text
```

### Performance Review
```bash
gemini "Analyze [file] for performance issues:
- Inefficient algorithms
- Memory leaks
- Unnecessary re-renders
- Blocking operations
- Optimization opportunities
Provide specific recommendations." -o text
```

## Bug Fixing

### Fix Identified Bugs
```bash
gemini "Fix these bugs in [file]:
1) [Bug description]
2) [Bug description]
3) [Bug description]
Apply fixes now." --yolo -o text
```

### Auto-Detect and Fix
```bash
gemini "Analyze [file] for bugs, then fix all issues you find. Apply fixes immediately." --yolo -o text
```

## Test Generation

### Unit Tests
```bash
gemini "Generate [framework] unit tests for [file]. Cover:
- All public functions
- Edge cases
- Error handling
- [Specific areas]
Output the complete test file." --yolo -o text
```

**Example:**
```bash
gemini "Generate Jest unit tests for utils.js. Cover:
- All exported functions
- Edge cases (empty input, null, undefined)
- Error handling
- Boundary conditions
Output the complete test file." --yolo -o text
```

### Integration Tests
```bash
gemini "Generate integration tests for [component/API]. Test:
- Happy path scenarios
- Error scenarios
- Edge cases
Use [framework]. Output complete test file." --yolo -o text
```

## Documentation

### JSDoc/TSDoc
```bash
gemini "Generate [JSDoc/TSDoc] documentation for all functions in [file]. Include:
- Function descriptions
- Parameter types and descriptions
- Return types and descriptions
- Usage examples
Output as [format]." --yolo -o text
```

### README Generation
```bash
gemini "Generate a README.md for this project. Include:
- Project description
- Installation instructions
- Usage examples
- API reference
- Contributing guidelines
Use the codebase to gather accurate information." --yolo -o text
```

### API Documentation
```bash
gemini "Document all API endpoints in [file/directory]. Include:
- HTTP method and path
- Request parameters
- Request body schema
- Response schema
- Example requests/responses
Output in [Markdown/OpenAPI] format." --yolo -o text
```

## Code Transformation

### Refactoring
```bash
gemini "Refactor [file] to:
- [Specific improvement]
- [Specific improvement]
Maintain all existing functionality. Apply changes now." --yolo -o text
```

### Language Translation
```bash
gemini "Translate [file] from [source language] to [target language]. Maintain:
- Same functionality
- Similar code structure
- Idiomatic patterns for target language
Output the translated code." --yolo -o text
```

### Framework Migration
```bash
gemini "Convert [file] from [old framework] to [new framework]. Maintain all functionality. Use [new framework] best practices. Output the converted code." --yolo -o text
```

## Web Research

### Current Information
```bash
gemini "What are the latest [topic] as of [date]? Use Google Search to find current information. Summarize key points." -o text
```

### Library/API Research
```bash
gemini "Research [library/API] and provide:
- Latest version and changes
- Best practices
- Common patterns
- Gotchas to avoid
Use Google Search for current information." -o text
```

### Comparison Research
```bash
gemini "Compare [option A] vs [option B] for [use case]. Use Google Search for current benchmarks and community opinions. Provide recommendation." -o text
```

## Architecture Analysis

### Project Analysis
```bash
gemini "Use the codebase_investigator tool to analyze this project. Report on:
- Overall architecture
- Key dependencies
- Component relationships
- Potential issues" -o text
```

### Dependency Analysis
```bash
gemini "Analyze dependencies in this project:
- Direct vs transitive
- Outdated packages
- Security vulnerabilities
- Bundle size impact
Use available tools to gather information." -o text
```

## Specialized Tasks

### Git Commit Message
```bash
gemini "Analyze staged changes and generate a commit message following conventional commits format. Be concise but descriptive." -o text
```

### Code Explanation
```bash
gemini "Explain what [file/function] does in detail:
- Purpose and use case
- How it works step by step
- Key algorithms/patterns used
- Dependencies and side effects" -o text
```

### Error Diagnosis
```bash
gemini "Diagnose this error:
[error message]
Context: [relevant context]
Provide:
- Root cause
- Solution steps
- Prevention tips" -o text
```

## Template Variables

Use these placeholders in templates:

- `[file]` - File path or name
- `[directory]` - Directory path
- `[description]` - Brief description
- `[features]` - List of features
- `[requirements]` - Specific requirements
- `[framework]` - Testing/UI framework
- `[language]` - Programming language
- `[format]` - Output format (markdown, JSON, etc.)
- `[date]` - Date for time-sensitive queries
- `[topic]` - Subject matter for research
