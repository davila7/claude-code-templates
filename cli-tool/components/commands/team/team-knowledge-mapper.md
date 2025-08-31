---
allowed-tools: Read, Bash, Glob, Grep
argument-hint: [mapping-type] | --skill-matrix | --knowledge-gaps | --expertise-areas | --learning-paths
description: Map team knowledge and expertise with skill gap analysis and learning path recommendations
model: sonnet
---

# Team Knowledge Mapper

Map team knowledge and expertise with comprehensive skill gap analysis: **$ARGUMENTS**

## Current Knowledge Context

- Team expertise: !`git log --format='%ae' --since='3 months ago' | sort | uniq -c | sort -nr` contributor activity patterns
- Technology stack: Analysis of languages, frameworks, and tools used in codebase
- Knowledge distribution: Assessment of expertise concentration and bus factor risks
- Learning activity: Recent skill development and cross-training initiatives

## Task

Execute comprehensive knowledge mapping with skill gap analysis and learning optimization:

**Mapping Type**: Use $ARGUMENTS to focus on skill matrix creation, knowledge gap identification, expertise area analysis, or learning path recommendations

**Knowledge Mapping Framework**:
1. **Skill Matrix Creation** - Map individual expertise levels, identify core competencies, assess technology proficiencies, evaluate domain knowledge
2. **Knowledge Gap Analysis** - Identify critical skill gaps, assess team vulnerabilities, evaluate learning priorities, recommend skill development
3. **Expertise Distribution** - Analyze knowledge concentration, identify single points of failure, assess bus factor risks, recommend knowledge sharing
4. **Learning Path Planning** - Design skill development roadmaps, recommend training priorities, plan mentorship programs, optimize knowledge transfer
5. **Cross-Training Optimization** - Identify pairing opportunities, plan knowledge rotation, design shadowing programs, optimize skill redundancy
6. **Knowledge Retention** - Assess knowledge preservation, plan documentation strategies, design knowledge capture systems, prevent expertise loss

**Advanced Features**: Dynamic skill tracking, expertise prediction modeling, learning ROI analysis, knowledge graph visualization, competency gap forecasting.

**Strategic Planning**: Succession planning support, hiring decision guidance, team composition optimization, skill portfolio balancing.

**Output**: Comprehensive knowledge map with skill matrices, gap analysis, learning recommendations, and strategic knowledge management plans.