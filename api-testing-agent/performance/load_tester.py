import time
from typing import List, Dict, Any

class PerformanceAnalyzer:
    """Measures, aggregates, and benchmarks API response latencies and failure rates."""
    
    @staticmethod
    def calculate_metrics(latencies_ms: List[float], status_codes: List[int]) -> Dict[str, Any]:
        if not latencies_ms:
            return {
                'min_ms': 0.0,
                'max_ms': 0.0,
                'avg_ms': 0.0,
                'p95_ms': 0.0,
                'total_requests': 0,
                'failure_rate_pct': 0.0
            }
            
        total_requests = len(latencies_ms)
        failures = sum(1 for status in status_codes if status >= 400 or status == 0)
        failure_rate = (failures / total_requests) * 100.0
        
        sorted_latencies = sorted(latencies_ms)
        min_ms = sorted_latencies[0]
        max_ms = sorted_latencies[-1]
        avg_ms = sum(latencies_ms) / total_requests
        
        # Calculate 95th percentile
        p95_idx = int(total_requests * 0.95) - 1
        p95_idx = max(0, p95_idx)
        p95_ms = sorted_latencies[p95_idx]
        
        return {
            'min_ms': round(min_ms, 2),
            'max_ms': round(max_ms, 2),
            'avg_ms': round(avg_ms, 2),
            'p95_ms': round(p95_ms, 2),
            'total_requests': total_requests,
            'failure_rate_pct': round(failure_rate, 2)
        }
