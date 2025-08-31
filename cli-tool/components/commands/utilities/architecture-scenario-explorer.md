# Architecture Scenario Explorer

Explore architectural decisions through systematic scenario analysis with trade-off evaluation and future-proofing assessment.

## Instructions

You are tasked with systematically exploring architectural decisions through comprehensive scenario modeling to optimize system design choices. Follow this approach: **$ARGUMENTS**

### 1. Prerequisites Assessment

**Critical Architecture Context Validation:**

- **System Scope**: What system or component architecture are you designing?
- **Scale Requirements**: What are the expected usage patterns and growth projections?
- **Constraints**: What technical, business, or resource constraints apply?
- **Timeline**: What is the implementation timeline and evolution roadmap?
- **Success Criteria**: How will you measure architectural success?

**If context is unclear, guide systematically:**

```
Missing System Scope:
"What specific system architecture needs exploration?
- New System Design: Greenfield application or service architecture
- System Migration: Moving from legacy to modern architecture
- Scaling Architecture: Expanding existing system capabilities
- Integration Architecture: Connecting multiple systems and services
- Platform Architecture: Building foundational infrastructure

Please specify the system boundaries, key components, and primary functions."

Missing Scale Requirements:
"What are the expected system scale and usage patterns?
- User Scale: Number of concurrent and total users
- Data Scale: Volume, velocity, and variety of data processed
- Transaction Scale: Requests per second, peak load patterns
- Geographic Scale: Single region, multi-region, or global distribution
- Growth Projections: Expected scaling timeline and magnitude"
```

### 2. Architecture Option Generation

**Systematically identify architectural approaches:**

#### Architecture Pattern Matrix
```
Architectural Approach Framework:

Monolithic Patterns:
- Layered Architecture: Traditional n-tier with clear separation
- Modular Monolith: Well-bounded modules within single deployment
- Plugin Architecture: Core system with extensible plugin ecosystem
- Service-Oriented Monolith: Internal service boundaries with single deployment

Distributed Patterns:
- Microservices: Independent services with business capability alignment
- Service Mesh: Microservices with infrastructure-level communication
- Event-Driven: Asynchronous communication with event sourcing
- CQRS/Event Sourcing: Command-query separation with event storage

Hybrid Patterns:
- Modular Microservices: Services grouped by business domain
- Micro-Frontend: Frontend decomposition matching backend services
- Strangler Fig: Gradual migration from monolith to distributed
- API Gateway: Centralized entry point with backend service routing

Cloud-Native Patterns:
- Serverless: Function-based with cloud provider infrastructure
- Container-Native: Kubernetes-first with cloud-native services
- Multi-Cloud: Cloud-agnostic with portable infrastructure
- Edge-First: Distributed computing with edge location optimization
```

#### Architecture Variation Specification
```
For each architectural option:

Structural Characteristics:
- Component Organization: [how system parts are structured and related]
- Communication Patterns: [synchronous vs asynchronous, protocols, messaging]
- Data Management: [database strategy, consistency model, storage patterns]
- Deployment Model: [packaging, distribution, scaling, and operational approach]

Quality Attributes:
- Scalability Profile: [horizontal vs vertical scaling, bottleneck analysis]
- Reliability Characteristics: [failure modes, recovery, fault tolerance]
- Performance Expectations: [latency, throughput, resource efficiency]
- Security Model: [authentication, authorization, data protection, attack surface]

Implementation Considerations:
- Technology Stack: [languages, frameworks, databases, infrastructure]
- Team Structure Fit: [Conway's Law implications, team capabilities]
- Development Process: [build, test, deploy, monitor workflows]
- Evolution Strategy: [how architecture can grow and change over time]
```

### 3. Scenario Framework Development

**Create comprehensive architectural testing scenarios:**

#### Usage Scenario Matrix
```
Multi-Dimensional Scenario Framework:

Load Scenarios:
- Normal Operation: Typical daily usage patterns and traffic
- Peak Load: Maximum expected concurrent usage and transaction volume
- Stress Testing: Beyond normal capacity to identify breaking points
- Spike Testing: Sudden traffic increases and burst handling

Growth Scenarios:
- Linear Growth: Steady user and data volume increases over time
- Exponential Growth: Rapid scaling requirements and viral adoption
- Geographic Expansion: Multi-region deployment and global scaling
- Feature Expansion: New capabilities and service additions

Failure Scenarios:
- Component Failures: Individual service or database outages
- Infrastructure Failures: Network, storage, or compute disruptions
- Cascade Failures: Failure propagation and system-wide impacts
- Disaster Recovery: Major outage recovery and business continuity

Evolution Scenarios:
- Technology Migration: Framework, language, or platform changes
- Business Model Changes: New revenue streams or service offerings
- Regulatory Changes: Compliance requirements and data protection
- Competitive Response: Market pressures and feature requirements
```

#### Scenario Impact Modeling
- Performance impact under each scenario type
- Cost implications for infrastructure and operations
- Development velocity and team productivity effects
- Risk assessment and mitigation requirements

### 4. Trade-off Analysis Framework

**Systematic evaluation of architectural trade-offs:**

#### Quality Attribute Trade-off Matrix
```
Architecture Quality Assessment:

Performance Trade-offs:
- Latency vs Throughput: Response time vs maximum concurrent processing
- Memory vs CPU: Resource utilization optimization strategies
- Consistency vs Availability: CAP theorem implications and choices
- Caching vs Freshness: Data staleness vs response speed

Scalability Trade-offs:
- Horizontal vs Vertical: Infrastructure scaling approach and economics
- Stateless vs Stateful: Session management and performance implications
- Synchronous vs Asynchronous: Communication complexity vs performance
- Coupling vs Autonomy: Service independence vs operational overhead

Development Trade-offs:
- Development Speed vs Runtime Performance: Optimization time investment
- Type Safety vs Flexibility: Compile-time vs runtime error handling
- Code Reuse vs Service Independence: Shared libraries vs duplication
- Testing Complexity vs System Reliability: Test investment vs quality

Operational Trade-offs:
- Complexity vs Control: Managed services vs self-managed infrastructure
- Monitoring vs Privacy: Observability vs data protection
- Automation vs Flexibility: Standardization vs customization
- Cost vs Performance: Infrastructure spending vs response times
```

#### Decision Matrix Construction
- Weight assignment for different quality attributes based on business priorities
- Scoring methodology for each architecture option across quality dimensions
- Sensitivity analysis for weight and score variations
- Pareto frontier identification for non-dominated solutions

### 5. Future-Proofing Assessment

**Evaluate architectural adaptability and evolution potential:**

#### Technology Evolution Scenarios
```
Future-Proofing Analysis Framework:

Technology Trend Integration:
- AI/ML Integration: Machine learning capability embedding and scaling
- Edge Computing: Distributed processing and low-latency requirements
- Quantum Computing: Post-quantum cryptography and computational impacts
- Blockchain/DLT: Distributed ledger integration and trust mechanisms

Market Evolution Preparation:
- Business Model Flexibility: Subscription, marketplace, platform pivots
- Global Expansion: Multi-tenant, multi-region, multi-regulatory compliance
- Customer Expectation Evolution: Real-time, personalized, omnichannel experiences
- Competitive Landscape Changes: Feature parity and differentiation requirements

Regulatory Future-Proofing:
- Privacy Regulation: GDPR, CCPA evolution and global privacy requirements
- Security Standards: Zero-trust, compliance framework evolution
- Data Sovereignty: Geographic data residency and cross-border restrictions
- Accessibility Requirements: Inclusive design and assistive technology support
```

#### Adaptability Scoring
- Architecture flexibility for requirement changes
- Technology migration feasibility and cost
- Team skill evolution and learning curve management
- Investment protection and technical debt management

### 6. Architecture Simulation Engine

**Model architectural behavior under different scenarios:**

#### Performance Simulation Framework
```
Multi-Layer Architecture Simulation:

Component-Level Simulation:
- Individual service performance characteristics and resource usage
- Database query performance and optimization opportunities
- Cache hit ratios and invalidation strategies
- Message queue throughput and latency patterns

Integration-Level Simulation:
- Service-to-service communication overhead and optimization
- API gateway performance and routing efficiency
- Load balancer distribution and health checking
- Circuit breaker and retry mechanism effectiveness

System-Level Simulation:
- End-to-end request flow and user experience
- Peak load distribution and resource allocation
- Failure propagation and recovery patterns
- Monitoring and alerting system effectiveness

Infrastructure-Level Simulation:
- Cloud resource utilization and auto-scaling behavior
- Network bandwidth and latency optimization
- Storage performance and data consistency patterns
- Security policy enforcement and performance impact
```

#### Cost Modeling Integration
- Infrastructure cost estimation across different scenarios
- Development and operational cost projection
- Total cost of ownership analysis over multi-year timeline
- Cost optimization opportunities and trade-off analysis

### 7. Risk Assessment and Mitigation

**Comprehensive architectural risk evaluation:**

#### Technical Risk Framework
```
Architecture Risk Assessment:

Implementation Risks:
- Technology Maturity: New vs proven technology adoption risks
- Complexity Management: System comprehension and debugging challenges
- Integration Challenges: Third-party service dependencies and compatibility
- Performance Uncertainty: Untested scaling and optimization requirements

Operational Risks:
- Deployment Complexity: Release management and rollback capabilities
- Monitoring Gaps: Observability and troubleshooting limitations
- Scaling Challenges: Auto-scaling reliability and cost control
- Disaster Recovery: Backup, recovery, and business continuity planning

Strategic Risks:
- Technology Lock-in: Vendor dependency and migration flexibility
- Skill Dependencies: Team expertise requirements and knowledge gaps
- Evolution Constraints: Architecture modification and extension limitations
- Competitive Disadvantage: Time-to-market and feature development speed
```

#### Risk Mitigation Strategy Development
- Specific mitigation approaches for identified risks
- Contingency planning and alternative architecture options
- Early warning indicators and monitoring strategies
- Risk acceptance criteria and stakeholder communication

### 8. Decision Framework and Recommendations

**Generate systematic architectural guidance:**

#### Architecture Decision Record (ADR) Format
```
## Architecture Decision: [System Name] - [Decision Topic]

### Context and Problem Statement
- Business Requirements: [key functional and non-functional requirements]
- Current Constraints: [technical, resource, and timeline limitations]
- Decision Drivers: [factors influencing architectural choice]

### Architecture Options Considered

#### Option 1: [Architecture Name]
- Description: [architectural approach and key characteristics]
- Pros: [advantages and benefits]
- Cons: [disadvantages and risks]
- Trade-offs: [specific quality attribute impacts]

[Repeat for each option]

### Decision Outcome
- Selected Architecture: [chosen approach with rationale]
- Decision Rationale: [why this option was selected]
- Expected Benefits: [anticipated advantages and success metrics]
- Accepted Trade-offs: [compromises and mitigation strategies]

### Implementation Strategy
- Phase 1 (Immediate): [initial implementation steps and validation]
- Phase 2 (Short-term): [core system development and integration]
- Phase 3 (Medium-term): [optimization and scaling implementation]
- Phase 4 (Long-term): [evolution and enhancement roadmap]

### Validation and Success Criteria
- Performance Metrics: [specific KPIs and acceptable ranges]
- Quality Gates: [architectural compliance and validation checkpoints]
- Review Schedule: [when to reassess architectural decisions]
- Adaptation Triggers: [conditions requiring architectural modification]

### Risks and Mitigation
- High-Priority Risks: [most significant concerns and responses]
- Monitoring Strategy: [early warning systems and health checks]
- Contingency Plans: [alternative approaches if problems arise]
- Learning and Adaptation: [how to incorporate feedback and improve]
```

### 9. Continuous Architecture Evolution

**Establish ongoing architectural assessment and improvement:**

#### Architecture Health Monitoring
- Performance metric tracking against architectural predictions
- Technical debt accumulation and remediation planning
- Team productivity and development velocity measurement
- User satisfaction and business outcome correlation

#### Evolutionary Architecture Practices
- Regular architecture review and fitness function evaluation
- Incremental improvement identification and implementation
- Technology trend assessment and adoption planning
- Cross-team architecture knowledge sharing and standardization

## Usage Examples

```bash
# Microservices migration planning
/dev:architecture-scenario-explorer Evaluate monolith to microservices migration for e-commerce platform with 1M+ users

# New system architecture design
/dev:architecture-scenario-explorer Design architecture for real-time analytics platform handling 100k events/second

# Scaling architecture assessment
/dev:architecture-scenario-explorer Analyze architecture options for scaling social media platform from 10k to 1M daily active users

# Technology modernization planning
/dev:architecture-scenario-explorer Compare serverless vs container-native architectures for data processing pipeline modernization
```

## Quality Indicators

- **Green**: Multiple architectures analyzed, comprehensive scenarios tested, validated trade-offs
- **Yellow**: Some architectural options considered, basic scenario coverage, estimated trade-offs
- **Red**: Single architecture focus, limited scenario analysis, unvalidated assumptions

## Common Pitfalls to Avoid

- Architecture astronauting: Over-engineering for theoretical rather than real requirements
- Cargo cult architecture: Copying successful patterns without understanding context
- Technology bias: Choosing architecture based on technology preferences rather than requirements
- Premature optimization: Solving performance problems that don't exist yet
- Scalability obsession: Over-optimizing for scale that may never materialize
- Evolution blindness: Not planning for architectural change and growth

Transform architectural decisions from opinion-based debates into systematic, evidence-driven choices through comprehensive scenario exploration and trade-off analysis.