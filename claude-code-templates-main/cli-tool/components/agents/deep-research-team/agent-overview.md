[Open Deep Research Team Diagram](../../../images/research_team_diagram.html)

## Open Deep Research Team Agent Overview

The Open Deep Research Team represents a sophisticated multi-agent research system designed to conduct comprehensive, academic-quality research on complex topics. This team orchestrates nine specialized agents through a hierarchical workflow that ensures thorough coverage, rigorous analysis, and high-quality output.

---

### 1. Research Orchestrator Agent

**Purpose:** Central coordinator that manages the entire research workflow from initial query through final report generation, ensuring all phases are executed in proper sequence with quality control.

**Key Features:**

- Master workflow management across all research phases
- Intelligent routing of tasks to appropriate specialized agents
- Quality gates and validation between workflow stages
- State management and progress tracking throughout complex research projects
- Error handling and graceful degradation capabilities
- TodoWrite integration for transparent progress tracking

**System Prompt Example:**

```
You are the Research Orchestrator, an elite coordinator responsible for managing comprehensive research projects using the Open Deep Research methodology. You excel at breaking down complex research queries into manageable phases and coordinating specialized agents to deliver thorough, high-quality research outputs.
```

---

### 2. Query Clarifier Agent

**Purpose:** Analyzes incoming research queries for clarity, specificity, and actionability. Determines when user clarification is needed before research begins to optimize research quality.

**Key Features:**

- Systematic query analysis for ambiguity and vagueness detection
- Confidence scoring system (0.0-1.0) for decision making
- Structured clarification question generation with multiple choice options
- Focus area identification and refined query generation
- JSON-structured output for seamless workflow integration
- Decision framework balancing thoroughness with user experience

**System Prompt Example:**

```
You are the Query Clarifier, an expert in analyzing research queries to ensure they are clear, specific, and actionable before research begins. Your role is critical in optimizing research quality by identifying ambiguities early.
```

---

### 3. Research Brief Generator Agent

**Purpose:** Transforms clarified research queries into structured, actionable research plans with specific questions, keywords, source preferences, and success criteria.

**Key Features:**

- Conversion of broad queries into specific research questions
- Source identification and research methodology planning
- Success criteria definition and scope boundary setting
- Keyword extraction for targeted searching
- Research timeline and resource allocation planning
- Integration with downstream research agents for seamless handoff

**System Prompt Example:**

```
You are the Research Brief Generator, transforming user queries into comprehensive research frameworks that guide systematic investigation and ensure thorough coverage of all relevant aspects.
```

---

### 4. Research Coordinator Agent

**Purpose:** Strategically plans and coordinates complex research tasks across multiple specialist researchers, analyzing requirements and allocating tasks for comprehensive coverage.

**Key Features:**

- Task allocation strategy across specialized researchers
- Parallel research thread coordination and dependency management
- Resource optimization and workload balancing
- Quality control checkpoints and milestone tracking
- Inter-researcher communication facilitation
- Iteration strategy definition for comprehensive coverage

**System Prompt Example:**

```
You are the Research Coordinator, strategically planning and coordinating complex research tasks across multiple specialist researchers. You analyze research requirements, allocate tasks to appropriate specialists, and define iteration strategies for comprehensive coverage.
```

---

### 5. Academic Researcher Agent

**Purpose:** Finds, analyzes, and synthesizes scholarly sources, research papers, and academic literature with emphasis on peer-reviewed sources and proper citation formatting.

**Key Features:**

- Academic database searching (ArXiv, PubMed, Google Scholar)
- Peer-review status verification and journal impact assessment
- Citation analysis and seminal work identification
- Research methodology extraction and quality evaluation
- Proper bibliographic formatting and DOI preservation
- Research gap identification and future direction analysis

**System Prompt Example:**

```
You are the Academic Researcher, specializing in finding and analyzing scholarly sources, research papers, and academic literature. Your expertise includes searching academic databases, evaluating peer-reviewed papers, and maintaining academic rigor throughout the research process.
```

---

### 6. Technical Researcher Agent

**Purpose:** Analyzes code repositories, technical documentation, implementation details, and evaluates technical solutions with focus on practical implementation aspects.

**Key Features:**

- GitHub repository analysis and code quality assessment
- Technical documentation review and API analysis
- Implementation pattern identification and best practice evaluation
- Version history tracking and technology stack analysis
- Code example extraction and technical feasibility assessment
- Integration with development tools and technical resources

**System Prompt Example:**

```
You are the Technical Researcher, specializing in analyzing code repositories, technical documentation, and implementation details. You evaluate technical solutions, review code quality, and assess the practical aspects of technology implementations.
```

---

### 7. Data Analyst Agent

**Purpose:** Provides quantitative analysis, statistical insights, and data-driven research with focus on numerical data interpretation and trend identification.

**Key Features:**

- Statistical analysis and trend identification capabilities
- Data visualization suggestions and metric interpretation
- Comparative analysis across different datasets and timeframes
- Performance benchmark analysis and quantitative research
- Database querying and data quality assessment
- Integration with statistical tools and data sources

**System Prompt Example:**

```
You are the Data Analyst, specializing in quantitative analysis, statistical insights, and data-driven research. You excel at finding and interpreting numerical data, identifying trends, creating comparisons, and suggesting data visualizations.
```

---

### 8. Research Synthesizer Agent

**Purpose:** Consolidates and synthesizes findings from multiple research sources into unified, comprehensive analysis while preserving complexity and identifying contradictions.

**Key Features:**

- Multi-source finding consolidation and pattern identification
- Contradiction resolution and bias analysis
- Theme extraction and relationship mapping between diverse sources
- Nuance preservation while creating accessible summaries
- Evidence strength assessment and confidence scoring
- Structured insight generation for report preparation

**System Prompt Example:**

```
You are the Research Synthesizer, responsible for consolidating findings from multiple research sources into a unified, comprehensive analysis. You excel at merging diverse perspectives, identifying patterns, and creating structured insights while preserving complexity.
```

---

### 9. Report Generator Agent

**Purpose:** Transforms synthesized research findings into comprehensive, well-structured final reports with proper formatting, citations, and narrative flow.

**Key Features:**

- Professional report structuring and narrative development
- Citation formatting and bibliography management
- Executive summary creation and key insight highlighting
- Recommendation formulation based on research findings
- Multiple output format support (academic, business, technical)
- Quality assurance and final formatting optimization

**System Prompt Example:**

```
You are the Report Generator, transforming synthesized research findings into comprehensive, well-structured final reports. You create readable narratives from complex research data, organize content logically, and ensure proper citation formatting.
```

---

### Workflow Architecture

**Sequential Phases:**

1. **Query Processing**: Orchestrator → Query Clarifier → Research Brief Generator
2. **Planning**: Research Coordinator develops strategy and allocates specialist tasks
3. **Parallel Research**: Academic, Technical, and Data analysts work simultaneously
4. **Synthesis**: Research Synthesizer consolidates all specialist findings
5. **Output**: Report Generator creates final comprehensive report

**Key Orchestration Patterns:**

- **Hierarchical Coordination**: Central orchestrator manages all workflow phases
- **Parallel Execution**: Specialist researchers work simultaneously for efficiency
- **Quality Gates**: Validation checkpoints between each major phase
- **State Management**: Persistent context and findings throughout the workflow
- **Error Recovery**: Graceful degradation and retry mechanisms

**Communication Protocol:**

All agents use structured JSON for inter-agent communication, maintaining:
- Phase status and completion tracking
- Accumulated data and findings preservation
- Quality metrics and confidence scoring
- Next action planning and dependency management

---

### General Setup Notes:

- Each agent operates with focused tool permissions appropriate to their role
- Agents can be invoked individually or as part of the complete workflow
- The orchestrator maintains comprehensive state management across all phases
- Quality control is embedded at each workflow transition point
- The system supports both complete research projects and individual agent consultation
- All findings maintain full traceability to original sources and methodologies

This research team represents a comprehensive approach to AI-assisted research, combining the strengths of specialized agents with coordinated workflow management to deliver thorough, high-quality research outcomes on complex topics.