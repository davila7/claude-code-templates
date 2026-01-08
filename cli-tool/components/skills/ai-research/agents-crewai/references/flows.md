# CrewAI Flows Guide

## Overview

Flows provide event-driven orchestration with precise control over execution paths, state management, and conditional branching. Use Flows when you need more control than Crews provide.

## When to Use Flows vs Crews

| Scenario | Use Crews | Use Flows |
|----------|-----------|-----------|
| Simple multi-agent collaboration | ✅ | |
| Sequential/hierarchical tasks | ✅ | |
| Conditional branching | | ✅ |
| Complex state management | | ✅ |
| Event-driven workflows | | ✅ |
| Hybrid (Crews inside Flow steps) | | ✅ |

## Flow Basics

### Creating a Flow

```python
from crewai.flow.flow import Flow, listen, start, router, or_, and_
from pydantic import BaseModel

# Define state model
class MyState(BaseModel):
    counter: int = 0
    data: str = ""
    results: list = []

# Create flow with typed state
class MyFlow(Flow[MyState]):

    @start()
    def initialize(self):
        """Entry point - runs first"""
        self.state.counter = 1
        return {"initialized": True}

    @listen(initialize)
    def process(self, data):
        """Runs after initialize completes"""
        self.state.counter += 1
        return f"Processed: {data}"

# Run flow
flow = MyFlow()
result = flow.kickoff()
print(flow.state.counter)  # Access final state
```

### Flow Decorators

#### @start() - Entry Point

```python
@start()
def begin(self):
    """First method(s) to execute"""
    return {"status": "started"}

# Multiple start points (run in parallel)
@start()
def start_a(self):
    return "A"

@start()
def start_b(self):
    return "B"
```

#### @listen() - Event Trigger

```python
# Listen to single method
@listen(initialize)
def after_init(self, result):
    """Runs when initialize completes"""
    return process(result)

# Listen to string name
@listen("high_confidence")
def handle_high(self):
    """Runs when router returns 'high_confidence'"""
    pass
```

#### @router() - Conditional Branching

```python
@router(analyze)
def decide_path(self):
    """Returns string to route to specific listener"""
    if self.state.confidence > 0.8:
        return "high_confidence"
    elif self.state.confidence > 0.5:
        return "medium_confidence"
    return "low_confidence"

@listen("high_confidence")
def handle_high(self):
    pass

@listen("medium_confidence")
def handle_medium(self):
    pass

@listen("low_confidence")
def handle_low(self):
    pass
```

#### or_() and and_() - Conditional Combinations

```python
from crewai.flow.flow import or_, and_

# Triggers when EITHER condition is met
@listen(or_("success", "partial_success"))
def handle_any_success(self):
    pass

# Triggers when BOTH conditions are met
@listen(and_(task_a, task_b))
def after_both_complete(self):
    pass
```

## State Management

### Pydantic State Model

```python
from pydantic import BaseModel, Field
from typing import Optional

class WorkflowState(BaseModel):
    # Required fields
    input_data: str

    # Optional with defaults
    processed: bool = False
    confidence: float = 0.0
    results: list = Field(default_factory=list)
    error: Optional[str] = None

    # Nested models
    metadata: dict = Field(default_factory=dict)

class MyFlow(Flow[WorkflowState]):
    @start()
    def init(self):
        # Access state
        print(self.state.input_data)

        # Modify state
        self.state.processed = True
        self.state.results.append("item")
        self.state.metadata["timestamp"] = "2025-01-01"
```

### State Initialization

```python
# Initialize with inputs
flow = MyFlow()
result = flow.kickoff(inputs={"input_data": "my data"})

# Or set state before kickoff
flow.state.input_data = "my data"
result = flow.kickoff()
```

## Integrating Crews in Flows

### Crew as Flow Step

```python
from crewai import Crew, Agent, Task, Process
from crewai.flow.flow import Flow, listen, start

class ResearchFlow(Flow[ResearchState]):

    @start()
    def gather_requirements(self):
        return {"topic": self.state.topic}

    @listen(gather_requirements)
    def run_research_crew(self, requirements):
        # Define crew
        researcher = Agent(
            role="Researcher",
            goal="Research {topic}",
            backstory="Expert researcher"
        )

        research_task = Task(
            description="Research {topic} thoroughly",
            expected_output="Detailed findings",
            agent=researcher
        )

        crew = Crew(
            agents=[researcher],
            tasks=[research_task],
            process=Process.sequential
        )

        # Execute crew within flow
        result = crew.kickoff(inputs=requirements)
        self.state.research_output = result.raw
        return result

    @listen(run_research_crew)
    def process_results(self, crew_result):
        # Process crew output
        return {"summary": self.state.research_output[:500]}
```

### Multiple Crews in Flow

```python
class MultiCrewFlow(Flow[MultiState]):

    @start()
    def init(self):
        return {"ready": True}

    @listen(init)
    def research_phase(self, data):
        return research_crew.kickoff(inputs={"topic": self.state.topic})

    @listen(research_phase)
    def writing_phase(self, research):
        return writing_crew.kickoff(inputs={"research": research.raw})

    @listen(writing_phase)
    def review_phase(self, draft):
        return review_crew.kickoff(inputs={"draft": draft.raw})
```

## Complex Flow Patterns

### Parallel Execution

```python
class ParallelFlow(Flow[ParallelState]):

    @start()
    def init(self):
        return {"ready": True}

    # These run in parallel after init
    @listen(init)
    def branch_a(self, data):
        return crew_a.kickoff()

    @listen(init)
    def branch_b(self, data):
        return crew_b.kickoff()

    @listen(init)
    def branch_c(self, data):
        return crew_c.kickoff()

    # Waits for all branches
    @listen(and_(branch_a, branch_b, branch_c))
    def merge_results(self):
        return {
            "a": self.state.result_a,
            "b": self.state.result_b,
            "c": self.state.result_c
        }
```

### Error Handling

```python
class RobustFlow(Flow[RobustState]):

    @start()
    def risky_operation(self):
        try:
            result = perform_operation()
            self.state.success = True
            return result
        except Exception as e:
            self.state.error = str(e)
            self.state.success = False
            return {"error": str(e)}

    @router(risky_operation)
    def handle_result(self):
        if self.state.success:
            return "success"
        return "failure"

    @listen("success")
    def continue_flow(self):
        pass

    @listen("failure")
    def handle_error(self):
        # Retry, alert, or graceful degradation
        pass
```

### Loops and Retries

```python
class RetryFlow(Flow[RetryState]):

    @start()
    def attempt_task(self):
        result = try_operation()
        self.state.attempts += 1
        self.state.last_result = result
        return result

    @router(attempt_task)
    def check_result(self):
        if self.state.last_result.get("success"):
            return "success"
        if self.state.attempts >= 3:
            return "max_retries"
        return "retry"

    @listen("retry")
    def retry_task(self):
        # Recursively call start
        return self.attempt_task()

    @listen("success")
    def finish(self):
        return {"completed": True}

    @listen("max_retries")
    def fail(self):
        return {"error": "Max retries exceeded"}
```

## Flow Visualization

```bash
# Create flow project
crewai create flow my_flow
cd my_flow

# Plot flow diagram
crewai flow plot
```

This generates a visual representation of your flow's execution paths.

## Best Practices

1. **Use typed state** - Pydantic models catch errors early
2. **Keep methods focused** - Single responsibility per method
3. **Clear routing logic** - Router decisions should be simple
4. **Handle errors** - Add error paths for robustness
5. **Test incrementally** - Test each path independently
6. **Use logging** - Add verbose output for debugging
7. **Manage state carefully** - Don't mutate state in unexpected ways

## Common Patterns

### Data Pipeline

```python
class DataPipeline(Flow[PipelineState]):
    @start()
    def extract(self):
        return extract_data()

    @listen(extract)
    def transform(self, data):
        return transform_data(data)

    @listen(transform)
    def load(self, data):
        return load_data(data)
```

### Approval Workflow

```python
class ApprovalFlow(Flow[ApprovalState]):
    @start()
    def create_request(self):
        return create_request()

    @listen(create_request)
    def review(self, request):
        return review_crew.kickoff(inputs=request)

    @router(review)
    def approval_decision(self):
        if self.state.approved:
            return "approved"
        return "rejected"

    @listen("approved")
    def execute(self):
        return execute_request()

    @listen("rejected")
    def notify_rejection(self):
        return send_notification()
```

### Multi-Stage Analysis

```python
class AnalysisFlow(Flow[AnalysisState]):
    @start()
    def collect_data(self):
        return data_collection_crew.kickoff()

    @listen(collect_data)
    def analyze(self, data):
        return analysis_crew.kickoff(inputs={"data": data})

    @router(analyze)
    def quality_check(self):
        if self.state.confidence > 0.8:
            return "high_quality"
        return "needs_review"

    @listen("high_quality")
    def generate_report(self):
        return report_crew.kickoff()

    @listen("needs_review")
    def request_human_review(self):
        self.state.needs_human = True
        return "Awaiting human review"
```
