#!/usr/bin/env python3
"""
Generate DynamoDB batch-write JSON files for SecureBase demo data
Creates files compatible with AWS CLI batch-write-item format
"""

import json
import sys

def generate_customers_batch(table_name):
    """Generate customers batch-write JSON"""
    customers = [
        {
            "id": "demo-customer-001",
            "name": "HealthCorp Medical Systems",
            "email": "admin@healthcorp.example.com",
            "tier": "healthcare",
            "framework": "HIPAA",
            "status": "active",
            "monthly_price": 15000,
            "accounts": 45,
            "created_at": "2025-11-01T00:00:00Z"
        },
        {
            "id": "demo-customer-002",
            "name": "FinTechAI Analytics",
            "email": "admin@fintechai.example.com",
            "tier": "fintech",
            "framework": "SOC 2 Type II",
            "status": "active",
            "monthly_price": 8000,
            "accounts": 28,
            "created_at": "2025-12-01T00:00:00Z"
        },
        {
            "id": "demo-customer-003",
            "name": "StartupMVP Inc",
            "email": "admin@startupmvp.example.com",
            "tier": "standard",
            "framework": "CIS Foundations",
            "status": "active",
            "monthly_price": 2000,
            "accounts": 5,
            "created_at": "2026-01-01T00:00:00Z"
        },
        {
            "id": "demo-customer-004",
            "name": "GovContractor Defense Solutions",
            "email": "admin@govcontractor.example.com",
            "tier": "government",
            "framework": "FedRAMP Low",
            "status": "active",
            "monthly_price": 25000,
            "accounts": 120,
            "created_at": "2025-10-01T00:00:00Z"
        },
        {
            "id": "demo-customer-005",
            "name": "SaaSPlatform Cloud Services",
            "email": "admin@saasplatform.example.com",
            "tier": "fintech",
            "framework": "SOC 2 Type II",
            "status": "active",
            "monthly_price": 8000,
            "accounts": 35,
            "created_at": "2025-11-01T00:00:00Z"
        }
    ]
    
    # Convert to DynamoDB batch-write format
    put_requests = []
    for customer in customers:
        item = {
            "PutRequest": {
                "Item": {
                    "id": {"S": customer["id"]},
                    "name": {"S": customer["name"]},
                    "email": {"S": customer["email"]},
                    "tier": {"S": customer["tier"]},
                    "framework": {"S": customer["framework"]},
                    "status": {"S": customer["status"]},
                    "monthly_price": {"N": str(customer["monthly_price"])},
                    "accounts": {"N": str(customer["accounts"])},
                    "created_at": {"S": customer["created_at"]}
                }
            }
        }
        put_requests.append(item)
    
    return {table_name: put_requests}


def generate_invoices_batch(table_name):
    """Generate invoices batch-write JSON (first 25 items for batch limit)"""
    
    # Import invoice generation logic
    sys.path.insert(0, '../data')
    from generate_invoices import generate_invoices
    
    invoices = generate_invoices()
    
    # DynamoDB batch-write has 25 item limit, so we'll create multiple files
    batches = []
    batch_size = 25
    
    for i in range(0, len(invoices), batch_size):
        batch_invoices = invoices[i:i+batch_size]
        put_requests = []
        
        for invoice in batch_invoices:
            # Convert line_items to DynamoDB format
            line_items_list = []
            for item in invoice["line_items"]:
                line_items_list.append({
                    "M": {
                        "description": {"S": item["description"]},
                        "amount": {"N": str(item["amount"])},
                        "quantity": {"N": str(item["quantity"])},
                        "unit_price": {"N": str(item["unit_price"])}
                    }
                })
            
            item = {
                "PutRequest": {
                    "Item": {
                        "id": {"S": invoice["id"]},
                        "invoice_number": {"S": invoice["invoice_number"]},
                        "customer_id": {"S": invoice["customer_id"]},
                        "customer_name": {"S": invoice["customer_name"]},
                        "month": {"S": invoice["month"]},
                        "total_amount": {"N": str(invoice["total_amount"])},
                        "status": {"S": invoice["status"]},
                        "due_date": {"S": invoice["due_date"]},
                        "created_at": {"S": invoice["created_at"]},
                        "billing_period_start": {"S": invoice["billing_period_start"]},
                        "billing_period_end": {"S": invoice["billing_period_end"]},
                        "line_items": {"L": line_items_list},
                        "pdf_url": {"S": invoice["pdf_url"]},
                        "currency": {"S": invoice["currency"]}
                    }
                }
            }
            
            # Add paid_date if present
            if invoice.get("paid_date"):
                item["PutRequest"]["Item"]["paid_date"] = {"S": invoice["paid_date"]}
            
            put_requests.append(item)
        
        batches.append({table_name: put_requests})
    
    return batches


if __name__ == "__main__":
    # Read table names from environment or use defaults
    import os
    
    customers_table = os.environ.get("CUSTOMERS_TABLE", "securebase-demo-customers-demo")
    invoices_table = os.environ.get("INVOICES_TABLE", "securebase-demo-invoices-demo")
    
    # Generate customers batch file
    customers_batch = generate_customers_batch(customers_table)
    with open("load_customers.json", "w") as f:
        json.dump(customers_batch, f, indent=2)
    print(f"Generated load_customers.json with {len(customers_batch[customers_table])} items")
    
    # Generate invoice batch files
    invoice_batches = generate_invoices_batch(invoices_table)
    for idx, batch in enumerate(invoice_batches):
        filename = f"load_invoices_batch{idx+1}.json"
        with open(filename, "w") as f:
            json.dump(batch, f, indent=2)
        print(f"Generated {filename} with {len(batch[invoices_table])} items")
    
    # Create a combined loader file
    with open("load_invoices.json", "w") as f:
        # Just use the first batch for the simple loader
        json.dump(invoice_batches[0], f, indent=2)
    print(f"Generated load_invoices.json (first batch)")
