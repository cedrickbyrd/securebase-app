"""
Health Check Lambda for SecureBase Phase 2.

Provides a simple health check endpoint for monitoring and disaster recovery.
This endpoint is used by:
  - Route53 health checks for failover
  - Load balancers for health monitoring
  - CloudWatch for availability metrics
  - Monitoring systems for uptime tracking

Environment variables:
  - RDS_HOST: RDS Proxy endpoint
  - RDS_DATABASE: securebase
  - RDS_USER: securebase_app
  - RDS_PASSWORD: (from Secrets Manager)
  - LOG_LEVEL: DEBUG|INFO|WARNING|ERROR

Event format (API Gateway):
  {
    "httpMethod": "GET",
    "path": "/health"
  }

Response format:
  {
    "statusCode": 200,
    "body": {
      "status": "healthy",
      "timestamp": "2026-02-05T14:30:00Z",
      "version": "2.0.0",
      "checks": {
        "database": "healthy"
      }
    }
  }
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any

# Import database utilities
sys.path.insert(0, '/opt/python')
try:
    from db_utils import get_connection, release_connection, DatabaseError
except ImportError:
    # For local testing without Lambda Layer
    get_connection = None
    release_connection = None
    DatabaseError = Exception

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Version constant
VERSION = "2.0.0"


def check_database() -> Dict[str, str]:
    """
    Check database connectivity.
    
    Returns:
        dict: Status dictionary with 'status' and optional 'error' keys
    """
    if not get_connection:
        return {"status": "unavailable", "error": "db_utils not available"}
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Simple query to verify database is responding
        cursor.execute("SELECT 1 as healthy")
        result = cursor.fetchone()
        
        cursor.close()
        release_connection(conn)
        
        if result and result[0] == 1:
            return {"status": "healthy"}
        else:
            return {"status": "unhealthy", "error": "unexpected query result"}
            
    except DatabaseError as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error in database health check: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for health check endpoint.
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response with health status
    """
    try:
        logger.info(f"Health check requested: {event.get('httpMethod')} {event.get('path')}")
        
        # Perform health checks
        db_check = check_database()
        
        # Determine overall health status
        overall_status = "healthy"
        if db_check.get("status") != "healthy":
            overall_status = "degraded"
        
        # Build response
        health_data = {
            "status": overall_status,
            "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            "version": VERSION,
            "checks": {
                "database": db_check.get("status")
            }
        }
        
        # Add error details if any checks failed
        if overall_status != "healthy":
            health_data["errors"] = []
            if "error" in db_check:
                health_data["errors"].append({
                    "component": "database",
                    "error": db_check["error"]
                })
        
        # Return appropriate status code
        status_code = 200 if overall_status == "healthy" else 503
        
        response = {
            "statusCode": status_code,
            "headers": {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            },
            "body": json.dumps(health_data)
        }
        
        logger.info(f"Health check result: {overall_status}")
        return response
        
    except Exception as e:
        logger.error(f"Health check handler failed: {str(e)}", exc_info=True)
        
        # Generate a request ID for correlation with logs
        import uuid
        request_id = str(uuid.uuid4())[:8]
        
        return {
            "statusCode": 503,
            "headers": {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            },
            "body": json.dumps({
                "status": "error",
                "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                "error": "Service temporarily unavailable",
                "request_id": f"hc_{request_id}"
            })
        }
