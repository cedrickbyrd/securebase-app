"""
SecureBase Demo Backend - Authentication Lambda
Provides JWT token generation for demo customers
"""

import json
import os
import time
import hmac
import hashlib
import base64
from typing import Dict, Any

# Demo customer credentials (safe for demo environment)
DEMO_CREDENTIALS = {
    "admin@healthcorp.example.com": {
        "password": "demo-healthcare-2026",
        "customer_id": "demo-customer-001",
        "name": "HealthCorp Medical Systems",
        "tier": "healthcare"
    },
    "admin@fintechai.example.com": {
        "password": "demo-fintech-2026",
        "customer_id": "demo-customer-002",
        "name": "FinTechAI Analytics",
        "tier": "fintech"
    },
    "admin@startupmvp.example.com": {
        "password": "demo-standard-2026",
        "customer_id": "demo-customer-003",
        "name": "StartupMVP Inc",
        "tier": "standard"
    },
    "admin@govcontractor.example.com": {
        "password": "demo-government-2026",
        "customer_id": "demo-customer-004",
        "name": "GovContractor Defense Solutions",
        "tier": "government"
    },
    "admin@saasplatform.example.com": {
        "password": "demo-fintech2-2026",
        "customer_id": "demo-customer-005",
        "name": "SaaSPlatform Cloud Services",
        "tier": "fintech"
    }
}


def create_jwt_token(payload: Dict[str, Any], secret: str) -> str:
    """
    Create a simple JWT token (demo implementation)
    Production would use PyJWT library
    """
    # Header
    header = {
        "alg": "HS256",
        "typ": "JWT"
    }
    
    # Encode header and payload
    header_encoded = base64.urlsafe_b64encode(
        json.dumps(header).encode()
    ).decode().rstrip("=")
    
    payload_encoded = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode().rstrip("=")
    
    # Create signature
    message = f"{header_encoded}.{payload_encoded}"
    signature = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256
    ).digest()
    signature_encoded = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    return f"{header_encoded}.{payload_encoded}.{signature_encoded}"


def verify_jwt_token(token: str, secret: str) -> Dict[str, Any]:
    """Verify and decode JWT token"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        header_encoded, payload_encoded, signature_encoded = parts
        
        # Verify signature
        message = f"{header_encoded}.{payload_encoded}"
        expected_signature = hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).digest()
        expected_signature_encoded = base64.urlsafe_b64encode(
            expected_signature
        ).decode().rstrip("=")
        
        if signature_encoded != expected_signature_encoded:
            return None
        
        # Decode payload
        # Add padding if needed
        padding = 4 - (len(payload_encoded) % 4)
        if padding != 4:
            payload_encoded += "=" * padding
        
        payload = json.loads(base64.urlsafe_b64decode(payload_encoded))
        
        # Check expiration
        if payload.get("exp", 0) < time.time():
            return None
        
        return payload
    except Exception:
        return None


def cors_headers():
    """CORS headers for Netlify frontend"""
    return {
        "Access-Control-Allow-Origin": "*",  # In production, use specific domain
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }


def lambda_handler(event, context):
    """Handle authentication requests"""
    print(f"Auth request: {json.dumps(event)}")
    
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": ""
        }
    
    # Get JWT secret from environment
    jwt_secret = os.environ.get("JWT_SECRET", "demo-secret-change-in-production")
    
    try:
        # Parse request body
        body = json.loads(event.get("body", "{}"))
        action = body.get("action", "login")
        
        if action == "login":
            email = body.get("email", "").lower()
            password = body.get("password", "")
            
            # Validate credentials
            if email not in DEMO_CREDENTIALS:
                return {
                    "statusCode": 401,
                    "headers": cors_headers(),
                    "body": json.dumps({"error": "Invalid credentials"})
                }
            
            creds = DEMO_CREDENTIALS[email]
            if password != creds["password"]:
                return {
                    "statusCode": 401,
                    "headers": cors_headers(),
                    "body": json.dumps({"error": "Invalid credentials"})
                }
            
            # Create JWT token
            now = int(time.time())
            payload = {
                "sub": email,
                "customer_id": creds["customer_id"],
                "customer_name": creds["name"],
                "tier": creds["tier"],
                "iat": now,
                "exp": now + (24 * 3600)  # 24 hours
            }
            
            token = create_jwt_token(payload, jwt_secret)
            
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({
                    "token": token,
                    "customer": {
                        "id": creds["customer_id"],
                        "name": creds["name"],
                        "email": email,
                        "tier": creds["tier"]
                    },
                    "expires_in": 86400
                })
            }
        
        elif action == "verify":
            # Verify token
            token = body.get("token", "")
            payload = verify_jwt_token(token, jwt_secret)
            
            if not payload:
                return {
                    "statusCode": 401,
                    "headers": cors_headers(),
                    "body": json.dumps({"error": "Invalid or expired token"})
                }
            
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({
                    "valid": True,
                    "customer_id": payload.get("customer_id"),
                    "email": payload.get("sub")
                })
            }
        
        else:
            return {
                "statusCode": 400,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Invalid action"})
            }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers(),
            "body": json.dumps({"error": "Internal server error"})
        }
