import argparse
import sys
import time
import httpx
from typing import Dict, Any, List

from parsers.openapi import OpenAPIParser
from validators.response import ResponseValidator
from security.auditor import SecurityAuditor
from performance.load_tester import PerformanceAnalyzer
from reports.generator import ReportGenerator

# AI-Powered Fallback Recommendation Engine
# Supplying developer-friendly analysis for failed tests (simulating LLM reasoning)
def get_ai_recommendation(endpoint: str, method: str, status_code: int, error_msg: str, category: str = "functional") -> Dict[str, str]:
    if status_code == 401 or status_code == 403:
        return {
            "cause": "The request lacked valid credentials, token was expired, or the client is not authorized for this resource.",
            "fix": "Verify that your API keys or Bearer JWT are present in the HTTP headers and have not expired. Check API Gateway routing policies."
        }
    elif status_code == 500:
        if "sql" in error_msg.lower() or "mysql" in error_msg.lower() or "postgresql" in error_msg.lower():
            return {
                "cause": "The backend database encountered a query error or syntax exception when processing this parameter.",
                "fix": "Ensure inputs are parameterized in your database query logic. Do not build raw strings with user inputs. Inspect DB server logs."
            }
        return {
            "cause": f"Unhandled backend exception occurred during the execution of {method} {endpoint}.",
            "fix": "Check backend application stack traces. Implement thorough null-checks and payload validation handlers before DB writes."
        }
    elif status_code == 0:  # Network connection failed
        return {
            "cause": "Failed to connect to the target API host. The server might be down, the URL incorrect, or blocked by a firewall/proxy.",
            "fix": "Confirm the target server is active and check network connectivity. Ensure the hostname matches the staging or local dev environment."
        }
    elif "schema" in error_msg.lower():
        return {
            "cause": "The response payload structure does not match the JSON schema declared in the OpenAPI specification.",
            "fix": "Update either the backend model (e.g. Pydantic schema) or synchronize the Swagger file to reflect recent field additions or type changes."
        }
    
    # Generic security category fallback
    if category == "security":
        return {
            "cause": f"Vulnerability warning detected: API accepted malicious payloads or returned verbose diagnostics.",
            "fix": "Validate all input bounds on the server. Filter out HTML/SQL metacharacters, and ensure rate limits are strictly enforced."
        }
        
    return {
        "cause": f"Response validation failed with error: {error_msg}",
        "fix": "Verify client request payloads and inspect the server-side log files for exceptions."
    }

def run_tests(spec_path: str, base_url: str, security_only: bool) -> Tuple[List[Dict[str, Any]], List[float], List[int]]:
    print(f"📖 Parsing OpenAPI Specification: {spec_path}")
    parser = OpenAPIParser(spec_path)
    endpoints = parser.get_endpoints()
    security_schemes = parser.get_security_schemes()
    
    print(f"⚙️ Found {len(endpoints)} endpoints in specification.")
    
    test_runs = []
    latencies = []
    status_codes = []
    
    # Initialize HTTP client
    headers = {
        "User-Agent": "AI-API-Testing-Agent/1.0.0",
        "Content-Type": "application/json"
    }
    
    # Simple token placeholder for demonstration purposes
    headers["Authorization"] = "Bearer api_testing_agent_dummy_token"
    
    with httpx.Client(base_url=base_url, timeout=5.0) as client:
        for idx, ep in enumerate(endpoints, 1):
            path = ep['path']
            method = ep['method']
            
            if security_only:
                # Generate security test cases only
                sec_auditor = SecurityAuditor()
                # 1. Broken Auth cases
                auth_cases = sec_auditor.audit_authentication(headers, security_schemes)
                # 2. SQLi cases
                sqli_cases = sec_auditor.audit_sqli(path, ep['parameters'], ep['request_body'])
                
                print(f"\n🔐 [{idx}/{len(endpoints)}] Auditing security for {method} {path}...")
                
                # Combine security cases
                sec_cases = auth_cases + sqli_cases
                if not sec_cases:
                    print("  (No security parameters or auth rules to audit on this endpoint)")
                    continue
                    
                for sc in sec_cases:
                    desc = sc['description']
                    print(f"  ⚡ Running audit: {desc}")
                    
                    req_headers = sc.get('modified_headers') or headers
                    req_params = {}
                    req_body = {}
                    
                    # Handle injection setups
                    param_inj = sc.get('parameter_inject')
                    body_inj = sc.get('body_inject')
                    
                    target_path = path
                    if param_inj:
                        if param_inj['in'] == 'query':
                            req_params[param_inj['name']] = param_inj['value']
                        elif param_inj['in'] == 'path':
                            target_path = path.replace(f"{{{param_inj['name']}}}", param_inj['value'])
                            
                    if body_inj:
                        req_body[body_inj['field']] = body_inj['value']
                        
                    # Execute security case
                    start_time = time.time()
                    try:
                        resp = client.request(
                            method=method,
                            url=target_path,
                            headers=req_headers,
                            params=req_params,
                            json=req_body if req_body else None
                        )
                        latency = (time.time() - start_time) * 1000.0
                        status_code = resp.status_code
                        resp_text = resp.text
                    except httpx.RequestError as e:
                        latency = (time.time() - start_time) * 1000.0
                        status_code = 0
                        resp_text = f"Connection failed: {str(e)}"
                        
                    latencies.append(latency)
                    status_codes.append(status_code)
                    
                    # Validate security response
                    is_leak, leak_details = SecurityAuditor.analyze_information_leakage(resp_text, status_code)
                    
                    passed = True
                    msg = "Security check passed."
                    
                    if sc['type'] == 'Broken Authentication' and status_code == 200:
                        passed = False
                        msg = f"VULNERABILITY: Endpoint accepted request despite {desc}"
                    elif is_leak:
                        passed = False
                        msg = f"VULNERABILITY: Information Leakage detected! Details: {', '.join(leak_details)}"
                    elif status_code == 500:
                        passed = False
                        msg = "Failed: Endpoint returned HTTP 500 Internal Server Error when security payload was sent."
                        
                    ai_rec = None
                    if not passed:
                        ai_rec = get_ai_recommendation(path, method, status_code, msg, category="security")
                        
                    test_runs.append({
                        'endpoint': path,
                        'method': method,
                        'test_type': f"Security: {sc['type']}",
                        'status': "PASS" if passed else "FAIL",
                        'status_code': status_code,
                        'latency_ms': latency,
                        'message': msg,
                        'ai_analysis': ai_rec
                    })
            else:
                # Functional positive happy-path testing
                print(f"\n🧪 [{idx}/{len(endpoints)}] Testing {method} {path}...")
                
                # Mock parameters
                req_params = {}
                target_path = path
                
                # Process path parameters and supply dummy values
                for param in ep['parameters']:
                    if param.get('in') == 'path':
                        name = param.get('name')
                        target_path = target_path.replace(f"{{{name}}}", "1")
                    elif param.get('in') == 'query' and param.get('required'):
                        req_params[param.get('name')] = "test_value"
                
                req_body = {}
                if ep['request_body']:
                    # Extract primitive property structures to generate a basic happy path body
                    content = ep['request_body'].get('content', {})
                    json_schema = content.get('application/json', {}).get('schema', {})
                    properties = json_schema.get('properties', {})
                    for p_name, p_details in properties.items():
                        p_type = p_details.get('type', 'string')
                        if p_type == 'integer' or p_type == 'number':
                            req_body[p_name] = 1
                        elif p_type == 'boolean':
                            req_body[p_name] = True
                        else:
                            req_body[p_name] = "test"
                
                start_time = time.time()
                try:
                    resp = client.request(
                        method=method,
                        url=target_path,
                        headers=headers,
                        params=req_params,
                        json=req_body if req_body else None
                    )
                    latency = (time.time() - start_time) * 1000.0
                    status_code = resp.status_code
                    resp_json = None
                    try:
                        resp_json = resp.json()
                    except:
                        pass
                    msg = "Happy path validation complete."
                except httpx.RequestError as e:
                    latency = (time.time() - start_time) * 1000.0
                    status_code = 0
                    resp_json = None
                    msg = f"HTTP request failed: {str(e)}"
                    
                latencies.append(latency)
                status_codes.append(status_code)
                
                # Basic response check
                expected_status = 200 if method != 'POST' else 201
                status_ok, status_msg = ResponseValidator.validate_status(status_code, expected_status)
                
                passed = status_ok
                final_msg = status_msg if not status_ok else msg
                
                ai_rec = None
                if not passed:
                    ai_rec = get_ai_recommendation(path, method, status_code, final_msg)
                    
                test_runs.append({
                    'endpoint': path,
                    'method': method,
                    'test_type': "Functional: Happy Path",
                    'status': "PASS" if passed else "FAIL",
                    'status_code': status_code,
                    'latency_ms': latency,
                    'message': final_msg,
                    'ai_analysis': ai_rec
                })
                
    return test_runs, latencies, status_codes

def main():
    parser = argparse.ArgumentParser(description="AI-Powered API Testing Agent Core CLI driver")
    parser.add_argument("--spec", required=True, help="Path to the OpenAPI specification file (JSON or YAML)")
    parser.add_argument("--base-url", required=True, help="Base URL of the target API service under test")
    parser.add_argument("--security-only", action="store_true", help="Only run OWASP API Top 10 security audits")
    parser.add_argument("--html-report", help="Output path to compile a styled HTML dashboard report")
    parser.add_argument("--json-report", help="Output path to write a raw JSON report dump")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🤖 AI API TESTING AGENT STARTED")
    print(f"🎯 Target API Base URL: {args.base_url}")
    print("=" * 60)
    
    try:
        test_runs, latencies, status_codes = run_tests(args.spec, args.base_url, args.security_only)
    except Exception as e:
        print(f"❌ Critical Failure: {e}")
        sys.exit(1)
        
    # Analyze performance metrics
    perf_metrics = PerformanceAnalyzer.calculate_metrics(latencies, status_codes)
    
    # Generate and compile reports
    reporter = ReportGenerator(test_runs, perf_metrics)
    
    print("\n" + "=" * 60)
    print("📊 EXECUTION SUMMARY")
    print("=" * 60)
    print(reporter.generate_markdown())
    print("=" * 60)
    
    if args.json_report:
        with open(args.json_report, 'w', encoding='utf-8') as f:
            f.write(reporter.generate_json())
        print(f"💾 Written JSON report data to: {args.json_report}")
        
    if args.html_report:
        reporter.generate_html(args.html_report)
        
    print("\n✅ AI API Testing Agent run completed successfully!")

if __name__ == '__main__':
    main()
