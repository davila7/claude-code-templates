import json
from typing import List, Dict, Any

class ReportGenerator:
    """Compiles API validation test logs and statistics into Markdown, JSON, and HTML dashboard reports."""
    
    def __init__(self, test_runs: List[Dict[str, Any]], performance_metrics: Dict[str, Any]):
        self.test_runs = test_runs
        self.performance_metrics = performance_metrics
        self.total = len(test_runs)
        self.passed = sum(1 for run in test_runs if run.get('status') == 'PASS')
        self.failed = self.total - self.passed
        
    def generate_json(self) -> str:
        return json.dumps({
            'summary': {
                'total_tests': self.total,
                'passed': self.passed,
                'failed': self.failed,
                'pass_rate_pct': round((self.passed / self.total * 100.0) if self.total > 0 else 0.0, 2)
            },
            'performance': self.performance_metrics,
            'results': self.test_runs
        }, indent=2)
        
    def generate_markdown(self) -> str:
        md = []
        md.append("# 🧪 AI API Testing Agent Report")
        md.append("\n## 📊 Summary Statistics")
        md.append(f"- **Total Test Cases Executed:** {self.total}")
        md.append(f"- **✅ Passed:** {self.passed}")
        md.append(f"- **❌ Failed:** {self.failed}")
        pass_rate = (self.passed / self.total * 100.0) if self.total > 0 else 0.0
        md.append(f"- **📈 Pass Rate:** {pass_rate:.1f}%")
        
        md.append("\n## ⚡ Performance Summary")
        md.append(f"- **Minimum Latency:** {self.performance_metrics.get('min_ms')} ms")
        md.append(f"- **Average Latency:** {self.performance_metrics.get('avg_ms')} ms")
        md.append(f"- **Maximum Latency:** {self.performance_metrics.get('max_ms')} ms")
        md.append(f"- **95th Percentile Latency:** {self.performance_metrics.get('p95_ms')} ms")
        md.append(f"- **Failure Rate:** {self.performance_metrics.get('failure_rate_pct')}%")
        
        md.append("\n## 📁 Detailed Test Cases")
        md.append("| Endpoint | Method | Status | Response Code | Latency | Result Message |")
        md.append("| --- | --- | --- | --- | --- | --- |")
        for run in self.test_runs:
            status_symbol = "✅ PASS" if run['status'] == 'PASS' else "❌ FAIL"
            md.append(f"| `{run['endpoint']}` | **{run['method']}** | {status_symbol} | {run['status_code']} | {run['latency_ms']:.1f} ms | {run.get('message', '')} |")
            
        return "\n".join(md)
        
    def generate_html(self, output_filepath: str) -> None:
        """Generates a premium, styled HTML report dashboard for visualization."""
        pass_rate = (self.passed / self.total * 100.0) if self.total > 0 else 0.0
        
        rows = []
        for run in self.test_runs:
            status_class = "pass-badge" if run['status'] == 'PASS' else "fail-badge"
            ai_rec = ""
            if run['status'] == 'FAIL' and run.get('ai_analysis'):
                ai_rec = f"""
                <tr class="ai-row">
                    <td colspan="6">
                        <div class="ai-box">
                            <strong>🤖 AI Root Cause Analysis:</strong> {run['ai_analysis'].get('cause', 'N/A')}<br/>
                            <strong>💡 Recommendation:</strong> {run['ai_analysis'].get('fix', 'N/A')}
                        </div>
                    </td>
                </tr>
                """
            rows.append(f"""
            <tr class="data-row">
                <td><code>{run['endpoint']}</code></td>
                <td><span class="method-badge method-{run['method'].lower()}">{run['method']}</span></td>
                <td><span class="{status_class}">{run['status']}</span></td>
                <td>{run['status_code']}</td>
                <td>{run['latency_ms']:.1f} ms</td>
                <td>{run.get('message', '')}</td>
            </tr>
            {ai_rec}
            """)
            
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI API Testing Agent - Report Dashboard</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            margin: 0;
            padding: 30px;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        h1 {{
            margin: 0;
            color: #0f172a;
            font-size: 28px;
        }}
        .badge-ai {{
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
        }}
        .grid-stats {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }}
        .card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
        }}
        .card .title {{
            color: #64748b;
            font-size: 14px;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        .card .value {{
            font-size: 28px;
            font-weight: 700;
            color: #0f172a;
        }}
        .color-pass {{ color: #10b981 !important; }}
        .color-fail {{ color: #ef4444 !important; }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
            overflow: hidden;
            margin-bottom: 30px;
        }}
        th {{
            background-color: #f1f5f9;
            color: #475569;
            text-align: left;
            padding: 12px 16px;
            font-weight: 600;
            border-bottom: 1px solid #e2e8f0;
        }}
        td {{
            padding: 12px 16px;
            border-bottom: 1px solid #f1f5f9;
        }}
        .method-badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
            color: white;
        }}
        .method-get {{ background-color: #3b82f6; }}
        .method-post {{ background-color: #10b981; }}
        .method-put {{ background-color: #f59e0b; }}
        .method-delete {{ background-color: #ef4444; }}
        
        .pass-badge {{
            color: #047857;
            background-color: #d1fae5;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
        }}
        .fail-badge {{
            color: #b91c1c;
            background-color: #fee2e2;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
        }}
        .ai-row td {{
            background-color: #faf5ff;
            padding: 10px 16px 15px 16px;
        }}
        .ai-box {{
            border-left: 4px solid #a855f7;
            padding-left: 15px;
            font-size: 14px;
            line-height: 1.5;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>🧪 AI API Testing Agent Report</h1>
                <p style="margin: 5px 0 0 0; color: #64748b;">Automated Quality & Security Validation Logs</p>
            </div>
            <span class="badge-ai">Powered by Claude</span>
        </header>
        
        <div class="grid-stats">
            <div class="card">
                <div class="title">Total Test Cases</div>
                <div class="value">{self.total}</div>
            </div>
            <div class="card">
                <div class="title">Passed</div>
                <div class="value color-pass">{self.passed}</div>
            </div>
            <div class="card">
                <div class="title">Failed</div>
                <div class="value color-fail">{self.failed}</div>
            </div>
            <div class="card">
                <div class="title">Pass Rate</div>
                <div class="value">{pass_rate:.1f}%</div>
            </div>
        </div>
        
        <h2>⚡ Performance Analysis Summary</h2>
        <div class="grid-stats" style="margin-bottom: 40px;">
            <div class="card">
                <div class="title">Average Latency</div>
                <div class="value">{self.performance_metrics.get('avg_ms')} ms</div>
            </div>
            <div class="card">
                <div class="title">95th Percentile</div>
                <div class="value">{self.performance_metrics.get('p95_ms')} ms</div>
            </div>
            <div class="card">
                <div class="title">Max Latency</div>
                <div class="value">{self.performance_metrics.get('max_ms')} ms</div>
            </div>
            <div class="card">
                <div class="title">Throughput Failure Rate</div>
                <div class="value">{self.performance_metrics.get('failure_rate_pct')}%</div>
            </div>
        </div>
        
        <h2>📁 Detailed Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Endpoint Path</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Status Code</th>
                    <th>Latency</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                {"".join(rows)}
            </tbody>
        </table>
    </div>
</body>
</html>
"""
        with open(output_filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"✅ Generated premium HTML report: {output_filepath}")
