# AI API Testing Agent — Standalone Python Core

This is the standalone Python core implementation of the **AI API Testing Agent**. It serves as a fully functional reference engine to discover REST API endpoints from an OpenAPI/Swagger specification, generate functional (positive/negative), boundary, and security test cases, execute them, validate their response structures, and compile reports.

## Features

1. **API Discovery & Specification Reading:** Reads OpenAPI (JSON/YAML) files and maps endpoints, methods, headers, parameters, and authentication configurations.
2. **Intelligent Test Case Generator:** Creates positive tests (happy paths), negative tests (nulls, missing parameters, invalid types), boundary tests, and authentication failure checks.
3. **Execution Engine:** Asynchronously or synchronously executes HTTP requests using `httpx` or `requests`.
4. **Validation & Verification:** Validates response status codes, content-types, JSON schemas (Pydantic/jsonschema), response times, and required headers.
5. **Security Testing (OWASP API Top 10):** Performs automated audits for SQL Injection, XSS, broken auth, sensitive data leaks, and lack of rate limiting.
6. **AI Explanation & Recommendations:** Integrates with OpenAI/Anthropic APIs (with fallback mock templates) to analyze failed tests and output developer-focused fixes.
7. **Report Compilation:** Compiles execution results into Markdown, JSON, and HTML dashboard reports.

## Folder Structure

```
api-testing-agent/
├── parsers/          # Parses OpenAPI / Swagger / Postman specifications
│   ├── __init__.py
│   └── openapi.py
├── validators/       # Validates HTTP responses against schemas
│   ├── __init__.py
│   └── response.py
├── security/         # Runs OWASP API Top 10 vulnerability checks
│   ├── __init__.py
│   └── auditor.py
├── performance/      # Measures response times and latency
│   ├── __init__.py
│   └── load_tester.py
├── reports/          # Formats test results (JSON, HTML, Markdown)
│   ├── __init__.py
│   └── generator.py
├── config/           # General configurations
│   ├── __init__.py
│   └── settings.py
├── examples/         # Sample OpenAPI files and specs
│   └── petstore.json
├── main.py           # Command-line entrypoint
├── requirements.txt  # Project dependencies
└── README.md         # Project documentation
```

## Quick Start

### 1. Prerequisites
- Python 3.9+
- An OpenAPI/Swagger specification file (e.g. `petstore.json`)
- (Optional) OpenAI or Anthropic API key for AI-powered failure recommendations

### 2. Installation
```bash
cd api-testing-agent
pip install -r requirements.txt
```

### 3. Usage
Run tests on an OpenAPI specification file:

```bash
# Basic run with mock target base URL
python main.py --spec examples/petstore.json --base-url https://api.petstore.swagger.io/v2

# Run security audit only
python main.py --spec examples/petstore.json --base-url https://api.petstore.swagger.io/v2 --security-only

# Run tests and generate an HTML report
python main.py --spec examples/petstore.json --base-url https://api.petstore.swagger.io/v2 --html-report report.html
```

## Security & OWASP Coverage
The agent checks for:
* **Broken Object Level Authorization (IDOR):** Scans for sequential or guest IDs in parameters.
* **SQL Injection (SQLi):** Injects common payloads (`' OR 1=1 --`, etc.) into parameters and evaluates errors.
* **Cross-Site Scripting (XSS):** Injects `<script>alert(1)</script>` inside payloads and flags echoed strings in HTML responses.
* **Rate Limiting:** Issues multiple quick sequential requests and monitors if HTTP `429 Too Many Requests` is supported.
