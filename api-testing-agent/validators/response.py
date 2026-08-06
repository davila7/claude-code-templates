from typing import Dict, Any, Tuple, Optional
import jsonschema
from jsonschema import validate as validate_json_schema

class ResponseValidator:
    """Validates HTTP responses against OpenAPI constraints, status codes, and schema rules."""
    
    @staticmethod
    def validate_status(received: int, expected: int) -> Tuple[bool, str]:
        if received == expected:
            return True, f"Status code matches expected: {received}"
        return False, f"Status code mismatch: expected {expected}, received {received}"
        
    @staticmethod
    def validate_schema(response_body: Any, schema: Dict[str, Any]) -> Tuple[bool, str]:
        """Validates a JSON body against a JSON Schema."""
        if not response_body and schema:
            return False, "Response body is empty, but a schema validation was expected."
        if not schema:
            return True, "No schema specified for validation."
            
        try:
            # OpenAPI schemas might have references or minor differences from standard JSON schema,
            # but for a basic validator, standard jsonschema validation covers the vast majority of scenarios.
            validate_json_schema(instance=response_body, schema=schema)
            return True, "JSON Response matches target schema perfectly."
        except jsonschema.exceptions.ValidationError as e:
            return False, f"JSON Schema Validation Error: {e.message} at path '{'.'.join(str(p) for p in e.path)}'"
        except Exception as e:
            return False, f"Unexpected error during schema validation: {str(e)}"
            
    @staticmethod
    def validate_latency(latency_ms: float, threshold_ms: float) -> Tuple[bool, str]:
        if latency_ms <= threshold_ms:
            return True, f"Response time of {latency_ms:.1f}ms is within the SLA target of {threshold_ms}ms"
        return False, f"Performance SLA breach: Response time was {latency_ms:.1f}ms (threshold: {threshold_ms}ms)"
        
    @staticmethod
    def validate_headers(headers: Dict[str, str], required_headers: Dict[str, str]) -> Tuple[bool, str]:
        missing = []
        mismatch = []
        
        for k, expected_v in required_headers.items():
            received_v = headers.get(k) or headers.get(k.lower())
            if not received_v:
                missing.append(k)
            elif expected_v and expected_v.lower() not in received_v.lower():
                mismatch.append(f"{k} (expected '{expected_v}', got '{received_v}')")
                
        if missing or mismatch:
            errors = []
            if missing:
                errors.append(f"Missing headers: {', '.join(missing)}")
            if mismatch:
                errors.append(f"Header value mismatches: {', '.join(mismatch)}")
            return False, "; ".join(errors)
            
        return True, "All required headers validate successfully."
