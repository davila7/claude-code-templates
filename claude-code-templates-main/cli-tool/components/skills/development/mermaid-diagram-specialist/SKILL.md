---
name: mermaid-diagram-specialist
category: tech
description:
  Mermaid diagram specialist for creating flowcharts, sequence diagrams, ERDs,
  and architecture visualizations
usage:
  Use when creating technical documentation, visualizing workflows, documenting
  architecture, or explaining system design
input:
  Process description, data model, architecture requirements, workflow steps
output: Mermaid diagrams (flowchart, sequence, ERD, C4, state, etc.) in markdown
---

# Mermaid Diagram Specialist

## Overview

**Purpose**: Expert in creating comprehensive Mermaid diagrams for
documentation, architecture visualization, and process mapping

**Category**: Tech **Primary Users**: tech-writer, architecture-validator,
product-technical, tech-lead

## When to Use This Skill

- Creating architecture documentation
- Visualizing workflows and processes
- Documenting data models (ERDs)
- Explaining sequence flows
- Creating state machines
- Documenting component relationships
- Creating decision trees
- Visualizing user journeys

## Prerequisites

**Required:**

- Understanding of the system/process to document
- Access to technical specifications
- Knowledge of diagram type needed

**Optional:**

- Design system colors for consistency
- Existing documentation to reference

## Input

**What the skill needs:**

- Process/system description
- Entities and relationships (for ERDs)
- Component interactions (for sequence diagrams)
- Architecture layers (for C4 diagrams)
- States and transitions (for state diagrams)

## Workflow

### Step 1: Diagram Type Selection

**Objective**: Choose appropriate diagram type for requirements

**Available Diagram Types:**

1. **Flowchart**: Decision flows, algorithms, processes
2. **Sequence Diagram**: API interactions, message flows
3. **ERD**: Database schemas, entity relationships
4. **Class Diagram**: Object-oriented design
5. **State Diagram**: State machines, lifecycle
6. **Gantt Chart**: Project timelines, schedules
7. **C4 Diagram**: Architecture at different levels
8. **Pie/Bar Charts**: Data visualization
9. **Git Graph**: Version control flows
10. **User Journey**: User experience flows

**Decision Matrix:**

- Process with decisions → **Flowchart**
- API/system interactions → **Sequence Diagram**
- Database structure → **ERD**
- System architecture → **C4 Diagram**
- Object relationships → **Class Diagram**
- State transitions → **State Diagram**
- Project timeline → **Gantt Chart**

**Validation:**

- [ ] Diagram type matches content
- [ ] Complexity appropriate
- [ ] Audience considered
- [ ] Purpose clear

**Output**: Selected diagram type

### Step 2: Flowchart Creation

**Objective**: Create process and decision flow diagrams

**Syntax:**

```mermaid
flowchart TD
    Start([Start]) --> Input[/User Input/]
    Input --> Validate{Valid?}
    Validate -->|Yes| Process[Process Data]
    Validate -->|No| Error[Show Error]
    Error --> Input
    Process --> Save[(Save to DB)]
    Save --> Success[/Success Response/]
    Success --> End([End])
```

**Node Shapes:**

- `[Rectangle]` - Process step
- `([Rounded])` - Start/End
- `{Diamond}` - Decision
- `[/Parallelogram/]` - Input/Output
- `[(Database)]` - Data storage
- `((Circle))` - Connector

**Direction Options:**

- `TD` - Top to Down
- `LR` - Left to Right
- `BT` - Bottom to Top
- `RL` - Right to Left

**Example - Booking Flow:**

```mermaid
flowchart TD
    Start([User Initiates Booking]) --> CheckDates[Check Date Availability]
    CheckDates --> Available{Dates Available?}
    Available -->|No| ShowError[/Show Unavailable Message/]
    ShowError --> End([End])
    Available -->|Yes| CreateBooking[Create Pending Booking]
    CreateBooking --> Payment[Process Payment]
    Payment --> PaymentSuccess{Payment Success?}
    PaymentSuccess -->|No| CancelBooking[Cancel Booking]
    CancelBooking --> ShowError
    PaymentSuccess -->|Yes| ConfirmBooking[Confirm Booking]
    ConfirmBooking --> SendEmail[/Send Confirmation Email/]
    SendEmail --> SaveDB[(Save to Database)]
    SaveDB --> Success[/Show Success/]
    Success --> End
```

**Validation:**

- [ ] All paths covered
- [ ] Decision points clear
- [ ] Start and end defined
- [ ] Flow direction logical

**Output**: Process flowchart

### Step 3: Sequence Diagram Creation

**Objective**: Document API interactions and message flows

**Syntax:**

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant DB
    participant Payment

    User->>Frontend: Click "Book"
    Frontend->>API: POST /api/bookings
    API->>DB: Check availability
    DB-->>API: Available
    API->>Payment: Process payment
    Payment-->>API: Payment successful
    API->>DB: Create booking
    DB-->>API: Booking created
    API-->>Frontend: 201 Created
    Frontend-->>User: Show confirmation
```

**Participant Types:**

- `actor` - Human user
- `participant` - System/Service
- `database` - Database

**Arrow Types:**

- `->` - Solid line (synchronous)
- `-->` - Dotted line (response)
- `->>` - Solid arrow (async message)
- `-->>` - Dotted arrow (async response)

**Example - Authentication Flow:**

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant Clerk
    participant DB

    User->>Frontend: Enter credentials
    Frontend->>Clerk: Login request
    Clerk->>Clerk: Validate credentials
    alt Credentials valid
        Clerk-->>Frontend: JWT token
        Frontend->>API: Request with token
        API->>Clerk: Verify token
        Clerk-->>API: Token valid
        API->>DB: Fetch user data
        DB-->>API: User data
        API-->>Frontend: User session
        Frontend-->>User: Logged in
    else Credentials invalid
        Clerk-->>Frontend: Auth error
        Frontend-->>User: Show error
    end
```

**Validation:**

- [ ] All participants identified
- [ ] Message flow logical
- [ ] Return messages shown
- [ ] Alt/loop blocks used correctly

**Output**: Sequence diagram

### Step 4: ERD Creation

**Objective**: Document database schema and relationships

**Syntax:**

```mermaid
erDiagram
    USER ||--o{ BOOKING : creates
    ACCOMMODATION ||--o{ BOOKING : "booked for"
    USER {
        uuid id PK
        string email UK
        string name
        timestamp created_at
    }
    BOOKING {
        uuid id PK
        uuid user_id FK
        uuid accommodation_id FK
        date check_in
        date check_out
        enum status
    }
    ACCOMMODATION {
        uuid id PK
        string name
        text description
        decimal price_per_night
    }
```

**Relationship Types:**

- `||--||` - One to one
- `||--o{` - One to many
- `}o--o{` - Many to many
- `||--o|` - One to zero or one

**Cardinality Symbols:**

- `||` - Exactly one
- `o|` - Zero or one
- `}o` - Zero or more
- `}|` - One or more

**Example - Full Hospeda ERD:**

```mermaid
erDiagram
    USER ||--o{ BOOKING : creates
    USER ||--o{ REVIEW : writes
    USER ||--o{ ACCOMMODATION : owns
    ACCOMMODATION ||--o{ BOOKING : "has bookings"
    ACCOMMODATION ||--o{ REVIEW : "has reviews"
    ACCOMMODATION }o--o{ AMENITY : includes
    BOOKING ||--|| PAYMENT : "has payment"

    USER {
        uuid id PK
        string clerk_id UK
        string email UK
        string name
        enum role
        timestamp created_at
    }

    ACCOMMODATION {
        uuid id PK
        uuid owner_id FK
        string name
        text description
        decimal price_per_night
        int max_guests
        enum status
    }

    BOOKING {
        uuid id PK
        uuid user_id FK
        uuid accommodation_id FK
        date check_in
        date check_out
        int guests
        enum status
        decimal total_price
    }

    REVIEW {
        uuid id PK
        uuid user_id FK
        uuid accommodation_id FK
        int rating
        text comment
        timestamp created_at
    }

    PAYMENT {
        uuid id PK
        uuid booking_id FK
        string mercadopago_id UK
        decimal amount
        enum status
        timestamp processed_at
    }

    AMENITY {
        uuid id PK
        string name
        string icon
    }
```

**Validation:**

- [ ] All entities defined
- [ ] Relationships accurate
- [ ] Cardinality correct
- [ ] Primary/Foreign keys marked

**Output**: ERD diagram

### Step 5: C4 Architecture Diagrams

**Objective**: Document system architecture at different levels

**Context Level** (System in environment):

```mermaid
C4Context
    title System Context - Hospeda Platform

    Person(guest, "Guest", "Tourist looking for accommodation")
    Person(owner, "Owner", "Accommodation owner")
    System(hospeda, "Hospeda Platform", "Tourism booking platform")

    System_Ext(clerk, "Clerk", "Authentication provider")
    System_Ext(mercadopago, "Mercado Pago", "Payment processor")
    System_Ext(email, "Email Service", "Transactional emails")

    Rel(guest, hospeda, "Searches and books", "HTTPS")
    Rel(owner, hospeda, "Manages listings", "HTTPS")
    Rel(hospeda, clerk, "Authenticates users", "API")
    Rel(hospeda, mercadopago, "Processes payments", "API")
    Rel(hospeda, email, "Sends notifications", "SMTP")
```

**Container Level** (Applications and data stores):

```mermaid
C4Container
    title Container - Hospeda Platform

    Person(user, "User")

    Container(web, "Web App", "Astro + React", "Public-facing website")
    Container(admin, "Admin Panel", "TanStack Start", "Management interface")
    Container(api, "API", "Hono", "Backend services")
    ContainerDb(db, "Database", "PostgreSQL", "Stores all data")

    Rel(user, web, "Uses", "HTTPS")
    Rel(user, admin, "Manages", "HTTPS")
    Rel(web, api, "Calls", "JSON/HTTPS")
    Rel(admin, api, "Calls", "JSON/HTTPS")
    Rel(api, db, "Reads/Writes", "SQL")
```

**Component Level** (Internal structure):

```mermaid
C4Component
    title Components - API Application

    Container(api, "API", "Hono")

    Component(routes, "Routes", "Hono Router", "HTTP endpoints")
    Component(services, "Services", "Business Logic", "Domain operations")
    Component(models, "Models", "Data Access", "DB operations")
    Component(middleware, "Middleware", "Cross-cutting", "Auth, logging, errors")

    Rel(routes, middleware, "Uses")
    Rel(routes, services, "Calls")
    Rel(services, models, "Uses")
    Rel(models, db, "Queries")
```

**Validation:**

- [ ] Appropriate level selected
- [ ] All systems/containers shown
- [ ] Relationships clear
- [ ] External systems identified

**Output**: C4 architecture diagrams

### Step 6: State Diagram Creation

**Objective**: Document state machines and lifecycles

**Syntax:**

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Confirmed : Payment Success
    Pending --> Cancelled : Payment Failed
    Pending --> Cancelled : User Cancels
    Confirmed --> CheckedIn : Check-in Date
    Confirmed --> Cancelled : Cancellation Request
    CheckedIn --> CheckedOut : Check-out Date
    CheckedOut --> Reviewed : User Submits Review
    CheckedOut --> [*] : 30 Days Elapsed
    Reviewed --> [*]
    Cancelled --> [*]
```

**Example - Booking Lifecycle:**

```mermaid
stateDiagram-v2
    [*] --> Draft : Create Booking

    state "Pending Payment" as Pending
    state "Payment Processing" as Processing

    Draft --> Pending : Submit Booking
    Pending --> Processing : Initiate Payment

    Processing --> Confirmed : Payment Approved
    Processing --> PaymentFailed : Payment Declined

    PaymentFailed --> Pending : Retry Payment
    PaymentFailed --> Cancelled : Max Retries

    Confirmed --> Active : Check-in Date Reached
    Active --> Completed : Check-out Date Reached

    Confirmed --> CancelRequested : Cancellation Request
    CancelRequested --> RefundProcessing : Approve Cancellation
    RefundProcessing --> Cancelled : Refund Complete

    Completed --> [*]
    Cancelled --> [*]

    note right of Confirmed
        Owner notified
        Calendar blocked
    end note

    note right of Completed
        Review requested
        Payment released
    end note
```

**Validation:**

- [ ] All states defined
- [ ] Transitions logical
- [ ] Start/end states marked
- [ ] Notes explain key states

**Output**: State diagram

### Step 7: Styling and Customization

**Objective**: Apply consistent styling to diagrams

**Theme Application:**

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor':'#3B82F6',
  'primaryTextColor':'#fff',
  'primaryBorderColor':'#2563EB',
  'lineColor':'#6B7280',
  'secondaryColor':'#10B981',
  'tertiaryColor':'#F59E0B'
}}}%%
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
```

**Class Styling:**

```mermaid
flowchart TD
    A[Normal] --> B[Success]
    B --> C[Error]

    classDef successClass fill:#10B981,stroke:#059669,color:#fff
    classDef errorClass fill:#EF4444,stroke:#DC2626,color:#fff

    class B successClass
    class C errorClass
```

**Validation:**

- [ ] Colors match brand
- [ ] Contrast sufficient
- [ ] Styling consistent
- [ ] Readable in both themes

**Output**: Styled diagrams

## Output

**Produces:**

- Mermaid diagram code in markdown
- Multiple diagram types as needed
- Styled and themed diagrams
- Documentation-ready visualizations

**Success Criteria:**

- Diagram accurately represents system
- All elements properly labeled
- Relationships clear and correct
- Styling consistent with brand
- Renders correctly in markdown

## Best Practices

1. **Simplicity**: Keep diagrams focused and uncluttered
2. **Labels**: Clear, descriptive labels for all elements
3. **Direction**: Consistent flow direction (usually top-down or left-right)
4. **Grouping**: Use subgraphs to group related elements
5. **Colors**: Use color to highlight important elements
6. **Notes**: Add notes to explain complex logic
7. **Levels**: Use appropriate abstraction level for audience
8. **Updates**: Keep diagrams in sync with code
9. **Comments**: Add comments in mermaid code for maintainability
10. **Testing**: Verify diagrams render in target platform

## Common Patterns

### API Request Flow

```mermaid
sequenceDiagram
    Client->>+API: GET /resource
    API->>+Service: fetchResource()
    Service->>+Model: findById()
    Model->>+DB: SELECT query
    DB-->>-Model: Row data
    Model-->>-Service: Entity
    Service-->>-API: DTO
    API-->>-Client: JSON response
```

### Error Handling Flow

```mermaid
flowchart TD
    Request[Incoming Request] --> Validate{Valid?}
    Validate -->|No| ValidationError[Validation Error]
    ValidationError --> ErrorHandler[Error Handler]
    Validate -->|Yes| Process[Process Request]
    Process --> DB{DB Success?}
    DB -->|No| DBError[Database Error]
    DBError --> ErrorHandler
    DB -->|Yes| Success[Success Response]
    ErrorHandler --> LogError[Log Error]
    LogError --> ErrorResponse[Error Response]
```

## Notes

- Mermaid renders in GitHub, GitLab, Notion, and most markdown viewers
- Live editor available at mermaid.live
- Maximum complexity: Keep under 20 nodes for readability
- Use subgraphs for grouping related nodes
- Test rendering in target platform before committing
- Keep diagram source in markdown files, not images
- Version control diagrams with code
- Update diagrams during code review

---
