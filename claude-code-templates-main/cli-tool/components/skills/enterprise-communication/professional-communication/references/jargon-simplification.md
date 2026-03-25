# Technical Jargon Simplification Guide

Translations from technical terminology to accessible language. Use when communicating with non-technical stakeholders, customers, or cross-functional teams.

## When to Simplify

**Simplify for:**

- Non-technical stakeholders (executives, product managers, sales)
- Customers and end users
- Cross-functional teams (HR, finance, legal, marketing)
- New team members still learning the domain
- Anyone who asks "what does that mean?"

**Stay technical for:**

- Engineering peers who share the context
- Technical documentation and specs
- Code reviews and architecture discussions
- When precision is more important than accessibility

## Architecture & Infrastructure

| Technical Term | Plain Language |
| --- | --- |
| Microservices architecture | Our system is split into smaller, independent pieces that can be updated separately |
| Monolithic application | One large application where everything is connected together |
| Load balancer | A traffic cop that distributes work evenly across our servers |
| CDN (Content Delivery Network) | Servers around the world that store copies of our content closer to users |
| Container / Docker | A standardized package that bundles our app with everything it needs to run |
| Kubernetes / K8s | A system that automatically manages and scales our applications |
| Serverless | We run code without managing servers; we pay only when it's actually used |
| API (Application Programming Interface) | A way for different software systems to talk to each other |
| Database migration | Reorganizing how our data is stored and structured |
| Caching | Storing frequently accessed data in a fast temporary location |
| Redundancy | Having backup systems so we can keep running if something fails |
| Failover | Automatically switching to a backup system when the main one fails |

## Development Process

| Technical Term | Plain Language |
| --- | --- |
| CI/CD Pipeline | Automated process that tests and deploys our code |
| Sprint | A 1-2 week work cycle where we build and deliver specific features |
| Backlog | Our prioritized list of features and improvements to build |
| Technical debt | Shortcuts we took that we need to fix later |
| Refactoring | Improving the code's structure without changing what it does |
| Code review | Team members checking each other's work before it goes live |
| Pull request / PR | A request to add your code changes to the main project |
| Deployment | Releasing new code to our live system |
| Rollback | Undoing a release and going back to the previous version |
| Feature flag | A switch that lets us turn features on/off without deploying |
| A/B testing | Showing different versions to different users to see what works better |

## Performance & Reliability

| Technical Term | Plain Language |
| --- | --- |
| Latency | The delay between a request and response; how fast things feel |
| Throughput | How much work the system can handle at once |
| Scalability | The ability to handle more users or work as we grow |
| Uptime / availability | How often the system is working and accessible |
| SLA (Service Level Agreement) | Our promise about how reliable the service will be |
| 99.9% uptime / "three nines" | About 8 hours of downtime per year |
| Memory leak | The app gradually using more memory until it slows down or crashes |
| Race condition | A bug where the outcome depends on timing, causing unpredictable behavior |
| Bottleneck | A part of the system that limits overall performance |

## Security

| Technical Term | Plain Language |
| --- | --- |
| Authentication | Verifying who you are (username/password) |
| Authorization | Checking what you're allowed to do |
| Encryption | Scrambling data so only authorized people can read it |
| SSL/TLS/HTTPS | Secure connection that protects data in transit |
| Two-factor authentication (2FA) | A second verification step beyond your password |
| Vulnerability | A weakness that could be exploited by attackers |
| Penetration testing / pen test | Hiring experts to try to break into our systems |
| Data breach | Unauthorized access to sensitive information |
| Firewall | A security barrier that controls what traffic can enter/exit |

## Data & Databases

| Technical Term | Plain Language |
| --- | --- |
| SQL / NoSQL | Different types of databases; SQL is structured tables, NoSQL is more flexible |
| Query | A request to get specific data from the database |
| Schema | The structure that defines how data is organized |
| Index | A lookup system that makes finding data faster |
| Replication | Copying data to multiple locations for safety and speed |
| Sharding | Splitting data across multiple databases to handle more volume |
| ETL (Extract, Transform, Load) | Moving data from one system to another, cleaning it up along the way |
| Data warehouse | A central repository that combines data from many sources |

## Communication & APIs

| Technical Term | Plain Language |
| --- | --- |
| REST API | A standard way for systems to communicate over the web |
| GraphQL | A more flexible way to request exactly the data you need |
| Webhook | Automatic notifications sent when something happens |
| Asynchronous / async | Tasks that run in the background without blocking other work |
| Message queue | A waiting line for tasks to be processed one at a time |
| Real-time | Updates that happen immediately, without refreshing |
| WebSocket | A persistent connection for instant two-way communication |
| Rate limiting | Restricting how many requests someone can make in a time period |

## Common Phrases Translated

| Technical Phrase | Plain Language |
| --- | --- |
| "We need to optimize the query" | "We need to make this faster" |
| "There's a bug in production" | "There's an error affecting live users" |
| "We're experiencing degraded performance" | "Things are slower than normal" |
| "The service is timing out" | "Requests are failing because they're taking too long" |
| "We need to scale horizontally" | "We need to add more servers to handle the load" |
| "There's a regression in the latest release" | "The new update broke something that used to work" |
| "We're doing a hotfix" | "We're quickly fixing a critical issue" |
| "That's a breaking change" | "Existing integrations will stop working unless updated" |
| "We need to deprecate this endpoint" | "We're phasing out this feature; please switch to the new one" |

## Tips for Effective Translation

### 1. Lead with Impact

Instead of: "We implemented Redis caching to reduce database load"
Say: "We made the page load 3x faster by storing frequently accessed data in memory"

### 2. Use Analogies

| Concept | Analogy |
| --- | --- |
| API | Like a waiter who takes your order to the kitchen and brings back food |
| Load balancer | Like a host at a restaurant directing guests to available tables |
| Database index | Like the index at the back of a book that helps you find topics quickly |
| Caching | Like keeping frequently used items on your desk instead of in a filing cabinet |
| Encryption | Like sending a letter in a locked box that only the recipient can open |

### 3. Focus on "So What?"

For every technical detail, ask: "Why does this matter to my audience?"

| Technical | Business Impact |
| --- | --- |
| "We upgraded to Node 20" | "We can now use modern features and security updates" |
| "We containerized the application" | "Deployments are now faster and more reliable" |
| "We added monitoring and alerting" | "We'll know about problems before customers report them" |

### 4. Know When Precision Matters

Some situations require technical precision:

- Legal or compliance discussions
- Security incident communications
- Technical documentation
- When the audience asks for details

In these cases, provide the technical term with a brief explanation:
"We're implementing TLS 1.3 encryption - this is the latest security standard for protecting data in transit."

---

**Related:** Return to `professional-communication` skill for writing and communication frameworks.
