# Structured Generation Guide

Complete guide to generating structured outputs with SGLang.

## JSON Generation

### Basic JSON output

```python
import sglang as sgl

@sgl.function
def basic_json(s, text):
    s += f"Extract person info from: {text}\n"
    s += "Output as JSON:\n"

    # Simple regex for JSON object
    s += sgl.gen(
        "json",
        max_tokens=150,
        regex=r'\{[^}]+\}'  # Basic JSON pattern
    )

state = basic_json.run(text="Alice is a 28-year-old doctor")
print(state["json"])
# Output: {"name": "Alice", "age": 28, "profession": "doctor"}
```

### JSON with schema validation

```python
@sgl.function
def schema_json(s, description):
    s += f"Create a product from: {description}\n"

    # Detailed JSON schema
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "price": {"type": "number", "minimum": 0},
            "category": {
                "type": "string",
                "enum": ["electronics", "clothing", "food", "books"]
            },
            "in_stock": {"type": "boolean"},
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
                "maxItems": 5
            }
        },
        "required": ["name", "price", "category", "in_stock"]
    }

    s += sgl.gen("product", max_tokens=300, json_schema=schema)

state = schema_json.run(
    description="Wireless headphones, $79.99, currently available, audio"
)
print(state["product"])
# Output: Valid JSON matching schema exactly
```

**Output example**:
```json
{
  "name": "Wireless Headphones",
  "price": 79.99,
  "category": "electronics",
  "in_stock": true,
  "tags": ["audio", "wireless", "bluetooth"]
}
```

### Nested JSON structures

```python
schema = {
    "type": "object",
    "properties": {
        "user": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "name": {"type": "string"},
                "email": {"type": "string", "format": "email"}
            },
            "required": ["id", "name", "email"]
        },
        "orders": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "total": {"type": "number"},
                    "items": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "required": ["order_id", "total"]
            }
        }
    },
    "required": ["user", "orders"]
}

@sgl.function
def nested_json(s, data):
    s += f"Convert to JSON: {data}\n"
    s += sgl.gen("output", max_tokens=500, json_schema=schema)
```

## Regex-Constrained Generation

### Email extraction

```python
@sgl.function
def extract_email(s, text):
    s += f"Find email in: {text}\n"
    s += "Email: "

    # Email regex
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    s += sgl.gen("email", max_tokens=30, regex=email_pattern)

state = extract_email.run(text="Contact support at help@company.com")
print(state["email"])
# Output: "help@company.com" (guaranteed valid email format)
```

### Phone number extraction

```python
@sgl.function
def extract_phone(s, text):
    s += f"Extract phone from: {text}\n"
    s += "Phone: "

    # US phone number pattern
    phone_pattern = r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    s += sgl.gen("phone", max_tokens=20, regex=phone_pattern)

state = extract_phone.run(text="Call me at (555) 123-4567")
print(state["phone"])
# Output: "(555) 123-4567"
```

### URL generation

```python
@sgl.function
def generate_url(s, domain, path):
    s += f"Create URL for domain {domain} with path {path}\n"
    s += "URL: "

    # URL pattern
    url_pattern = r'https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/[a-zA-Z0-9._~:/?#\[\]@!$&\'()*+,;=-]*)?'
    s += sgl.gen("url", max_tokens=50, regex=url_pattern)

state = generate_url.run(domain="example.com", path="/api/users")
print(state["url"])
# Output: "https://example.com/api/users"
```

### Date extraction

```python
@sgl.function
def extract_date(s, text):
    s += f"Find date in: {text}\n"
    s += "Date (YYYY-MM-DD): "

    # ISO date pattern
    date_pattern = r'\d{4}-\d{2}-\d{2}'
    s += sgl.gen("date", max_tokens=15, regex=date_pattern)

state = extract_date.run(text="Event scheduled for 2025-03-15")
print(state["date"])
# Output: "2025-03-15" (always valid format)
```

## Grammar-Based Generation

### EBNF grammar for Python

```python
python_grammar = """
?start: statement+

?statement: assignment
          | if_stmt
          | function_def
          | return_stmt

assignment: NAME "=" expr

if_stmt: "if" expr ":" suite ("elif" expr ":" suite)* ("else" ":" suite)?

function_def: "def" NAME "(" [parameters] "):" suite

return_stmt: "return" expr

?suite: simple_stmt | NEWLINE INDENT statement+ DEDENT

?simple_stmt: assignment | return_stmt | expr

?expr: NAME
     | NUMBER
     | STRING
     | expr "+" expr
     | expr "-" expr
     | expr "*" expr
     | expr "/" expr
     | NAME "(" [arguments] ")"

parameters: NAME ("," NAME)*
arguments: expr ("," expr)*

%import common.CNAME -> NAME
%import common.NUMBER
%import common.ESCAPED_STRING -> STRING
%import common.WS
%import common.NEWLINE
%import common.INDENT
%import common.DEDENT

%ignore WS
"""

@sgl.function
def generate_python(s, description):
    s += f"Generate Python function for: {description}\n"
    s += "```python\n"
    s += sgl.gen("code", max_tokens=300, grammar=python_grammar)
    s += "\n```"

state = generate_python.run(
    description="Calculate factorial of a number"
)
print(state["code"])
# Output: Valid Python code following grammar
```

### SQL query grammar

```python
sql_grammar = """
?start: select_stmt

select_stmt: "SELECT" column_list "FROM" table_name [where_clause] [order_clause] [limit_clause]

column_list: column ("," column)*
           | "*"

column: NAME
      | NAME "." NAME
      | NAME "AS" NAME

table_name: NAME

where_clause: "WHERE" condition

condition: NAME "=" value
         | NAME ">" value
         | NAME "<" value
         | condition "AND" condition
         | condition "OR" condition

order_clause: "ORDER BY" NAME ["ASC" | "DESC"]

limit_clause: "LIMIT" NUMBER

?value: STRING | NUMBER | "NULL"

%import common.CNAME -> NAME
%import common.NUMBER
%import common.ESCAPED_STRING -> STRING
%import common.WS

%ignore WS
"""

@sgl.function
def generate_sql(s, description):
    s += f"Generate SQL query for: {description}\n"
    s += sgl.gen("query", max_tokens=200, grammar=sql_grammar)

state = generate_sql.run(
    description="Find all active users sorted by join date"
)
print(state["query"])
# Output: SELECT * FROM users WHERE status = 'active' ORDER BY join_date DESC
```

## Multi-Step Structured Workflows

### Information extraction pipeline

```python
@sgl.function
def extract_structured_info(s, article):
    # Step 1: Extract entities
    s += f"Article: {article}\n\n"
    s += "Extract named entities:\n"

    entities_schema = {
        "type": "object",
        "properties": {
            "people": {"type": "array", "items": {"type": "string"}},
            "organizations": {"type": "array", "items": {"type": "string"}},
            "locations": {"type": "array", "items": {"type": "string"}},
            "dates": {"type": "array", "items": {"type": "string"}}
        }
    }

    s += sgl.gen("entities", max_tokens=200, json_schema=entities_schema)

    # Step 2: Classify sentiment
    s += "\n\nClassify sentiment:\n"

    sentiment_schema = {
        "type": "object",
        "properties": {
            "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1}
        }
    }

    s += sgl.gen("sentiment", max_tokens=50, json_schema=sentiment_schema)

    # Step 3: Generate summary
    s += "\n\nGenerate brief summary (max 50 words):\n"
    s += sgl.gen("summary", max_tokens=75, stop=["\n\n"])

# Run pipeline
state = extract_structured_info.run(article="...")

print("Entities:", state["entities"])
print("Sentiment:", state["sentiment"])
print("Summary:", state["summary"])
```

### Form filling workflow

```python
@sgl.function
def fill_form(s, user_input):
    s += "Fill out the application form based on: " + user_input + "\n\n"

    # Name
    s += "Full Name: "
    s += sgl.gen("name", max_tokens=30, regex=r'[A-Z][a-z]+ [A-Z][a-z]+', stop=["\n"])

    # Email
    s += "\nEmail: "
    s += sgl.gen("email", max_tokens=50, regex=r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', stop=["\n"])

    # Phone
    s += "\nPhone: "
    s += sgl.gen("phone", max_tokens=20, regex=r'\d{3}-\d{3}-\d{4}', stop=["\n"])

    # Address (structured JSON)
    s += "\nAddress (JSON): "
    address_schema = {
        "type": "object",
        "properties": {
            "street": {"type": "string"},
            "city": {"type": "string"},
            "state": {"type": "string", "pattern": "^[A-Z]{2}$"},
            "zip": {"type": "string", "pattern": "^\\d{5}$"}
        },
        "required": ["street", "city", "state", "zip"]
    }
    s += sgl.gen("address", max_tokens=150, json_schema=address_schema)

state = fill_form.run(
    user_input="John Doe, john.doe@email.com, 555-123-4567, 123 Main St, Boston MA 02101"
)

print("Name:", state["name"])
print("Email:", state["email"])
print("Phone:", state["phone"])
print("Address:", state["address"])
```

## Error Handling and Validation

### Retry on invalid format

```python
@sgl.function
def extract_with_retry(s, text, max_retries=3):
    schema = {
        "type": "object",
        "properties": {
            "value": {"type": "number"},
            "unit": {"type": "string", "enum": ["kg", "lb", "g"]}
        },
        "required": ["value", "unit"]
    }

    for attempt in range(max_retries):
        s += f"Extract weight from: {text}\n"
        s += f"Attempt {attempt + 1}:\n"
        s += sgl.gen(f"output_{attempt}", max_tokens=100, json_schema=schema)

        # Validate (in production, check if parsing succeeded)
        # If valid, break; else continue

state = extract_with_retry.run(text="Package weighs 5.2 kilograms")
```

### Fallback to less strict pattern

```python
@sgl.function
def extract_email_flexible(s, text):
    s += f"Extract email from: {text}\n"

    # Try strict pattern first
    s += "Email (strict): "
    s += sgl.gen(
        "email_strict",
        max_tokens=30,
        regex=r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        temperature=0.0
    )

    # If fails, fallback to looser pattern
    s += "\nEmail (loose): "
    s += sgl.gen(
        "email_loose",
        max_tokens=30,
        regex=r'\S+@\S+',
        temperature=0.0
    )
```

## Performance Tips

### Optimize regex patterns

```python
# BAD: Too complex, slow
complex_pattern = r'(https?://)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(/[a-zA-Z0-9._~:/?#\[\]@!$&\'()*+,;=-]*)?'

# GOOD: Simpler, faster
simple_pattern = r'https?://[a-z0-9.-]+\.[a-z]{2,}'
```

### Cache compiled grammars

```python
# Compile grammar once
from lark import Lark
compiled_grammar = Lark(python_grammar, start='start')

# Reuse across requests
@sgl.function
def gen_with_cached_grammar(s, desc):
    s += sgl.gen("code", max_tokens=200, grammar=compiled_grammar)
```

### Batch structured generation

```python
# Generate multiple structured outputs in parallel
results = sgl.run_batch([
    extract_person.bind(text="Alice, 30, engineer"),
    extract_person.bind(text="Bob, 25, doctor"),
    extract_person.bind(text="Carol, 35, teacher")
])

# All processed efficiently with RadixAttention
```

## Real-World Examples

### API response generation

```python
@sgl.function
def api_response(s, query, data):
    s += f"Generate API response for query: {query}\n"
    s += f"Data: {data}\n\n"

    api_schema = {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["success", "error"]},
            "data": {"type": "object"},
            "message": {"type": "string"},
            "timestamp": {"type": "string"}
        },
        "required": ["status", "data", "message"]
    }

    s += sgl.gen("response", max_tokens=300, json_schema=api_schema)

# Always returns valid API response format
```

### Database query builder

```python
@sgl.function
def build_query(s, natural_language):
    s += f"Convert to SQL: {natural_language}\n"
    s += "SELECT "
    s += sgl.gen("columns", max_tokens=50, stop=[" FROM"])
    s += " FROM "
    s += sgl.gen("table", max_tokens=20, stop=[" WHERE", "\n"])
    s += " WHERE "
    s += sgl.gen("condition", max_tokens=100, stop=[" ORDER", "\n"])

state = build_query.run(
    natural_language="Get all names and emails of users who joined after 2024"
)
# Output: Valid SQL query
```

### Code generation with syntax guarantee

```python
@sgl.function
def generate_function(s, spec):
    s += f"Generate Python function for: {spec}\n"
    s += "def "
    s += sgl.gen("func_name", max_tokens=15, regex=r'[a-z_][a-z0-9_]*', stop=["("])
    s += "("
    s += sgl.gen("params", max_tokens=30, stop=[")"])
    s += "):\n    "
    s += sgl.gen("body", max_tokens=200, grammar=python_grammar)

# Always generates syntactically valid Python
```
