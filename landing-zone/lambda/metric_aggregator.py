import boto3
import json
import os
from datetime import datetime, timedelta

def lambda_handler(event, context):
    cw = boto3.client('cloudwatch')
    s3 = boto3.client('s3')
    bucket_name = os.environ.get('LOG_BUCKET')
    
    # Define metrics to aggregate (e.g., API Gateway Latency)
    queries = [{
        'Id': 'm1',
        'MetricStat': {
            'Metric': {
                'Namespace': 'AWS/ApiGateway',
                'MetricName': 'Latency'
            },
            'Period': 300,
            'Stat': 'Average'
        }
    }]
    
    response = cw.get_metric_data(
        MetricDataQueries=queries,
        StartTime=datetime.utcnow() - timedelta(hours=1),
        EndTime=datetime.utcnow()
    )
    
    # Save to S3 for Netlify Observer access
    file_key = f"telemetry/metrics-{datetime.now().strftime('%Y%m%d%H%M')}.json"
    s3.put_object(
        Bucket=bucket_name,
        Key=file_key,
        Body=json.dumps(response, default=str)
    )
    
    return {"status": "success", "key": file_key}
