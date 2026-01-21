#!/usr/bin/env python3
"""
Vulnerability Prioritization Tool

Prioritizes vulnerabilities based on CVSS score combined with business context
factors such as asset criticality, exposure, exploit availability, and compensating controls.

Usage:
    python vuln_prioritizer.py vulnerabilities.csv
    python vuln_prioritizer.py vulnerabilities.csv --output prioritized.csv
    python vuln_prioritizer.py --interactive
"""

import argparse
import csv
from dataclasses import dataclass
from typing import List, Dict
from datetime import datetime, timedelta


@dataclass
class Vulnerability:
    """Vulnerability data class"""
    cve_id: str
    title: str
    cvss_score: float
    affected_system: str
    asset_criticality: int  # 1-5 scale
    exposure: str  # internet_facing, internal, isolated
    data_sensitivity: str  # highly_confidential, confidential, public
    exploit_available: bool
    exploit_in_wild: bool
    compensating_controls: bool
    discovered_date: str


class VulnerabilityPrioritizer:
    """Vulnerability prioritization engine"""

    EXPOSURE_WEIGHT = {
        "internet_facing": 3,
        "internal": 2,
        "isolated": 1
    }

    DATA_SENSITIVITY_WEIGHT = {
        "highly_confidential": 3,  # PII, PHI, financial
        "confidential": 2,
        "public": 1
    }

    SLA_MAPPING = {
        "P0": 1,   # Critical - patch within 24-48 hours
        "P1": 7,   # High - patch within 7 days
        "P2": 30,  # Medium - patch within 30 days
        "P3": 90   # Low - patch within 90 days
    }

    def __init__(self):
        self.vulnerabilities: List[Vulnerability] = []

    def calculate_priority_score(self, vuln: Vulnerability) -> float:
        """
        Calculate priority score based on CVSS + business context

        Formula:
        Priority Score = CVSS × exploit_multiplier × asset_multiplier × exposure_multiplier × data_sensitivity_multiplier × controls_multiplier
        """

        # Base CVSS score (0-10)
        cvss_score = vuln.cvss_score

        # Exploit multipliers
        exploit_available_mult = 1.5 if vuln.exploit_available else 1.0
        exploit_in_wild_mult = 2.0 if vuln.exploit_in_wild else 1.0

        # Asset criticality multiplier (1-5 scale normalized)
        asset_mult = vuln.asset_criticality / 3.0

        # Exposure multiplier
        exposure_mult = self.EXPOSURE_WEIGHT.get(vuln.exposure, 2) / 2.0

        # Data sensitivity multiplier
        data_sens_mult = self.DATA_SENSITIVITY_WEIGHT.get(vuln.data_sensitivity, 2) / 2.0

        # Compensating controls reduction
        controls_mult = 0.5 if vuln.compensating_controls else 1.0

        # Calculate final priority score
        priority_score = (
            cvss_score *
            exploit_available_mult *
            exploit_in_wild_mult *
            asset_mult *
            exposure_mult *
            data_sens_mult *
            controls_mult
        )

        return priority_score

    def determine_priority_level(self, priority_score: float) -> str:
        """Determine priority level (P0-P3) based on score"""
        if priority_score >= 14:
            return "P0"  # Critical
        elif priority_score >= 10:
            return "P1"  # High
        elif priority_score >= 6:
            return "P2"  # Medium
        else:
            return "P3"  # Low

    def calculate_due_date(self, vuln: Vulnerability, priority_level: str) -> str:
        """Calculate patch due date based on priority level"""
        sla_days = self.SLA_MAPPING.get(priority_level, 90)
        discovered = datetime.strptime(vuln.discovered_date, "%Y-%m-%d")
        due_date = discovered + timedelta(days=sla_days)
        return due_date.strftime("%Y-%m-%d")

    def generate_rationale(self, vuln: Vulnerability, priority_score: float) -> str:
        """Generate human-readable rationale for prioritization"""
        factors = []

        if vuln.cvss_score >= 9.0:
            factors.append("Critical CVSS score")
        elif vuln.cvss_score >= 7.0:
            factors.append("High CVSS score")

        if vuln.exploit_in_wild:
            factors.append("Active exploitation in wild")

        if vuln.exploit_available:
            factors.append("Public exploit available")

        if vuln.exposure == "internet_facing":
            factors.append("Internet-facing system")

        if vuln.asset_criticality >= 4:
            factors.append("Critical business system")

        if vuln.data_sensitivity == "highly_confidential":
            factors.append("Contains sensitive data (PII/PHI)")

        if vuln.compensating_controls:
            factors.append("Compensating controls in place (WAF/IPS)")

        return "; ".join(factors) if factors else "Standard risk assessment"

    def add_vulnerability(self, vuln: Vulnerability):
        """Add vulnerability to assessment"""
        self.vulnerabilities.append(vuln)

    def generate_report(self) -> List[Dict]:
        """Generate prioritized vulnerability report"""
        report = []

        for vuln in self.vulnerabilities:
            priority_score = self.calculate_priority_score(vuln)
            priority_level = self.determine_priority_level(priority_score)
            due_date = self.calculate_due_date(vuln, priority_level)
            rationale = self.generate_rationale(vuln, priority_score)

            report.append({
                "CVE ID": vuln.cve_id,
                "Title": vuln.title,
                "Affected System": vuln.affected_system,
                "CVSS Score": f"{vuln.cvss_score:.1f}",
                "Priority Score": f"{priority_score:.2f}",
                "Priority Level": priority_level,
                "SLA Days": self.SLA_MAPPING[priority_level],
                "Discovered": vuln.discovered_date,
                "Due Date": due_date,
                "Exploit Available": "Yes" if vuln.exploit_available else "No",
                "Active Exploitation": "Yes" if vuln.exploit_in_wild else "No",
                "Asset Criticality": vuln.asset_criticality,
                "Exposure": vuln.exposure,
                "Data Sensitivity": vuln.data_sensitivity,
                "Compensating Controls": "Yes" if vuln.compensating_controls else "No",
                "Rationale": rationale
            })

        # Sort by priority score (descending)
        report.sort(key=lambda x: float(x["Priority Score"]), reverse=True)

        return report

    def generate_summary(self) -> Dict:
        """Generate summary statistics"""
        if not self.vulnerabilities:
            return {}

        priority_counts = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}

        for vuln in self.vulnerabilities:
            priority_score = self.calculate_priority_score(vuln)
            priority_level = self.determine_priority_level(priority_score)
            priority_counts[priority_level] += 1

        # Count exploitable vulnerabilities
        exploitable = sum(1 for v in self.vulnerabilities if v.exploit_available)
        actively_exploited = sum(1 for v in self.vulnerabilities if v.exploit_in_wild)

        # Count by exposure
        internet_facing = sum(1 for v in self.vulnerabilities if v.exposure == "internet_facing")

        return {
            "total_vulnerabilities": len(self.vulnerabilities),
            "priority_distribution": priority_counts,
            "exploitable_count": exploitable,
            "actively_exploited_count": actively_exploited,
            "internet_facing_count": internet_facing
        }


def load_vulnerabilities_from_csv(filename: str) -> List[Vulnerability]:
    """Load vulnerabilities from CSV file"""
    vulnerabilities = []

    with open(filename, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            vuln = Vulnerability(
                cve_id=row['cve_id'],
                title=row['title'],
                cvss_score=float(row['cvss_score']),
                affected_system=row['affected_system'],
                asset_criticality=int(row['asset_criticality']),
                exposure=row['exposure'],
                data_sensitivity=row['data_sensitivity'],
                exploit_available=row['exploit_available'].lower() == 'true',
                exploit_in_wild=row['exploit_in_wild'].lower() == 'true',
                compensating_controls=row['compensating_controls'].lower() == 'true',
                discovered_date=row['discovered_date']
            )
            vulnerabilities.append(vuln)

    return vulnerabilities


def save_report_to_csv(report: List[Dict], filename: str):
    """Save vulnerability report to CSV file"""
    if not report:
        print("No data to save")
        return

    with open(filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=report[0].keys())
        writer.writeheader()
        writer.writerows(report)

    print(f"✓ Report saved to {filename}")


def interactive_mode():
    """Interactive vulnerability prioritization mode"""
    prioritizer = VulnerabilityPrioritizer()

    print("=" * 60)
    print("Vulnerability Prioritization Tool - Interactive Mode")
    print("=" * 60)

    while True:
        print("\nOptions:")
        print("1. Add new vulnerability")
        print("2. Generate prioritization report")
        print("3. View summary statistics")
        print("4. Exit")

        choice = input("\nEnter choice (1-4): ").strip()

        if choice == "1":
            print("\n--- Add New Vulnerability ---")
            cve_id = input("CVE ID (e.g., CVE-2021-44228): ").strip()
            title = input("Title: ").strip()
            cvss_score = float(input("CVSS Score (0-10): "))
            affected_system = input("Affected System: ").strip()
            asset_criticality = int(input("Asset Criticality (1-5, 5=most critical): "))

            print("\nExposure:")
            print("  1. internet_facing")
            print("  2. internal")
            print("  3. isolated")
            exposure_choice = input("Select (1-3): ")
            exposure_map = {"1": "internet_facing", "2": "internal", "3": "isolated"}
            exposure = exposure_map.get(exposure_choice, "internal")

            print("\nData Sensitivity:")
            print("  1. highly_confidential (PII/PHI/Financial)")
            print("  2. confidential")
            print("  3. public")
            sens_choice = input("Select (1-3): ")
            sens_map = {"1": "highly_confidential", "2": "confidential", "3": "public"}
            data_sensitivity = sens_map.get(sens_choice, "confidential")

            exploit_available = input("Public exploit available? (yes/no): ").lower() == "yes"
            exploit_in_wild = input("Active exploitation in wild? (yes/no): ").lower() == "yes"
            compensating_controls = input("Compensating controls in place? (yes/no): ").lower() == "yes"
            discovered_date = input("Discovered date (YYYY-MM-DD): ").strip()

            vuln = Vulnerability(
                cve_id, title, cvss_score, affected_system, asset_criticality,
                exposure, data_sensitivity, exploit_available, exploit_in_wild,
                compensating_controls, discovered_date
            )
            prioritizer.add_vulnerability(vuln)

            # Calculate and display priority
            priority_score = prioritizer.calculate_priority_score(vuln)
            priority_level = prioritizer.determine_priority_level(priority_score)
            due_date = prioritizer.calculate_due_date(vuln, priority_level)
            rationale = prioritizer.generate_rationale(vuln, priority_score)

            print(f"\n✓ Vulnerability added successfully!")
            print(f"  Priority Score: {priority_score:.2f}")
            print(f"  Priority Level: {priority_level}")
            print(f"  SLA: Patch within {prioritizer.SLA_MAPPING[priority_level]} days")
            print(f"  Due Date: {due_date}")
            print(f"  Rationale: {rationale}")

        elif choice == "2":
            if not prioritizer.vulnerabilities:
                print("No vulnerabilities added yet. Please add a vulnerability first.")
                continue

            report = prioritizer.generate_report()

            print("\n" + "=" * 150)
            print("Vulnerability Prioritization Report")
            print("=" * 150)
            print(f"{'CVE ID':<20} {'System':<25} {'CVSS':<6} {'Priority':<10} {'Level':<7} {'Due Date':<12} {'Rationale':<50}")
            print("-" * 150)

            for row in report:
                print(f"{row['CVE ID']:<20} "
                      f"{row['Affected System']:<25} "
                      f"{row['CVSS Score']:<6} "
                      f"{row['Priority Score']:<10} "
                      f"{row['Priority Level']:<7} "
                      f"{row['Due Date']:<12} "
                      f"{row['Rationale']:<50}")

        elif choice == "3":
            summary = prioritizer.generate_summary()
            if not summary:
                print("No vulnerabilities added yet. Please add a vulnerability first.")
                continue

            print("\n" + "=" * 60)
            print("Vulnerability Summary")
            print("=" * 60)
            print(f"Total Vulnerabilities: {summary['total_vulnerabilities']}")
            print(f"\nPriority Distribution:")
            for level, count in summary['priority_distribution'].items():
                print(f"  {level}: {count}")
            print(f"\nExploitability:")
            print(f"  Public exploits available: {summary['exploitable_count']}")
            print(f"  Active exploitation: {summary['actively_exploited_count']}")
            print(f"\nExposure:")
            print(f"  Internet-facing systems: {summary['internet_facing_count']}")

        elif choice == "4":
            print("Exiting...")
            break

        else:
            print("Invalid choice. Please enter 1-4.")


def main():
    parser = argparse.ArgumentParser(description="Vulnerability Prioritization Tool")
    parser.add_argument('input_file', nargs='?', help='CSV file containing vulnerability data')
    parser.add_argument('--output', '-o', help='Output CSV file for prioritized report')
    parser.add_argument('--interactive', '-i', action='store_true',
                       help='Run in interactive mode')
    parser.add_argument('--filter-level', choices=['P0', 'P1', 'P2', 'P3'],
                       help='Filter to show only specified priority level')

    args = parser.parse_args()

    if args.interactive:
        interactive_mode()
        return

    if not args.input_file:
        print("Error: Please provide an input file or use --interactive mode")
        parser.print_help()
        return

    try:
        vulnerabilities = load_vulnerabilities_from_csv(args.input_file)
        prioritizer = VulnerabilityPrioritizer()

        for vuln in vulnerabilities:
            prioritizer.add_vulnerability(vuln)

        print(f"✓ Loaded {len(vulnerabilities)} vulnerabilities from {args.input_file}")

        # Generate report
        report = prioritizer.generate_report()

        # Filter if requested
        if args.filter_level:
            report = [r for r in report if r['Priority Level'] == args.filter_level]

        # Display summary
        summary = prioritizer.generate_summary()
        print("\n" + "=" * 60)
        print("Vulnerability Summary")
        print("=" * 60)
        print(f"Total Vulnerabilities: {summary['total_vulnerabilities']}")
        print(f"\nPriority Distribution:")
        for level, count in summary['priority_distribution'].items():
            print(f"  {level}: {count}")
        print(f"\nExploitability:")
        print(f"  Public exploits available: {summary['exploitable_count']}")
        print(f"  Active exploitation: {summary['actively_exploited_count']}")

        # Display top prioritized vulnerabilities
        print("\n" + "=" * 150)
        print("Top Prioritized Vulnerabilities")
        print("=" * 150)
        print(f"{'CVE ID':<20} {'System':<30} {'CVSS':<6} {'Priority':<10} {'Level':<7} {'Due Date':<12}")
        print("-" * 150)

        for row in report[:15]:  # Show top 15
            print(f"{row['CVE ID']:<20} "
                  f"{row['Affected System']:<30} "
                  f"{row['CVSS Score']:<6} "
                  f"{row['Priority Score']:<10} "
                  f"{row['Priority Level']:<7} "
                  f"{row['Due Date']:<12}")

        # Save report if output file specified
        if args.output:
            save_report_to_csv(report, args.output)

    except FileNotFoundError:
        print(f"Error: File '{args.input_file}' not found")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
