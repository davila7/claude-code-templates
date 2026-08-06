from typing import Dict, Any, List, Tuple
from ..config.settings import SQLI_PAYLOADS, XSS_PAYLOADS

class SecurityAuditor:
    """Performs automated security validation audits on endpoints, matching OWASP API Top 10 vulnerabilities."""

    @staticmethod
    def audit_authentication(headers: Dict[str, str], security_schemes: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Tests for Broken Authentication.
        Generates modified headers representing unauthenticated, expired, or invalid credentials.
        """
        audit_cases = []
        
        # 1. Test completely missing auth headers
        cleared_headers = headers.copy()
        auth_keys = ['Authorization', 'X-API-Key', 'x-api-key', 'apikey', 'token']
        removed_keys = []
        for key in auth_keys:
            if key in cleared_headers:
                cleared_headers.pop(key)
                removed_keys.append(key)
            # Check lowercase headers
            for hk in list(cleared_headers.keys()):
                if hk.lower() == key.lower():
                    cleared_headers.pop(hk)
                    removed_keys.append(hk)
                    
        if removed_keys:
            audit_cases.append({
                'type': 'Broken Authentication',
                'description': f'Missing credentials (removed {", ".join(removed_keys)})',
                'modified_headers': cleared_headers,
                'expected_status': 401
            })
            
        # 2. Test malformed/invalid bearer tokens or keys
        for key in auth_keys:
            # Check for existing headers
            found_key = None
            for hk in headers.keys():
                if hk.lower() == key.lower():
                    found_key = hk
                    break
                    
            if found_key:
                malformed_headers = headers.copy()
                val = headers[found_key]
                if val.lower().startswith('bearer '):
                    malformed_headers[found_key] = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidtoken.signature'
                else:
                    malformed_headers[found_key] = 'invalid_api_key_value'
                    
                audit_cases.append({
                    'type': 'Broken Authentication',
                    'description': f'Malformed credentials in {found_key}',
                    'modified_headers': malformed_headers,
                    'expected_status': 401
                })
                
        return audit_cases

    @staticmethod
    def audit_sqli(endpoint_path: str, parameters: List[Dict[str, Any]], request_body: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generates payloads for SQL Injection validation.
        Injects payloads into query, path, and body fields.
        """
        audit_cases = []
        
        # Audit parameters
        for param in parameters:
            param_in = param.get('in', '')
            param_name = param.get('name', '')
            
            if param_in in ('query', 'path') and param.get('schema', {}).get('type') == 'string':
                for payload in SQLI_PAYLOADS:
                    audit_cases.append({
                        'type': 'SQL Injection',
                        'description': f'SQLi payload in {param_in} parameter: {param_name}',
                        'parameter_inject': {
                            'name': param_name,
                            'in': param_in,
                            'value': payload
                        },
                        'body_inject': None
                    })
                    
        # Audit request body fields
        if request_body:
            content = request_body.get('content', {})
            json_schema = content.get('application/json', {}).get('schema', {})
            properties = json_schema.get('properties', {})
            
            for prop_name, prop_details in properties.items():
                if prop_details.get('type') == 'string':
                    for payload in SQLI_PAYLOADS:
                        audit_cases.append({
                            'type': 'SQL Injection',
                            'description': f'SQLi payload in JSON body field: {prop_name}',
                            'parameter_inject': None,
                            'body_inject': {
                                'field': prop_name,
                                'value': payload
                            }
                        })
                        
        return audit_cases

    @staticmethod
    def audit_xss(endpoint_path: str, parameters: List[Dict[str, Any]], request_body: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generates payloads for Cross-Site Scripting (XSS) audits.
        """
        audit_cases = []
        
        # Audit body fields
        if request_body:
            content = request_body.get('content', {})
            json_schema = content.get('application/json', {}).get('schema', {})
            properties = json_schema.get('properties', {})
            
            for prop_name, prop_details in properties.items():
                if prop_details.get('type') == 'string':
                    for payload in XSS_PAYLOADS:
                        audit_cases.append({
                            'type': 'Cross-Site Scripting',
                            'description': f'XSS payload in JSON body field: {prop_name}',
                            'body_inject': {
                                'field': prop_name,
                                'value': payload
                            }
                        })
                        
        return audit_cases

    @staticmethod
    def analyze_information_leakage(response_text: str, response_status: int) -> Tuple[bool, List[str]]:
        """
        Inspects the response payload for sensitive system information leakage (e.g. database errors, stack traces).
        """
        leaked_signatures = [
            "SQL Server Error",
            "MySQL Syntax Error",
            "PostgreSQL Exception",
            "stacktrace",
            "java.lang.",
            "IndexError:",
            "KeyError:",
            "NullPointerException",
            "internal server error",
            "Exception in thread"
        ]
        
        found = []
        for signature in leaked_signatures:
            if signature.lower() in response_text.lower():
                found.append(signature)
                
        # 500 error code with descriptive error message could also be a leak indicator
        if response_status == 500 and len(response_text) > 100:
            found.append("HTTP 500 containing detailed body")
            
        is_vuln = len(found) > 0
        return is_vuln, found
