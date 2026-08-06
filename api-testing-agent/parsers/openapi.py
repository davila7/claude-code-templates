import json
import yaml
from pathlib import Path
from typing import Dict, Any, List

class OpenAPIParser:
    """Parses OpenAPI (Swagger) specifications (YAML or JSON) to extract endpoint details."""
    
    def __init__(self, spec_path: str):
        self.spec_path = spec_path
        self.spec_data = self._load_spec()
        
    def _load_spec(self) -> Dict[str, Any]:
        path = Path(self.spec_path)
        if not path.exists():
            raise FileNotFoundError(f"OpenAPI spec not found at: {self.spec_path}")
            
        with open(path, 'r', encoding='utf-8') as f:
            if path.suffix in ('.yaml', '.yml'):
                return yaml.safe_load(f)
            else:
                return json.load(f)
                
    def get_info(self) -> Dict[str, str]:
        info = self.spec_data.get('info', {})
        return {
            'title': info.get('title', 'API'),
            'version': info.get('version', '1.0.0'),
            'description': info.get('description', '')
        }
        
    def get_endpoints(self) -> List[Dict[str, Any]]:
        endpoints = []
        paths = self.spec_data.get('paths', {})
        
        for path, path_info in paths.items():
            for method, method_info in path_info.items():
                if method.lower() not in ('get', 'post', 'put', 'delete', 'patch', 'options', 'head'):
                    continue
                    
                parameters = method_info.get('parameters', [])
                # Also collect path-level parameters
                parameters.extend(path_info.get('parameters', []))
                
                request_body = method_info.get('requestBody', {})
                responses = method_info.get('responses', {})
                
                endpoints.append({
                    'path': path,
                    'method': method.upper(),
                    'summary': method_info.get('summary', ''),
                    'description': method_info.get('description', ''),
                    'parameters': parameters,
                    'request_body': request_body,
                    'responses': responses,
                    'operation_id': method_info.get('operationId', '')
                })
                
        return endpoints

    def get_security_schemes(self) -> Dict[str, Any]:
        components = self.spec_data.get('components', {})
        return components.get('securitySchemes', {})
