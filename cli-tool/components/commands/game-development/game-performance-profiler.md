---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [profile-type] | --fps | --memory | --rendering | --comprehensive
description: Use PROACTIVELY to analyze game performance bottlenecks and generate optimization recommendations across multiple platforms
model: sonnet
---

# Game Performance Analysis & Optimization

Analyze game performance and generate optimization recommendations: $ARGUMENTS

## Current Performance Context

- Game engine: @package.json or detect Unity/Unreal/Godot project files
- Platform targets: !`find . -name "*.pbxproj" -o -name "*.gradle" -o -name "*.vcxproj" | head -3`
- Asset pipeline: !`find . -name "*.meta" -o -name "*.asset" | wc -l` game assets
- Build configs: !`grep -r "BuildTarget\|Platform" . 2>/dev/null | wc -l` platform configurations
- Performance logs: !`find . -name "*profile*" -o -name "*perf*" | head -5`

## Task

Create comprehensive performance analysis with automated bottleneck detection, optimization suggestions, and platform-specific recommendations for game development projects.

## Performance Analysis Areas

### 1. Frame Rate & Rendering Performance
- Analyze draw calls and batching efficiency
- Identify overdraw and fillrate bottlenecks
- Review shader complexity and optimization opportunities
- Evaluate mesh and texture optimization potential
- Check lighting and shadow rendering performance

### 2. Memory Usage Analysis
- Memory allocation patterns and potential leaks
- Texture memory usage and compression opportunities
- Audio memory optimization suggestions
- Object pooling and garbage collection analysis
- Platform-specific memory constraints evaluation

### 3. CPU Performance Profiling
- Script execution bottlenecks identification
- Physics simulation optimization opportunities
- AI and pathfinding performance analysis
- Animation system efficiency review
- Threading and parallelization recommendations

### 4. Platform-Specific Optimization
- Mobile performance considerations (battery, thermal throttling)
- Console-specific optimization guidelines
- PC hardware scaling recommendations
- VR performance requirements and optimizations
- Web/WebGL specific performance considerations

## Deliverables

1. **Performance Audit Report**
   - Current performance metrics and benchmarks
   - Identified bottlenecks with severity ratings
   - Platform-specific performance analysis

2. **Optimization Recommendations**
   - Prioritized optimization suggestions
   - Implementation difficulty and impact assessment
   - Code and asset optimization guidelines

3. **Monitoring Setup**
   - Performance monitoring implementation
   - Key metrics tracking configuration
   - Automated performance regression detection

4. **Testing Strategy**
   - Performance testing procedures
   - Target device testing recommendations
   - Continuous performance monitoring setup

## Implementation Guidelines

Follow game engine best practices and target platform requirements. Generate actionable recommendations with clear implementation steps and expected performance improvements.