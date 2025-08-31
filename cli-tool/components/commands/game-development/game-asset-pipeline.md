---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [pipeline-type] | --art | --audio | --models | --textures | --comprehensive
description: Use PROACTIVELY to build automated game asset processing pipelines with optimization, validation, and multi-platform delivery systems
model: sonnet
---

# Game Asset Pipeline & Processing System

Build comprehensive game asset processing pipeline: $ARGUMENTS

## Current Asset Environment

- Project assets: !`find . -name "*.png" -o -name "*.fbx" -o -name "*.wav" -o -name "*.mp3" | wc -l` total assets
- Asset sizes: !`du -sh Assets/ 2>/dev/null || du -sh assets/ 2>/dev/null || echo "No assets folder found"`
- Build tools: !`which blender`; !`which ffmpeg`; !`which imagemagick`
- Platform targets: @ProjectSettings/ProjectSettings.asset or detect from build configs
- Version control: !`git lfs ls-files | wc -l` LFS-tracked files

## Task

Create an automated asset processing pipeline with optimization, validation, platform-specific delivery, and real-time monitoring for game development workflows.

## Asset Pipeline Components

### 1. Asset Import & Validation
- Automated asset format validation and standardization
- Quality assurance checks for texture resolution, model complexity
- Asset naming convention enforcement
- Metadata extraction and tagging system
- Source asset backup and version control integration

### 2. Multi-Platform Optimization
- Platform-specific texture compression (ASTC, DXT, etc.)
- Model LOD generation and optimization
- Audio format conversion and compression
- Shader variant compilation for target platforms
- Memory budget validation per platform

### 3. Build Integration
- Automated asset processing during build pipeline
- Incremental processing for modified assets only
- Asset bundle generation and packaging
- Dependency tracking and resolution
- Build-time asset validation and error reporting

### 4. Quality Assurance
- Visual diff comparison for texture changes
- Model geometry validation and optimization
- Audio quality and compression ratio analysis
- Performance impact assessment for new assets
- Automated regression testing for asset changes

## Processing Workflows

### Texture Processing Pipeline
- Import validation and format standardization
- Automatic mipmap generation and optimization
- Platform-specific compression with quality settings
- Memory usage estimation and optimization
- Integration with sprite atlasing and texture streaming

### 3D Model Processing Pipeline
- Import validation and mesh optimization
- Automatic LOD generation with configurable reduction ratios
- Bone and animation optimization
- Texture coordinate validation and optimization
- Collision mesh generation and validation

### Audio Processing Pipeline
- Format standardization and quality validation
- Platform-specific compression with bitrate optimization
- Audio asset tagging and categorization
- Streaming vs. loaded-in-memory recommendations
- Audio occlusion and spatialization preparation

### Animation Processing Pipeline
- Animation clip optimization and compression
- Keyframe reduction and smoothing
- Bone hierarchy validation and optimization
- Animation event validation and documentation
- Runtime performance impact analysis

## Deliverables

1. **Asset Processing Configuration**
   - Platform-specific processing rules and settings
   - Quality thresholds and validation criteria
   - Automated workflow triggers and conditions

2. **Pipeline Implementation**
   - Asset processing scripts and automation tools
   - Build system integration and deployment
   - Version control hooks and asset tracking

3. **Monitoring & Reporting**
   - Asset processing performance metrics
   - Quality assurance reports and validation results
   - Platform compatibility and optimization reports

4. **Documentation & Guidelines**
   - Asset creation guidelines for artists and designers
   - Pipeline usage documentation and troubleshooting
   - Performance impact guidelines and best practices

## Integration Guidelines

Implement pipeline with game engine-specific optimizations and industry standard tools. Ensure scalability for team collaboration and automated deployment workflows.