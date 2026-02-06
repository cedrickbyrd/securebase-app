#!/usr/bin/env python3
"""
Generate SecureBase Demo Invoices
Deterministic invoice generation matching mockData.js logic
"""

import json
from datetime import datetime, timedelta

# Customer data with monthly amounts
CUSTOMERS = [
    {"id": "demo-customer-001", "name": "HealthCorp Medical Systems", "amount": 15000},
    {"id": "demo-customer-002", "name": "FinTechAI Analytics", "amount": 8000},
    {"id": "demo-customer-003", "name": "StartupMVP Inc", "amount": 2000},
    {"id": "demo-customer-004", "name": "GovContractor Defense Solutions", "amount": 25000},
    {"id": "demo-customer-005", "name": "SaaSPlatform Cloud Services", "amount": 8000}
]

# 6 months of billing history
MONTHS = [
    {"year": 2026, "month": 2, "name": "February", "days": 28},
    {"year": 2026, "month": 1, "name": "January", "days": 31},
    {"year": 2025, "month": 12, "name": "December", "days": 31},
    {"year": 2025, "month": 11, "name": "November", "days": 30},
    {"year": 2025, "month": 10, "name": "October", "days": 31},
    {"year": 2025, "month": 9, "name": "September", "days": 30}
]

STATUSES = ["paid", "paid", "paid", "paid", "issued", "overdue", "draft"]
INVOICE_VARIANCE = 10


def generate_invoices():
    """Generate 30 invoices (5 customers × 6 months)"""
    invoices = []
    invoice_counter = 1
    
    for month_data in MONTHS:
        year = month_data["year"]
        month = month_data["month"]
        month_name = month_data["name"]
        days = month_data["days"]
        
        for cust_idx, customer in enumerate(CUSTOMERS):
            status = STATUSES[invoice_counter % len(STATUSES)]
            
            # Calculate due date (15-29 days into next month)
            due_day = 15 + (invoice_counter % 15)
            due_month = 1 if month == 12 else month + 1
            due_year = year + 1 if month == 12 else year
            
            # Calculate paid date (spread across month, doesn't exceed days)
            paid_day = min(28 - (cust_idx * 2), days)
            
            invoice = {
                "id": f"inv_{year}_{str(month).zfill(2)}_{customer['id']}",
                "invoice_number": f"INV-{year}-{str(invoice_counter).zfill(4)}",
                "customer_id": customer["id"],
                "customer_name": customer["name"],
                "month": f"{month_name} {year}",
                "total_amount": customer["amount"] + (invoice_counter * INVOICE_VARIANCE),
                "status": status,
                "due_date": f"{due_year}-{str(due_month).zfill(2)}-{str(due_day).zfill(2)}",
                "paid_date": f"{year}-{str(month).zfill(2)}-{str(paid_day).zfill(2)}" if status == "paid" else None,
                "created_at": f"{year}-{str(month).zfill(2)}-01T00:00:00Z",
                "billing_period_start": f"{year}-{str(month).zfill(2)}-01",
                "billing_period_end": f"{year}-{str(month).zfill(2)}-{str(days).zfill(2)}",
                "line_items": [
                    {
                        "description": "Base Platform Fee",
                        "amount": int(customer["amount"] * 0.8),
                        "quantity": 1,
                        "unit_price": int(customer["amount"] * 0.8)
                    },
                    {
                        "description": "Support & Maintenance",
                        "amount": int(customer["amount"] * 0.2),
                        "quantity": 1,
                        "unit_price": int(customer["amount"] * 0.2)
                    }
                ],
                "pdf_url": "#",
                "currency": "USD"
            }
            
            invoices.append(invoice)
            invoice_counter += 1
    
    return invoices


if __name__ == "__main__":
    invoices = generate_invoices()
    print(json.dumps(invoices, indent=2))
    print(f"\n# Generated {len(invoices)} invoices", file=__import__('sys').stderr)
