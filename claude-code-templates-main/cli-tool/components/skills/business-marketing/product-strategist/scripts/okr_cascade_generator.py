#!/usr/bin/env python3
"""
OKR Cascade Generator
Creates aligned OKRs from company strategy down to team level
"""

import json
from typing import Dict, List
from datetime import datetime, timedelta

class OKRGenerator:
    """Generate and cascade OKRs across the organization"""
    
    def __init__(self):
        self.okr_templates = {
            'growth': {
                'objectives': [
                    'Accelerate user acquisition and market expansion',
                    'Achieve product-market fit in new segments',
                    'Build sustainable growth engine'
                ],
                'key_results': [
                    'Increase MAU from {current} to {target}',
                    'Achieve {target}% MoM growth rate',
                    'Expand to {target} new markets',
                    'Reduce CAC by {target}%',
                    'Improve activation rate to {target}%'
                ]
            },
            'retention': {
                'objectives': [
                    'Create lasting customer value and loyalty',
                    'Build best-in-class user experience',
                    'Maximize customer lifetime value'
                ],
                'key_results': [
                    'Improve retention from {current}% to {target}%',
                    'Increase NPS from {current} to {target}',
                    'Reduce churn to below {target}%',
                    'Achieve {target}% product stickiness',
                    'Increase LTV/CAC ratio to {target}'
                ]
            },
            'revenue': {
                'objectives': [
                    'Drive sustainable revenue growth',
                    'Optimize monetization strategy',
                    'Expand revenue per customer'
                ],
                'key_results': [
                    'Grow ARR from ${current}M to ${target}M',
                    'Increase ARPU by {target}%',
                    'Launch {target} new revenue streams',
                    'Achieve {target}% gross margin',
                    'Reduce revenue churn to {target}%'
                ]
            },
            'innovation': {
                'objectives': [
                    'Pioneer next-generation product capabilities',
                    'Establish market leadership through innovation',
                    'Build competitive moat'
                ],
                'key_results': [
                    'Launch {target} breakthrough features',
                    'Achieve {target}% of revenue from new products',
                    'File {target} patents/IP',
                    'Reduce time-to-market by {target}%',
                    'Achieve {target} innovation score'
                ]
            },
            'operational': {
                'objectives': [
                    'Build world-class product organization',
                    'Achieve operational excellence',
                    'Scale efficiently'
                ],
                'key_results': [
                    'Improve velocity by {target}%',
                    'Reduce cycle time to {target} days',
                    'Achieve {target}% automation',
                    'Improve team NPS to {target}',
                    'Reduce incidents by {target}%'
                ]
            }
        }
    
    def generate_company_okrs(self, strategy: str, metrics: Dict) -> Dict:
        """Generate company-level OKRs based on strategy"""
        
        if strategy not in self.okr_templates:
            strategy = 'growth'  # Default
        
        template = self.okr_templates[strategy]
        
        company_okrs = {
            'level': 'Company',
            'quarter': self._get_current_quarter(),
            'strategy': strategy,
            'objectives': []
        }
        
        # Generate 3 objectives
        for i in range(min(3, len(template['objectives']))):
            obj = {
                'id': f'CO-{i+1}',
                'title': template['objectives'][i],
                'key_results': [],
                'owner': 'CEO',
                'status': 'draft'
            }
            
            # Add 3-5 key results per objective
            for j in range(3):
                if j < len(template['key_results']):
                    kr_template = template['key_results'][j]
                    kr = {
                        'id': f'CO-{i+1}-KR{j+1}',
                        'title': self._fill_metrics(kr_template, metrics),
                        'current': metrics.get('current', 0),
                        'target': metrics.get('target', 100),
                        'unit': self._extract_unit(kr_template),
                        'status': 'not_started'
                    }
                    obj['key_results'].append(kr)
            
            company_okrs['objectives'].append(obj)
        
        return company_okrs
    
    def cascade_to_product(self, company_okrs: Dict) -> Dict:
        """Cascade company OKRs to product organization"""
        
        product_okrs = {
            'level': 'Product',
            'quarter': company_okrs['quarter'],
            'parent': 'Company',
            'objectives': []
        }
        
        # Map company objectives to product objectives
        for company_obj in company_okrs['objectives']:
            product_obj = {
                'id': f'PO-{company_obj["id"].split("-")[1]}',
                'title': self._translate_to_product(company_obj['title']),
                'parent_objective': company_obj['id'],
                'key_results': [],
                'owner': 'Head of Product',
                'status': 'draft'
            }
            
            # Generate product-specific key results
            for kr in company_obj['key_results']:
                product_kr = {
                    'id': f'PO-{product_obj["id"].split("-")[1]}-KR{kr["id"].split("KR")[1]}',
                    'title': self._translate_kr_to_product(kr['title']),
                    'contributes_to': kr['id'],
                    'current': kr['current'],
                    'target': kr['target'] * 0.3,  # Product typically contributes 30%
                    'unit': kr['unit'],
                    'status': 'not_started'
                }
                product_obj['key_results'].append(product_kr)
            
            product_okrs['objectives'].append(product_obj)
        
        return product_okrs
    
    def cascade_to_teams(self, product_okrs: Dict) -> List[Dict]:
        """Cascade product OKRs to individual teams"""
        
        teams = ['Growth', 'Platform', 'Mobile', 'Data']
        team_okrs = []
        
        for team in teams:
            team_okr = {
                'level': 'Team',
                'team': team,
                'quarter': product_okrs['quarter'],
                'parent': 'Product',
                'objectives': []
            }
            
            # Each team takes relevant objectives
            for product_obj in product_okrs['objectives']:
                if self._is_relevant_for_team(product_obj['title'], team):
                    team_obj = {
                        'id': f'{team[:3].upper()}-{product_obj["id"].split("-")[1]}',
                        'title': self._translate_to_team(product_obj['title'], team),
                        'parent_objective': product_obj['id'],
                        'key_results': [],
                        'owner': f'{team} PM',
                        'status': 'draft'
                    }
                    
                    # Add team-specific key results
                    for kr in product_obj['key_results'][:2]:  # Each team takes 2 KRs
                        team_kr = {
                            'id': f'{team[:3].upper()}-{team_obj["id"].split("-")[1]}-KR{kr["id"].split("KR")[1]}',
                            'title': self._translate_kr_to_team(kr['title'], team),
                            'contributes_to': kr['id'],
                            'current': kr['current'],
                            'target': kr['target'] / len(teams),
                            'unit': kr['unit'],
                            'status': 'not_started'
                        }
                        team_obj['key_results'].append(team_kr)
                    
                    team_okr['objectives'].append(team_obj)
            
            if team_okr['objectives']:
                team_okrs.append(team_okr)
        
        return team_okrs
    
    def generate_okr_dashboard(self, all_okrs: Dict) -> str:
        """Generate OKR dashboard view"""
        
        dashboard = ["=" * 60]
        dashboard.append("OKR CASCADE DASHBOARD")
        dashboard.append(f"Quarter: {all_okrs.get('quarter', 'Q1 2025')}")
        dashboard.append("=" * 60)
        
        # Company OKRs
        if 'company' in all_okrs:
            dashboard.append("\n🏢 COMPANY OKRS\n")
            for obj in all_okrs['company']['objectives']:
                dashboard.append(f"📌 {obj['id']}: {obj['title']}")
                for kr in obj['key_results']:
                    dashboard.append(f"   └─ {kr['id']}: {kr['title']}")
        
        # Product OKRs
        if 'product' in all_okrs:
            dashboard.append("\n🚀 PRODUCT OKRS\n")
            for obj in all_okrs['product']['objectives']:
                dashboard.append(f"📌 {obj['id']}: {obj['title']}")
                dashboard.append(f"   ↳ Supports: {obj.get('parent_objective', 'N/A')}")
                for kr in obj['key_results']:
                    dashboard.append(f"   └─ {kr['id']}: {kr['title']}")
        
        # Team OKRs
        if 'teams' in all_okrs:
            dashboard.append("\n👥 TEAM OKRS\n")
            for team_okr in all_okrs['teams']:
                dashboard.append(f"\n{team_okr['team']} Team:")
                for obj in team_okr['objectives']:
                    dashboard.append(f"  📌 {obj['id']}: {obj['title']}")
                    for kr in obj['key_results']:
                        dashboard.append(f"     └─ {kr['id']}: {kr['title']}")
        
        # Alignment Matrix
        dashboard.append("\n\n📊 ALIGNMENT MATRIX\n")
        dashboard.append("Company → Product → Teams")
        dashboard.append("-" * 40)
        
        if 'company' in all_okrs and 'product' in all_okrs:
            for c_obj in all_okrs['company']['objectives']:
                dashboard.append(f"\n{c_obj['id']}")
                for p_obj in all_okrs['product']['objectives']:
                    if p_obj.get('parent_objective') == c_obj['id']:
                        dashboard.append(f"  ├─ {p_obj['id']}")
                        if 'teams' in all_okrs:
                            for team_okr in all_okrs['teams']:
                                for t_obj in team_okr['objectives']:
                                    if t_obj.get('parent_objective') == p_obj['id']:
                                        dashboard.append(f"    └─ {t_obj['id']} ({team_okr['team']})")
        
        return "\n".join(dashboard)
    
    def calculate_alignment_score(self, all_okrs: Dict) -> Dict:
        """Calculate alignment score across OKR cascade"""
        
        scores = {
            'vertical_alignment': 0,
            'horizontal_alignment': 0,
            'coverage': 0,
            'balance': 0,
            'overall': 0
        }
        
        # Vertical alignment: How well each level supports the above
        total_objectives = 0
        aligned_objectives = 0
        
        if 'product' in all_okrs:
            for obj in all_okrs['product']['objectives']:
                total_objectives += 1
                if 'parent_objective' in obj:
                    aligned_objectives += 1
        
        if 'teams' in all_okrs:
            for team in all_okrs['teams']:
                for obj in team['objectives']:
                    total_objectives += 1
                    if 'parent_objective' in obj:
                        aligned_objectives += 1
        
        if total_objectives > 0:
            scores['vertical_alignment'] = round((aligned_objectives / total_objectives) * 100, 1)
        
        # Horizontal alignment: How well teams coordinate
        if 'teams' in all_okrs and len(all_okrs['teams']) > 1:
            shared_objectives = set()
            for team in all_okrs['teams']:
                for obj in team['objectives']:
                    parent = obj.get('parent_objective')
                    if parent:
                        shared_objectives.add(parent)
            
            scores['horizontal_alignment'] = min(100, len(shared_objectives) * 25)
        
        # Coverage: How much of company OKRs are covered
        if 'company' in all_okrs and 'product' in all_okrs:
            company_krs = sum(len(obj['key_results']) for obj in all_okrs['company']['objectives'])
            covered_krs = sum(len(obj['key_results']) for obj in all_okrs['product']['objectives'])
            if company_krs > 0:
                scores['coverage'] = round((covered_krs / company_krs) * 100, 1)
        
        # Balance: Distribution across teams
        if 'teams' in all_okrs:
            objectives_per_team = [len(team['objectives']) for team in all_okrs['teams']]
            if objectives_per_team:
                avg_objectives = sum(objectives_per_team) / len(objectives_per_team)
                variance = sum((x - avg_objectives) ** 2 for x in objectives_per_team) / len(objectives_per_team)
                scores['balance'] = round(max(0, 100 - variance * 10), 1)
        
        # Overall score
        scores['overall'] = round(sum([
            scores['vertical_alignment'] * 0.4,
            scores['horizontal_alignment'] * 0.2,
            scores['coverage'] * 0.2,
            scores['balance'] * 0.2
        ]), 1)
        
        return scores
    
    def _get_current_quarter(self) -> str:
        """Get current quarter"""
        now = datetime.now()
        quarter = (now.month - 1) // 3 + 1
        return f"Q{quarter} {now.year}"
    
    def _fill_metrics(self, template: str, metrics: Dict) -> str:
        """Fill template with actual metrics"""
        result = template
        for key, value in metrics.items():
            result = result.replace(f'{{{key}}}', str(value))
        return result
    
    def _extract_unit(self, kr_template: str) -> str:
        """Extract measurement unit from KR template"""
        if '%' in kr_template:
            return '%'
        elif '$' in kr_template:
            return '$'
        elif 'days' in kr_template.lower():
            return 'days'
        elif 'score' in kr_template.lower():
            return 'points'
        return 'count'
    
    def _translate_to_product(self, company_objective: str) -> str:
        """Translate company objective to product objective"""
        translations = {
            'Accelerate user acquisition': 'Build viral product features',
            'Achieve product-market fit': 'Validate product hypotheses',
            'Build sustainable growth': 'Create product-led growth loops',
            'Create lasting customer value': 'Design sticky user experiences',
            'Drive sustainable revenue': 'Optimize product monetization',
            'Pioneer next-generation': 'Ship innovative features',
            'Build world-class': 'Elevate product excellence'
        }
        
        for key, value in translations.items():
            if key in company_objective:
                return company_objective.replace(key, value)
        return f"Product: {company_objective}"
    
    def _translate_kr_to_product(self, kr: str) -> str:
        """Translate KR to product context"""
        product_terms = {
            'MAU': 'product MAU',
            'growth rate': 'feature adoption rate',
            'CAC': 'product onboarding efficiency',
            'retention': 'product retention',
            'NPS': 'product NPS',
            'ARR': 'product-driven revenue',
            'churn': 'product churn'
        }
        
        result = kr
        for term, replacement in product_terms.items():
            if term in result:
                result = result.replace(term, replacement)
                break
        return result
    
    def _translate_to_team(self, objective: str, team: str) -> str:
        """Translate objective to team context"""
        team_focus = {
            'Growth': 'acquisition and activation',
            'Platform': 'infrastructure and reliability',
            'Mobile': 'mobile experience',
            'Data': 'analytics and insights'
        }
        
        focus = team_focus.get(team, 'delivery')
        return f"{objective} through {focus}"
    
    def _translate_kr_to_team(self, kr: str, team: str) -> str:
        """Translate KR to team context"""
        return f"[{team}] {kr}"
    
    def _is_relevant_for_team(self, objective: str, team: str) -> bool:
        """Check if objective is relevant for team"""
        relevance = {
            'Growth': ['acquisition', 'growth', 'activation', 'viral'],
            'Platform': ['infrastructure', 'reliability', 'scale', 'performance'],
            'Mobile': ['mobile', 'app', 'ios', 'android'],
            'Data': ['analytics', 'metrics', 'insights', 'data']
        }
        
        keywords = relevance.get(team, [])
        objective_lower = objective.lower()
        return any(keyword in objective_lower for keyword in keywords) or team == 'Platform'

def main():
    import sys
    
    # Sample metrics
    metrics = {
        'current': 100000,
        'target': 150000,
        'current_revenue': 10,
        'target_revenue': 15,
        'current_nps': 40,
        'target_nps': 60
    }
    
    # Get strategy from command line or default
    strategy = sys.argv[1] if len(sys.argv) > 1 else 'growth'
    
    # Generate OKRs
    generator = OKRGenerator()
    
    # Generate company OKRs
    company_okrs = generator.generate_company_okrs(strategy, metrics)
    
    # Cascade to product
    product_okrs = generator.cascade_to_product(company_okrs)
    
    # Cascade to teams
    team_okrs = generator.cascade_to_teams(product_okrs)
    
    # Combine all OKRs
    all_okrs = {
        'company': company_okrs,
        'product': product_okrs,
        'teams': team_okrs
    }
    
    # Generate dashboard
    dashboard = generator.generate_okr_dashboard(all_okrs)
    print(dashboard)
    
    # Calculate alignment
    alignment = generator.calculate_alignment_score(all_okrs)
    print("\n\n🎯 ALIGNMENT SCORES\n" + "-" * 40)
    for metric, score in alignment.items():
        print(f"{metric.replace('_', ' ').title()}: {score}%")
    
    # Export as JSON if requested
    if len(sys.argv) > 2 and sys.argv[2] == 'json':
        print("\n\nJSON Output:")
        print(json.dumps(all_okrs, indent=2))

if __name__ == "__main__":
    main()
