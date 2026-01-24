# ElastiCache Redis Module

This Terraform module creates an ElastiCache Redis cluster for high-performance query caching in SecureBase.

## Features

- **High availability**: Multi-AZ deployment with automatic failover
- **Security**: VPC isolation, encryption at rest and in transit, AUTH token support
- **Monitoring**: CloudWatch alarms for CPU, memory, evictions, cache hit rate
- **Automatic backups**: Daily snapshots with configurable retention
- **Performance optimization**: LRU eviction policy, connection pooling ready
- **Logging**: Slow query and engine logs sent to CloudWatch

## Usage

```hcl
module "elasticache" {
  source = "./modules/elasticache"
  
  environment                 = "prod"
  vpc_id                      = module.vpc.vpc_id
  subnet_ids                  = module.vpc.private_subnet_ids
  allowed_security_group_ids  = [module.lambda.security_group_id]
  
  # Instance configuration
  node_type                   = "cache.r6g.large"  # 13.07 GB RAM
  num_cache_nodes             = 2                   # Primary + 1 replica
  multi_az_enabled            = true
  
  # Security
  auth_token_enabled          = true
  auth_token                  = random_password.redis_auth.result
  store_auth_token            = true
  
  # Backup
  snapshot_retention_limit    = 7
  snapshot_window             = "03:00-05:00"
  maintenance_window          = "sun:05:00-sun:07:00"
  
  # Monitoring
  notification_topic_arn      = aws_sns_topic.alerts.arn
  alarm_actions               = [aws_sns_topic.alerts.arn]
  
  tags = {
    Project = "SecureBase"
    Tier    = "Premium"
  }
}

# Generate secure auth token
resource "random_password" "redis_auth" {
  length  = 32
  special = false  # Alphanumeric only for Redis AUTH
}
```

## Node Types

Choose based on expected cache size and throughput:

| Node Type | vCPUs | RAM | Network | Use Case |
|-----------|-------|-----|---------|----------|
| cache.t3.micro | 2 | 0.5 GB | Low | Dev/test |
| cache.t3.small | 2 | 1.37 GB | Low-Moderate | Small prod |
| cache.r6g.large | 2 | 13.07 GB | Up to 10 Gbps | Production |
| cache.r6g.xlarge | 4 | 26.32 GB | Up to 12 Gbps | High traffic |

## Performance Tuning

### Memory Policy
The module uses `allkeys-lru` (Least Recently Used) eviction:
- Automatically evicts least recently used keys when memory is full
- Ideal for caching use case (query results, API responses)

### TTL Strategy
Set appropriate TTLs in your application:

```python
# Short TTL for frequently changing data
redis.setex('customer:123:invoices', 300, value)  # 5 minutes

# Medium TTL for semi-static data
redis.setex('customer:123:metrics', 3600, value)  # 1 hour

# Long TTL for rarely changing data
redis.setex('customer:123:tier', 86400, value)  # 24 hours
```

## Connection from Lambda

### Environment Variables
```python
# Lambda environment variables
REDIS_HOST = module.elasticache.primary_endpoint_address
REDIS_PORT = 6379
REDIS_AUTH_SECRET = module.elasticache.auth_token_secret_arn
```

### Python Code
```python
import redis
import json
import boto3
from functools import lru_cache

@lru_cache(maxsize=1)
def get_redis_client():
    # Get auth token from Secrets Manager
    secrets_client = boto3.client('secretsmanager')
    secret = secrets_client.get_secret_value(SecretId=os.environ['REDIS_AUTH_SECRET'])
    config = json.loads(secret['SecretString'])
    
    return redis.Redis(
        host=config['host'],
        port=config['port'],
        password=config['auth_token'],
        ssl=True,
        decode_responses=True,
        socket_keepalive=True,
        socket_connect_timeout=5,
        socket_timeout=5
    )

def lambda_handler(event, context):
    redis_client = get_redis_client()
    
    # Try cache first
    cache_key = f"analytics:{customer_id}:{date_range}"
    cached = redis_client.get(cache_key)
    
    if cached:
        return json.loads(cached)
    
    # Cache miss - fetch from database
    result = query_database(customer_id, date_range)
    
    # Store in cache (5 minute TTL)
    redis_client.setex(cache_key, 300, json.dumps(result))
    
    return result
```

## Monitoring

### Key Metrics

Access metrics in CloudWatch under `AWS/ElastiCache` namespace:

- **CPUUtilization**: Should stay < 75%
- **DatabaseMemoryUsagePercentage**: Alarm at 85%
- **CacheHitRate**: Target > 70%
- **Evictions**: High evictions indicate undersized cache
- **ReplicationLag**: Should be < 1 second

### Alarms

Pre-configured alarms:
- CPU > 75% for 10 minutes
- Memory > 85% for 10 minutes
- Evictions > 1000 per 5 minutes
- Cache hit rate < 70% for 15 minutes
- Replication lag > 5 seconds (multi-node only)

### Logs

Slow query log captures queries taking > 10ms:
```bash
aws logs tail /aws/elasticache/securebase-prod/redis/slow-log --follow
```

## High Availability

With `num_cache_nodes = 2` and `multi_az_enabled = true`:

- **Primary node**: Handles writes and reads
- **Replica node**: Handles reads, automatic failover target
- **Automatic failover**: Promotes replica to primary if primary fails
- **RTO**: < 60 seconds
- **RPO**: < 1 second (near-zero data loss)

## Backup and Recovery

### Automatic Backups
- Daily snapshots during `snapshot_window`
- Retained for `snapshot_retention_limit` days
- Incremental (fast, minimal performance impact)

### Manual Snapshot
```bash
aws elasticache create-snapshot \
  --replication-group-id securebase-prod-redis \
  --snapshot-name manual-backup-2026-01-24
```

### Restore from Snapshot
```bash
aws elasticache create-replication-group \
  --replication-group-id securebase-prod-redis-restored \
  --snapshot-name manual-backup-2026-01-24 \
  --cache-node-type cache.r6g.large
```

## Security

- **VPC isolation**: No public internet access
- **Encryption at rest**: AES-256 encryption
- **Encryption in transit**: TLS 1.2+
- **AUTH token**: 32-character random password
- **Security groups**: Only Lambda SG allowed access
- **Secrets Manager**: AUTH token stored securely

## Cost Optimization

### Dev Environment
```hcl
node_type                = "cache.t3.micro"
num_cache_nodes          = 1
snapshot_retention_limit = 1
```
**Cost**: ~$12/month

### Production Environment
```hcl
node_type                = "cache.r6g.large"
num_cache_nodes          = 2
snapshot_retention_limit = 7
```
**Cost**: ~$200/month (us-east-1)

### Reserved Instances
Save 30-55% with 1 or 3 year commitments.

## Troubleshooting

**High eviction rate**
- Increase `node_type` (more RAM)
- Review cache TTLs (shorter = more evictions)
- Check for memory leaks in cached data

**Low cache hit rate**
- Cache TTLs too short
- Cache keys not consistent (e.g., timestamps in key)
- Cold start after deployment

**Connection timeouts**
- Check security group rules
- Verify Lambda is in same VPC
- Check ENI limits in VPC

## Inputs

See [variables.tf](./variables.tf) for complete list.

## Outputs

- `primary_endpoint_address`: Write endpoint
- `reader_endpoint_address`: Read endpoint (if replicas)
- `auth_token_secret_arn`: Secrets Manager ARN
- `connection_string`: Redis connection string

## Related Resources

- [ElastiCache Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)
- [Redis Commands Reference](https://redis.io/commands)
- [Boto3 Redis](https://github.com/redis/redis-py)
