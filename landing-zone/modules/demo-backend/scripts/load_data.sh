#!/bin/bash
# Load demo data into DynamoDB tables
# Usage: ./load_data.sh <customers_table> <invoices_table> <metrics_table>

set -e

CUSTOMERS_TABLE=${1:-"securebase-demo-customers-demo"}
INVOICES_TABLE=${2:-"securebase-demo-invoices-demo"}
METRICS_TABLE=${3:-"securebase-demo-metrics-demo"}
REGION=${AWS_REGION:-"us-east-1"}

echo "Loading demo data into DynamoDB tables..."
echo "Customers: $CUSTOMERS_TABLE"
echo "Invoices: $INVOICES_TABLE"
echo "Metrics: $METRICS_TABLE"
echo "Region: $REGION"
echo ""

# Navigate to scripts directory
cd "$(dirname "$0")"

# Generate batch files
echo "Generating batch files..."
CUSTOMERS_TABLE=$CUSTOMERS_TABLE INVOICES_TABLE=$INVOICES_TABLE python3 generate_batch_files.py

# Load customers
echo "Loading customers..."
if [ -f load_customers.json ]; then
    aws dynamodb batch-write-item \
        --request-items file://load_customers.json \
        --region $REGION
    echo "✓ Loaded 5 customers"
fi

# Load invoices (all batches)
echo "Loading invoices..."
for batch_file in load_invoices_batch*.json; do
    if [ -f "$batch_file" ]; then
        aws dynamodb batch-write-item \
            --request-items file://$batch_file \
            --region $REGION
        echo "✓ Loaded batch: $batch_file"
    fi
done

# Load metrics
echo "Loading metrics..."
cd ../data
python3 -c "
import json
import boto3

metrics = json.load(open('metrics.json'))

# Add DynamoDB 'id' key
metrics['id'] = 'global'

dynamodb = boto3.resource('dynamodb', region_name='$REGION')
table = dynamodb.Table('$METRICS_TABLE')

# Convert floats to Decimal for DynamoDB
from decimal import Decimal

def convert_floats(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats(item) for item in obj]
    return obj

metrics = convert_floats(metrics)
table.put_item(Item=metrics)
print('✓ Loaded global metrics')
"

echo ""
echo "✓ Data loading complete!"
echo ""
echo "Verify with:"
echo "  aws dynamodb scan --table-name $CUSTOMERS_TABLE --region $REGION"
echo "  aws dynamodb scan --table-name $INVOICES_TABLE --region $REGION --max-items 5"
echo "  aws dynamodb get-item --table-name $METRICS_TABLE --key '{\"id\":{\"S\":\"global\"}}' --region $REGION"
