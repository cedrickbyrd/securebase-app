# Data Warehouse Integration Guide

**Phase 4: Advanced Analytics & Reporting**  
**Version:** 1.0  
**Last Updated:** January 23, 2026

---

## Table of Contents
1. [Overview](#overview)
2. [Supported Data Warehouses](#supported-data-warehouses)
3. [Integration Architecture](#integration-architecture)
4. [Redshift Integration](#redshift-integration)
5. [Snowflake Integration](#snowflake-integration)
6. [Data Export Patterns](#data-export-patterns)
7. [Performance Optimization](#performance-optimization)
8. [Security & Compliance](#security--compliance)

---

## Overview

SecureBase Analytics provides native integration with enterprise data warehouses, enabling:
- **Bulk data export** for deep historical analysis
- **Custom BI tool integration** (Tableau, PowerBI, Looker)
- **Advanced analytics** beyond built-in capabilities
- **Data lake integration** for long-term storage
- **Compliance reporting** with audit trails

### Supported Workflows
- Real-time streaming (EventBridge → Data Warehouse)
- Batch exports (Scheduled exports to S3 → Data Warehouse)
- Query federation (Direct queries from warehouse to DynamoDB)
- ETL pipelines (AWS Glue transformation)

---

## Supported Data Warehouses

### Primary Support
- **Amazon Redshift** - AWS native, fully integrated
- **Snowflake** - Cross-cloud, high performance
- **Amazon Athena** - Serverless, S3-based queries

### Additional Support (via standard connectors)
- Google BigQuery
- Azure Synapse Analytics
- Databricks
- Teradata
- Oracle Exadata

---

## Integration Architecture

### High-Level Flow

```
SecureBase Analytics
    ↓
DynamoDB Tables (reports, metrics, usage)
    ↓
AWS Glue ETL Jobs
    ↓
S3 Data Lake (Parquet format)
    ↓
Data Warehouse (Redshift/Snowflake)
    ↓
BI Tools (Tableau, PowerBI, Looker)
```

### Components

1. **Data Source:** DynamoDB tables with analytics data
2. **ETL Layer:** AWS Glue for transformation
3. **Storage Layer:** S3 as staging/data lake
4. **Warehouse Layer:** Redshift or Snowflake
5. **Consumption Layer:** BI tools, custom dashboards

---

## Redshift Integration

### Prerequisites
- AWS Redshift cluster (ra3.xlplus recommended)
- S3 bucket for data exports
- IAM role with Redshift + S3 permissions
- VPC configuration for secure access

### Step 1: Create Redshift Schema

```sql
-- Create database
CREATE DATABASE securebase_analytics;

-- Connect to database
\c securebase_analytics;

-- Create schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Cost metrics table
CREATE TABLE analytics.cost_metrics (
    customer_id VARCHAR(128) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    service VARCHAR(64),
    region VARCHAR(32),
    cost DECIMAL(18,4),
    usage BIGINT,
    tags SUPER,  -- JSON data type in Redshift
    PRIMARY KEY (customer_id, timestamp, service)
)
DISTSTYLE KEY
DISTKEY (customer_id)
SORTKEY (timestamp);

-- Security findings table
CREATE TABLE analytics.security_findings (
    customer_id VARCHAR(128) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    severity VARCHAR(16),
    finding_id VARCHAR(128),
    service VARCHAR(64),
    resource_id VARCHAR(256),
    description TEXT,
    status VARCHAR(32),
    PRIMARY KEY (customer_id, finding_id)
)
DISTSTYLE KEY
DISTKEY (customer_id)
SORTKEY (timestamp);

-- Compliance assessments table
CREATE TABLE analytics.compliance_assessments (
    customer_id VARCHAR(128) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    framework VARCHAR(32),
    control_id VARCHAR(64),
    status VARCHAR(16),
    resource_count INT,
    passed_count INT,
    failed_count INT,
    PRIMARY KEY (customer_id, timestamp, framework, control_id)
)
DISTSTYLE KEY
DISTKEY (customer_id)
SORTKEY (timestamp);
```

### Step 2: Configure IAM Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::securebase-analytics-exports/*",
        "arn:aws:s3:::securebase-analytics-exports"
      ]
    }
  ]
}
```

### Step 3: Create AWS Glue ETL Job

```python
# AWS Glue ETL script for DynamoDB → S3 → Redshift
import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

# Initialize
args = getResolvedOptions(sys.argv, ['JOB_NAME'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Read from DynamoDB
datasource = glueContext.create_dynamic_frame.from_catalog(
    database="securebase",
    table_name="metrics",
    transformation_ctx="datasource"
)

# Transform
transformed = datasource.apply_mapping([
    ("customer_id", "string", "customer_id", "string"),
    ("timestamp", "string", "timestamp", "timestamp"),
    ("service", "string", "service", "string"),
    ("region", "string", "region", "string"),
    ("cost", "decimal", "cost", "decimal"),
    ("usage", "long", "usage", "bigint")
])

# Write to S3 in Parquet format
glueContext.write_dynamic_frame.from_options(
    frame=transformed,
    connection_type="s3",
    connection_options={
        "path": "s3://securebase-analytics-exports/metrics/",
        "partitionKeys": ["customer_id", "timestamp"]
    },
    format="parquet",
    transformation_ctx="write_s3"
)

# Load into Redshift
glueContext.write_dynamic_frame.from_jdbc_conf(
    frame=transformed,
    catalog_connection="redshift-connection",
    connection_options={
        "dbtable": "analytics.cost_metrics",
        "database": "securebase_analytics"
    },
    redshift_tmp_dir="s3://securebase-analytics-temp/",
    transformation_ctx="write_redshift"
)

job.commit()
```

### Step 4: Schedule ETL Job

```bash
# AWS CLI command to schedule Glue job
aws glue create-trigger \
  --name securebase-daily-etl \
  --type SCHEDULED \
  --schedule "cron(0 2 * * ? *)" \
  --actions '[{"JobName":"securebase-dynamodb-to-redshift"}]'
```

### Step 5: Query from Redshift

```sql
-- Daily cost by service (last 30 days)
SELECT 
    service,
    DATE_TRUNC('day', timestamp) AS date,
    SUM(cost) AS daily_cost,
    SUM(usage) AS total_usage
FROM analytics.cost_metrics
WHERE customer_id = 'customer-123'
  AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY service, DATE_TRUNC('day', timestamp)
ORDER BY daily_cost DESC;

-- Security findings trend
SELECT 
    severity,
    DATE_TRUNC('week', timestamp) AS week,
    COUNT(*) AS finding_count
FROM analytics.security_findings
WHERE customer_id = 'customer-123'
  AND status = 'open'
GROUP BY severity, week
ORDER BY week DESC, severity;
```

---

## Snowflake Integration

### Prerequisites
- Snowflake account and warehouse
- S3 bucket for data staging
- Snowflake external stage configuration
- AWS IAM role for Snowflake access

### Step 1: Create Snowflake Schema

```sql
-- Create database and schema
CREATE DATABASE IF NOT EXISTS SECUREBASE_ANALYTICS;
USE DATABASE SECUREBASE_ANALYTICS;
CREATE SCHEMA IF NOT EXISTS ANALYTICS;

-- Cost metrics table
CREATE TABLE ANALYTICS.COST_METRICS (
    CUSTOMER_ID VARCHAR(128) NOT NULL,
    TIMESTAMP TIMESTAMP_NTZ NOT NULL,
    SERVICE VARCHAR(64),
    REGION VARCHAR(32),
    COST NUMBER(18,4),
    USAGE NUMBER,
    TAGS VARIANT,  -- JSON data type in Snowflake
    PRIMARY KEY (CUSTOMER_ID, TIMESTAMP, SERVICE)
)
CLUSTER BY (CUSTOMER_ID, TIMESTAMP);

-- Security findings table  
CREATE TABLE ANALYTICS.SECURITY_FINDINGS (
    CUSTOMER_ID VARCHAR(128) NOT NULL,
    TIMESTAMP TIMESTAMP_NTZ NOT NULL,
    SEVERITY VARCHAR(16),
    FINDING_ID VARCHAR(128),
    SERVICE VARCHAR(64),
    RESOURCE_ID VARCHAR(256),
    DESCRIPTION TEXT,
    STATUS VARCHAR(32),
    PRIMARY KEY (CUSTOMER_ID, FINDING_ID)
)
CLUSTER BY (CUSTOMER_ID, TIMESTAMP);
```

### Step 2: Create Snowflake External Stage

```sql
-- Create external stage pointing to S3
CREATE OR REPLACE STAGE ANALYTICS.SECUREBASE_S3_STAGE
    URL = 's3://securebase-analytics-exports/'
    CREDENTIALS = (
        AWS_ROLE = 'arn:aws:iam::123456789012:role/SnowflakeAccess'
    )
    FILE_FORMAT = (
        TYPE = 'PARQUET'
        COMPRESSION = 'SNAPPY'
    );

-- Test stage
LIST @ANALYTICS.SECUREBASE_S3_STAGE;
```

### Step 3: Create Snowpipe for Continuous Loading

```sql
-- Create pipe for automatic data loading
CREATE OR REPLACE PIPE ANALYTICS.COST_METRICS_PIPE
    AUTO_INGEST = TRUE
AS
COPY INTO ANALYTICS.COST_METRICS
FROM @ANALYTICS.SECUREBASE_S3_STAGE/metrics/
FILE_FORMAT = (TYPE = 'PARQUET')
PATTERN = '.*\.parquet';

-- Show pipe status
SELECT SYSTEM$PIPE_STATUS('ANALYTICS.COST_METRICS_PIPE');
```

### Step 4: Configure S3 Event Notifications

```json
{
  "QueueConfigurations": [
    {
      "QueueArn": "arn:aws:sqs:us-east-1:123456789012:snowflake-ingest",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "prefix",
              "Value": "metrics/"
            },
            {
              "Name": "suffix",
              "Value": ".parquet"
            }
          ]
        }
      }
    }
  ]
}
```

### Step 5: Query from Snowflake

```sql
-- Cost analysis with window functions
SELECT 
    service,
    DATE_TRUNC('day', timestamp) AS date,
    SUM(cost) AS daily_cost,
    SUM(SUM(cost)) OVER (
        PARTITION BY service 
        ORDER BY DATE_TRUNC('day', timestamp)
    ) AS cumulative_cost,
    AVG(cost) OVER (
        PARTITION BY service 
        ORDER BY DATE_TRUNC('day', timestamp)
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_7day_avg
FROM ANALYTICS.COST_METRICS
WHERE CUSTOMER_ID = 'customer-123'
  AND TIMESTAMP >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY service, date
ORDER BY daily_cost DESC;

-- Security findings with JSON parsing
SELECT 
    severity,
    COUNT(*) AS finding_count,
    PARSE_JSON(description):category::STRING AS category,
    PARSE_JSON(description):recommendation::STRING AS recommendation
FROM ANALYTICS.SECURITY_FINDINGS
WHERE CUSTOMER_ID = 'customer-123'
  AND STATUS = 'open'
GROUP BY severity, category, recommendation;
```

---

## Data Export Patterns

### Pattern 1: Real-Time Streaming

```python
# EventBridge rule for real-time data streaming
{
    "source": ["securebase.analytics"],
    "detail-type": ["MetricCreated"],
    "detail": {
        "customer_id": ["customer-123"]
    }
}

# Lambda function to stream to Kinesis Data Firehose
import boto3
import json

firehose = boto3.client('firehose')

def lambda_handler(event, context):
    record = {
        'Data': json.dumps(event['detail']) + '\n'
    }
    
    response = firehose.put_record(
        DeliveryStreamName='securebase-to-warehouse',
        Record=record
    )
    
    return response
```

### Pattern 2: Scheduled Batch Export

```bash
# Cron expression: Daily at 2 AM UTC
aws events put-rule \
  --name securebase-daily-export \
  --schedule-expression "cron(0 2 * * ? *)"

# Export Lambda function
def export_to_warehouse(event, context):
    # Query DynamoDB for yesterday's data
    yesterday = datetime.now() - timedelta(days=1)
    items = dynamodb_table.query(
        KeyConditionExpression='customer_id = :cid AND timestamp >= :start',
        ExpressionAttributeValues={
            ':cid': 'customer-123',
            ':start': yesterday.isoformat()
        }
    )
    
    # Convert to Parquet
    df = pd.DataFrame(items)
    df.to_parquet(
        f's3://exports/{yesterday.strftime("%Y/%m/%d")}/data.parquet',
        compression='snappy'
    )
```

### Pattern 3: On-Demand Export via API

```javascript
// Export data warehouse snapshot
const exportToWarehouse = async (customerId, dateRange) => {
    const response = await fetch('/api/analytics/warehouse-export', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            customerId,
            dateRange,
            destination: 's3://warehouse-staging/',
            format: 'parquet',
            compression: 'snappy'
        })
    });
    
    return response.json();
};
```

---

## Performance Optimization

### Best Practices

1. **Use Columnar Formats**
   - Parquet for storage efficiency (70% smaller than JSON)
   - ORC for faster queries
   - Avro for schema evolution

2. **Partition Data**
   ```
   s3://exports/
     ├── customer_id=customer-123/
     │   ├── year=2024/
     │   │   ├── month=01/
     │   │   │   ├── day=15/
     │   │   │   │   └── data.parquet
   ```

3. **Optimize Table Design**
   - Distribution keys on customer_id
   - Sort keys on timestamp
   - Cluster by frequently queried columns

4. **Use Incremental Loading**
   - Only export new/changed data
   - Track watermarks in DynamoDB
   - Use `updated_at` timestamps

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Export latency | < 5 minutes | For 1M records |
| Query latency | < 10 seconds | p95, complex queries |
| Data freshness | < 30 minutes | Real-time streaming |
| Storage cost | < $20/TB/month | Using S3 + compression |

---

## Security & Compliance

### Data Encryption
- **At rest:** S3 SSE-KMS, Redshift encryption
- **In transit:** TLS 1.2+ for all connections
- **Key management:** AWS KMS with automatic rotation

### Access Control
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/DataAnalyst"
      },
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::securebase-exports/customer-123/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:ExistingObjectTag/customer_id": "customer-123"
        }
      }
    }
  ]
}
```

### Audit Logging
- All data exports logged to CloudTrail
- Query logs in Redshift/Snowflake
- Access logs in S3
- Retention: 7 years (compliance requirement)

### Compliance Frameworks
- **HIPAA:** PHI data encrypted, access logged
- **SOC 2:** Annual audits, security controls
- **GDPR:** Data deletion capabilities, audit trails

---

## Troubleshooting

### Common Issues

**Issue:** Slow ETL jobs  
**Solution:** Increase Glue DPU allocation, optimize partition strategy

**Issue:** Data duplication  
**Solution:** Enable idempotent writes, use MERGE instead of INSERT

**Issue:** Schema drift  
**Solution:** Use schema evolution (Parquet/Avro), version schemas

**Issue:** High costs  
**Solution:** Use S3 Intelligent-Tiering, compress data, optimize queries

---

## Support

**Documentation:** https://docs.securebase.io/data-warehouse  
**Email:** warehouse-support@securebase.io  
**Slack:** #data-warehouse-help

---

**Version:** 1.0  
**Last Updated:** January 23, 2026  
**Maintained by:** SecureBase Data Engineering Team
