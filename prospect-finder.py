#!/usr/bin/env python3
"""
SecureBase Prospect Finder
Finds and ranks B2B SaaS companies that need AWS compliance
"""

import json
import csv
from datetime import datetime

# Target criteria for ideal customers
IDEAL_CRITERIA = {
    'industries': ['Healthcare Tech', 'FinTech', 'SaaS', 'Security', 'AI/ML'],
    'funding_min': 3_000_000,  # $3M+
    'funding_max': 50_000_000,  # Under $50M (still nimble)
    'employee_range': (10, 200),  # Big enough to pay, small enough to move fast
    'founded_after': 2020,  # Recent = still building infrastructure
    'compliance_keywords': ['SOC 2', 'HIPAA', 'compliance', 'security', 'FedRAMP']
}

def score_prospect(company):
    """
    Score a prospect from 0-100 based on fit
    """
    score = 0
    
    # Industry fit (30 points)
    if company.get('industry') in IDEAL_CRITERIA['industries']:
        score += 30
    
    # Funding fit (25 points)
    funding = company.get('funding', 0)
    if IDEAL_CRITERIA['funding_min'] <= funding <= IDEAL_CRITERIA['funding_max']:
        score += 25
    elif funding > IDEAL_CRITERIA['funding_max']:
        score += 15  # Lots of money but slower
    
    # Employee count (20 points)
    employees = company.get('employees', 0)
    min_emp, max_emp = IDEAL_CRITERIA['employee_range']
    if min_emp <= employees <= max_emp:
        score += 20
    
    # Recency (15 points)
    founded = company.get('founded', 2000)
    if founded >= IDEAL_CRITERIA['founded_after']:
        score += 15
    
    # Compliance signals (10 points)
    description = company.get('description', '').lower()
    for keyword in IDEAL_CRITERIA['compliance_keywords']:
        if keyword.lower() in description:
            score += 2
    
    return min(score, 100)

def get_yc_companies():
    """
    Get YC companies (you'll need to scrape or use API)
    Returns list of company dicts
    """
    # Placeholder - in real version you'd scrape YC directory or use API
    return [
        {
            'name': 'HealthFlow',
            'industry': 'Healthcare Tech',
            'funding': 5_000_000,
            'employees': 25,
            'founded': 2023,
            'location': 'San Francisco, CA',
            'description': 'Digital health platform requiring HIPAA compliance',
            'website': 'healthflow.com',
            'founder_linkedin': 'https://linkedin.com/in/founder'
        },
        # More companies...
    ]

def get_crunchbase_companies():
    """
    Get companies from Crunchbase
    Requires API key: https://data.crunchbase.com/docs
    """
    # You would implement Crunchbase API here
    return []

def find_contact_info(company_name, domain):
    """
    Find contact email using common patterns
    """
    common_titles = ['CTO', 'VP Engineering', 'Head of Infrastructure', 'CEO']
    
    # Common email patterns
    patterns = [
        f"cto@{domain}",
        f"engineering@{domain}",
        f"hello@{domain}",
        f"contact@{domain}"
    ]
    
    return {
        'email_patterns': patterns,
        'linkedin_search': f"https://www.linkedin.com/search/results/people/?keywords={company_name}%20CTO"
    }

def main():
    print("🔍 SecureBase Prospect Finder")
    print("=" * 50)
    
    # Get companies from various sources
    all_companies = []
    
    # Add YC companies
    yc_companies = get_yc_companies()
    all_companies.extend(yc_companies)
    
    # Score and rank all companies
    for company in all_companies:
        company['score'] = score_prospect(company)
    
    # Sort by score
    all_companies.sort(key=lambda x: x['score'], reverse=True)
    
    # Filter for Dallas/FW
    dallas_companies = [
        c for c in all_companies 
        if any(city in c.get('location', '') for city in ['Dallas', 'Fort Worth', 'DFW', 'Irving', 'Plano', 'Frisco'])
    ]
    
    # Get top 25 nationwide
    top_25_nationwide = all_companies[:25]
    
    # Get top 10 Dallas
    top_10_dallas = dallas_companies[:10]
    
    # Export results
    export_to_csv(top_25_nationwide, 'top-25-nationwide.csv')
    export_to_csv(top_10_dallas, 'top-10-dallas.csv')
    
    # Print summary
    print(f"\n✅ Found {len(all_companies)} total companies")
    print(f"✅ Top 25 nationwide exported to: top-25-nationwide.csv")
    print(f"✅ Top 10 Dallas/FW exported to: top-10-dallas.csv")
    
    return top_25_nationwide, top_10_dallas

def export_to_csv(companies, filename):
    """Export companies to CSV"""
    if not companies:
        print(f"⚠️  No companies to export to {filename}")
        return
    
    with open(filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'score', 'name', 'industry', 'location', 'funding', 
            'employees', 'founded', 'description', 'website',
            'founder_linkedin', 'email_patterns'
        ])
        writer.writeheader()
        
        for company in companies:
            contact = find_contact_info(company['name'], company.get('website', ''))
            company['email_patterns'] = ', '.join(contact['email_patterns'])
            writer.writerow(company)
    
    print(f"📊 Exported {len(companies)} companies to {filename}")

if __name__ == '__main__':
    main()
