#!/usr/bin/env python3
"""
Risk Assessment Calculator

Calculates risk scores using both qualitative and quantitative methodologies.
Supports risk matrix, ALE calculations, and cost-benefit analysis for controls.

Usage:
    python risk_calculator.py --interactive
    python risk_calculator.py risks.csv
    python risk_calculator.py risks.csv --output risk_report.csv
"""

import argparse
import csv
import json
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime


@dataclass
class Risk:
    """Risk assessment data class"""
    id: str
    name: str
    asset_value: float
    exposure_factor: float
    aro: float  # Annualized Rate of Occurrence
    likelihood_qualitative: int  # 1-5 scale
    impact_qualitative: int  # 1-5 scale
    category: str
    owner: str


class RiskCalculator:
    """Risk assessment calculator with multiple methodologies"""

    # Risk matrix: (likelihood, impact) -> risk_level
    RISK_MATRIX = {
        (1, 1): "Low", (1, 2): "Low", (1, 3): "Low", (1, 4): "Medium", (1, 5): "Medium",
        (2, 1): "Low", (2, 2): "Low", (2, 3): "Medium", (2, 4): "High", (2, 5): "High",
        (3, 1): "Low", (3, 2): "Medium", (3, 3): "Medium", (3, 4): "High", (3, 5): "Critical",
        (4, 1): "Medium", (4, 2): "High", (4, 3): "High", (4, 4): "Critical", (4, 5): "Critical",
        (5, 1): "Medium", (5, 2): "High", (5, 3): "Critical", (5, 4): "Critical", (5, 5): "Critical"
    }

    SLA_DAYS = {
        "Critical": 1,
        "High": 7,
        "Medium": 30,
        "Low": 90
    }

    def __init__(self):
        self.risks: List[Risk] = []

    def calculate_quantitative(self, risk: Risk) -> Dict:
        """Calculate quantitative risk metrics (SLE, ALE)"""
        sle = risk.asset_value * risk.exposure_factor
        ale = sle * risk.aro

        return {
            "sle": round(sle, 2),
            "ale": round(ale, 2)
        }

    def calculate_qualitative(self, risk: Risk) -> Dict:
        """Calculate qualitative risk metrics"""
        risk_score = risk.likelihood_qualitative * risk.impact_qualitative
        risk_level = self.RISK_MATRIX.get(
            (risk.likelihood_qualitative, risk.impact_qualitative),
            "Unknown"
        )
        sla_days = self.SLA_DAYS.get(risk_level, 90)

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "sla_days": sla_days
        }

    def cost_benefit_analysis(self, risk: Risk, control_cost: float, new_aro: float) -> Dict:
        """Perform cost-benefit analysis for a security control"""
        quant = self.calculate_quantitative(risk)
        ale_before = quant["ale"]

        # Calculate ALE after control
        ale_after = (risk.asset_value * risk.exposure_factor) * new_aro

        annual_savings = ale_before - ale_after
        net_benefit = annual_savings - control_cost

        roi = (net_benefit / control_cost * 100) if control_cost > 0 else 0

        return {
            "ale_before": round(ale_before, 2),
            "ale_after": round(ale_after, 2),
            "annual_savings": round(annual_savings, 2),
            "control_cost": control_cost,
            "net_benefit": round(net_benefit, 2),
            "roi_percent": round(roi, 2),
            "recommendation": "Implement" if net_benefit > 0 else "Do not implement",
            "payback_period_years": round(control_cost / annual_savings, 2) if annual_savings > 0 else float('inf')
        }

    def add_risk(self, risk: Risk):
        """Add risk to assessment"""
        self.risks.append(risk)

    def generate_report(self) -> List[Dict]:
        """Generate comprehensive risk report"""
        report = []

        for risk in self.risks:
            quant = self.calculate_quantitative(risk)
            qual = self.calculate_qualitative(risk)

            report.append({
                "Risk ID": risk.id,
                "Risk Name": risk.name,
                "Category": risk.category,
                "Owner": risk.owner,
                "Asset Value": f"${risk.asset_value:,.0f}",
                "Exposure Factor": f"{risk.exposure_factor:.0%}",
                "ARO": f"{risk.aro:.2f}",
                "SLE": f"${quant['sle']:,.0f}",
                "ALE": f"${quant['ale']:,.0f}",
                "Likelihood": risk.likelihood_qualitative,
                "Impact": risk.impact_qualitative,
                "Risk Score": qual["risk_score"],
                "Risk Level": qual["risk_level"],
                "Remediation SLA": f"{qual['sla_days']} days"
            })

        # Sort by ALE (descending)
        report.sort(key=lambda x: float(x["ALE"].replace("$", "").replace(",", "")), reverse=True)

        return report

    def generate_summary(self) -> Dict:
        """Generate summary statistics"""
        if not self.risks:
            return {}

        total_ale = sum(self.calculate_quantitative(r)["ale"] for r in self.risks)

        risk_levels = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        for risk in self.risks:
            qual = self.calculate_qualitative(risk)
            risk_levels[qual["risk_level"]] = risk_levels.get(qual["risk_level"], 0) + 1

        top_risks = sorted(
            [(r, self.calculate_quantitative(r)["ale"]) for r in self.risks],
            key=lambda x: x[1],
            reverse=True
        )[:5]

        return {
            "total_risks": len(self.risks),
            "total_ale": round(total_ale, 2),
            "risk_levels": risk_levels,
            "top_5_risks": [(r.name, round(ale, 2)) for r, ale in top_risks]
        }


def load_risks_from_csv(filename: str) -> List[Risk]:
    """Load risks from CSV file"""
    risks = []

    with open(filename, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            risk = Risk(
                id=row['id'],
                name=row['name'],
                asset_value=float(row['asset_value']),
                exposure_factor=float(row['exposure_factor']),
                aro=float(row['aro']),
                likelihood_qualitative=int(row['likelihood']),
                impact_qualitative=int(row['impact']),
                category=row['category'],
                owner=row['owner']
            )
            risks.append(risk)

    return risks


def save_report_to_csv(report: List[Dict], filename: str):
    """Save risk report to CSV file"""
    if not report:
        print("No data to save")
        return

    with open(filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=report[0].keys())
        writer.writeheader()
        writer.writerows(report)

    print(f"Report saved to {filename}")


def interactive_mode():
    """Interactive risk assessment mode"""
    calculator = RiskCalculator()

    print("=" * 60)
    print("Risk Assessment Calculator - Interactive Mode")
    print("=" * 60)

    while True:
        print("\nOptions:")
        print("1. Add new risk")
        print("2. Calculate cost-benefit for control")
        print("3. Generate risk report")
        print("4. View summary")
        print("5. Exit")

        choice = input("\nEnter choice (1-5): ").strip()

        if choice == "1":
            print("\n--- Add New Risk ---")
            risk_id = input("Risk ID: ").strip()
            name = input("Risk Name: ").strip()
            asset_value = float(input("Asset Value ($): "))
            exposure_factor = float(input("Exposure Factor (0-1): "))
            aro = float(input("Annual Rate of Occurrence (0-1): "))
            likelihood = int(input("Likelihood (1-5): "))
            impact = int(input("Impact (1-5): "))
            category = input("Category: ").strip()
            owner = input("Owner: ").strip()

            risk = Risk(risk_id, name, asset_value, exposure_factor, aro,
                       likelihood, impact, category, owner)
            calculator.add_risk(risk)

            quant = calculator.calculate_quantitative(risk)
            qual = calculator.calculate_qualitative(risk)

            print(f"\n✓ Risk added successfully!")
            print(f"  SLE: ${quant['sle']:,.0f}")
            print(f"  ALE: ${quant['ale']:,.0f}")
            print(f"  Risk Level: {qual['risk_level']}")
            print(f"  Remediation SLA: {qual['sla_days']} days")

        elif choice == "2":
            if not calculator.risks:
                print("No risks added yet. Please add a risk first.")
                continue

            print("\n--- Cost-Benefit Analysis ---")
            print("Available risks:")
            for i, risk in enumerate(calculator.risks, 1):
                print(f"{i}. {risk.name} (ID: {risk.id})")

            risk_idx = int(input("Select risk number: ")) - 1
            if risk_idx < 0 or risk_idx >= len(calculator.risks):
                print("Invalid selection")
                continue

            risk = calculator.risks[risk_idx]
            control_cost = float(input("Annual cost of control ($): "))
            new_aro = float(input("New ARO after control (0-1): "))

            cba = calculator.cost_benefit_analysis(risk, control_cost, new_aro)

            print(f"\n--- Cost-Benefit Analysis Results ---")
            print(f"ALE Before Control: ${cba['ale_before']:,.0f}")
            print(f"ALE After Control: ${cba['ale_after']:,.0f}")
            print(f"Annual Savings: ${cba['annual_savings']:,.0f}")
            print(f"Control Cost: ${cba['control_cost']:,.0f}")
            print(f"Net Benefit: ${cba['net_benefit']:,.0f}")
            print(f"ROI: {cba['roi_percent']:.1f}%")
            print(f"Payback Period: {cba['payback_period_years']:.2f} years")
            print(f"Recommendation: {cba['recommendation']}")

        elif choice == "3":
            if not calculator.risks:
                print("No risks added yet. Please add a risk first.")
                continue

            report = calculator.generate_report()
            print("\n" + "=" * 120)
            print("Risk Assessment Report")
            print("=" * 120)

            # Print header
            headers = list(report[0].keys())
            print("|".join(f"{h:^15}" for h in headers))
            print("-" * 120)

            # Print rows
            for row in report:
                print("|".join(f"{str(v):^15}" for v in row.values()))

        elif choice == "4":
            summary = calculator.generate_summary()
            if not summary:
                print("No risks added yet. Please add a risk first.")
                continue

            print("\n" + "=" * 60)
            print("Risk Assessment Summary")
            print("=" * 60)
            print(f"Total Risks: {summary['total_risks']}")
            print(f"Total ALE: ${summary['total_ale']:,.0f}")
            print(f"\nRisk Level Distribution:")
            for level, count in summary['risk_levels'].items():
                print(f"  {level}: {count}")
            print(f"\nTop 5 Risks by ALE:")
            for name, ale in summary['top_5_risks']:
                print(f"  {name}: ${ale:,.0f}")

        elif choice == "5":
            print("Exiting...")
            break

        else:
            print("Invalid choice. Please enter 1-5.")


def main():
    parser = argparse.ArgumentParser(description="Risk Assessment Calculator")
    parser.add_argument('input_file', nargs='?', help='CSV file containing risk data')
    parser.add_argument('--output', '-o', help='Output CSV file for risk report')
    parser.add_argument('--interactive', '-i', action='store_true',
                       help='Run in interactive mode')
    parser.add_argument('--control-cost', type=float,
                       help='Cost of control for cost-benefit analysis')
    parser.add_argument('--new-aro', type=float,
                       help='New ARO after control implementation')

    args = parser.parse_args()

    if args.interactive:
        interactive_mode()
        return

    if not args.input_file:
        print("Error: Please provide an input file or use --interactive mode")
        parser.print_help()
        return

    # Load risks from CSV
    try:
        risks = load_risks_from_csv(args.input_file)
        calculator = RiskCalculator()

        for risk in risks:
            calculator.add_risk(risk)

        print(f"Loaded {len(risks)} risks from {args.input_file}")

        # Generate report
        report = calculator.generate_report()

        # Display summary
        summary = calculator.generate_summary()
        print("\n" + "=" * 60)
        print("Risk Assessment Summary")
        print("=" * 60)
        print(f"Total Risks: {summary['total_risks']}")
        print(f"Total ALE: ${summary['total_ale']:,.0f}")
        print(f"\nRisk Level Distribution:")
        for level, count in summary['risk_levels'].items():
            if count > 0:
                print(f"  {level}: {count}")

        print(f"\nTop 5 Risks by ALE:")
        for name, ale in summary['top_5_risks']:
            print(f"  {name}: ${ale:,.0f}")

        # Save report if output file specified
        if args.output:
            save_report_to_csv(report, args.output)

        print("\nRisk Report:")
        print("-" * 120)
        for risk_data in report[:10]:  # Show top 10
            print(f"{risk_data['Risk ID']}: {risk_data['Risk Name']}")
            print(f"  ALE: {risk_data['ALE']} | Risk Level: {risk_data['Risk Level']} | "
                  f"SLA: {risk_data['Remediation SLA']}")

    except FileNotFoundError:
        print(f"Error: File '{args.input_file}' not found")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
