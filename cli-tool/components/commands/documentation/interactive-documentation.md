---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [platform] | --docusaurus | --gitbook | --notion | --storybook | --jupyter | --comprehensive
description: Use PROACTIVELY to create interactive documentation platforms with live examples, code playgrounds, and user engagement features
model: sonnet
---

# Interactive Documentation Platform

Create interactive documentation with live examples: $ARGUMENTS

## Current Documentation Infrastructure

- Static site generators: !`find . -name "docusaurus.config.js" -o -name "gatsby-config.js" -o -name "_config.yml" | head -3`
- Documentation framework: @docs/ or @website/ (detect existing setup)
- Component libraries: !`find . -name "*.stories.*" | head -5` (Storybook detection)
- Interactive examples: !`find . -name "*.ipynb" -o -name "*playground*" | head -3`
- Hosting setup: @vercel.json or @netlify.toml or @.github/workflows/ (if exists)

## Task

Build comprehensive interactive documentation platform with live code examples, user engagement features, and multi-platform integration capabilities.

## Interactive Documentation Architecture

### 1. Platform Foundation and Configuration
- Documentation platform selection and optimization setup
- Theme customization and branding configuration
- Navigation structure and content organization
- Multi-language support and internationalization
- Search integration with advanced filtering and indexing

### 2. Live Code Playground Integration
- Interactive code editor with syntax highlighting
- Real-time code execution and preview capabilities
- Multi-language support and framework integration
- Error handling and debugging assistance
- Code sharing and collaboration features

### 3. API Documentation and Testing
- Interactive API endpoint exploration
- Live request/response testing capabilities
- Parameter validation and example generation
- Authentication flow integration
- Response schema visualization and validation

### 4. Interactive Tutorial System
- Step-by-step guided learning experiences
- Progress tracking and completion validation
- Hands-on coding exercises with instant feedback
- Adaptive learning paths based on user progress
- Gamification elements and achievement systems

### 5. Component Documentation Integration
- Live component playground with property controls
- Visual component gallery with interactive examples
- Design system integration and style guide generation
- Accessibility testing and compliance validation
- Cross-browser compatibility testing

### 6. User Engagement and Feedback Systems
- Rating and review collection mechanisms
- User feedback aggregation and analysis
- Community discussion and Q&A integration
- Usage analytics and behavior tracking
- Personalization and recommendation systems

### 7. Content Management and Publishing
- Version control integration with automated publishing
- Content review and approval workflows
- Multi-author collaboration and editing
- Content scheduling and automated updates
- SEO optimization and metadata management

### 8. Advanced Interactive Features
- Advanced search with faceted filtering and suggestions
- Interactive diagrams and visualization tools
- Embedded video content and multimedia integration
- Mobile-responsive design and offline capabilities
- Progressive web app features and notifications

## Implementation Requirements

### Platform Integration
- Multi-framework support (React, Vue, Angular, vanilla JS)
- Build system integration with automated deployment
- Content management system compatibility
- Third-party service integration (analytics, feedback, search)
- Performance optimization and bundle splitting

### User Experience Design
- Responsive design across all device types
- Accessibility compliance (WCAG 2.1 AA standards)
- Progressive enhancement for feature degradation
- Fast loading times and optimal Core Web Vitals
- Intuitive navigation and content discovery

### Technical Infrastructure
- Scalable hosting and CDN configuration
- Database integration for user data and analytics
- API design for external integrations
- Security implementation and user authentication
- Monitoring and error tracking systems

## Deliverables

1. **Interactive Platform Architecture**
   - Complete documentation platform setup and configuration
   - Live code playground and API testing integration
   - Interactive tutorial system with progress tracking
   - Component documentation with visual examples

2. **User Engagement Systems**
   - Feedback collection and analysis mechanisms
   - User analytics and behavior tracking implementation
   - Community features and discussion integration
   - Personalization and recommendation engines

3. **Content Management Framework**
   - Automated publishing and deployment pipelines
   - Multi-author collaboration and review workflows
   - Version control integration with change tracking
   - SEO optimization and metadata management

4. **Performance and Optimization**
   - Mobile-responsive design with offline capabilities
   - Performance monitoring and optimization implementation
   - Accessibility compliance and testing frameworks
   - Progressive web app features and service workers

## Integration Guidelines

Implement with modern documentation platforms and development workflows. Ensure scalability for large content repositories and team collaboration while maintaining optimal performance and user experience across all devices and platforms.