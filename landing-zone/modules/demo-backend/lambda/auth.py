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
import boto3
from typing import Dict, Any

# Demo customer credentials (safe for demo environment)
DEMO_CREDENTIALS = {
    "admin@healthcorp.example.com": {
        "password": "demo-healthcare-2026",
        "customer_id": "demo-customer-001",
        "name": "HealthCorp Medical Systems",
        "tier": "healthcare",
        "is_enterprise": True
    },
    "admin@fintechai.example.com": {
        "password": "demo-fintech-2026",
        "customer_id": "demo-customer-002",
        "name": "FinTechAI Analytics",
        "tier": "fintech",
        "is_enterprise": True
    },
    "admin@startupmvp.example.com": {
        "password": "demo-standard-2026",
        "customer_id": "demo-customer-003",
        "name": "StartupMVP Inc",
        "tier": "standard",
        "is_enterprise": False
    },
    "admin@govcontractor.example.com": {
        "password": "demo-government-2026",
        "customer_id": "demo-customer-004",
        "name": "GovContractor Defense Solutions",
        "tier": "government",
        "is_enterprise": True
    },
    "admin@saasplatform.example.com": {
        "password": "demo-fintech2-2026",
        "customer_id": "demo-customer-005",
        "name": "SaaSPlatform Cloud Services",
        "tier": "fintech",
        "is_enterprise": True
    }
}

# Lazy KMS client — initialized once per Lambda execution environment
_kms_client = None


def get_kms_client():
    """Return a module-level boto3 KMS client, initializing it on first call."""
    global _kms_client
    if _kms_client is None:
        _kms_client = boto3.client("kms")
    return _kms_client


def _create_jwt_token_hmac(payload: Dict[str, Any], secret: str) -> str:
    """
    HMAC-SHA256 JWT signing (HS256) — internal fallback for local/unit-test
    use when KMS_KEY_ID is not set. Do NOT use in production deployments.
    """
    header = {
        "alg": "HS256",
        "typ": "JWT"
    }

    header_encoded = base64.urlsafe_b64encode(
        json.dumps(header).encode()
    ).decode().rstrip("=")

    payload_encoded = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode().rstrip("=")

    message = f"{header_encoded}.{payload_encoded}"
    signature = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256
    ).digest()
    signature_encoded = base64.urlsafe_b64encode(signature).decode().rstrip("=")

    return f"{header_encoded}.{payload_encoded}.{signature_encoded}"


def _verify_jwt_token_hmac(token: str, secret: str) -> Dict[str, Any]:
    """HMAC-SHA256 JWT verification — internal fallback when KMS_KEY_ID is not set."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_encoded, payload_encoded, signature_encoded = parts

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

        # Add padding if needed
        padding = 4 - (len(payload_encoded) % 4)
        if padding != 4:
            payload_encoded += "=" * padding

        payload = json.loads(base64.urlsafe_b64decode(payload_encoded))

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None


def create_jwt_token_kms(payload: Dict[str, Any], kms_key_id: str) -> str:
    """
    Create a JWT token signed with AWS KMS using RSASSA_PKCS1_V1_5_SHA_256 (RS256).
    The signing key never leaves the KMS HSM.
    """
    header = {
        "alg": "RS256",
        "typ": "JWT"
    }

    header_encoded = base64.urlsafe_b64encode(
        json.dumps(header).encode()
    ).decode().rstrip("=")

    payload_encoded = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode().rstrip("=")

    message = f"{header_encoded}.{payload_encoded}"

    kms = get_kms_client()
    response = kms.sign(
        KeyId=kms_key_id,
        Message=message.encode(),
        MessageType="RAW",
        SigningAlgorithm="RSASSA_PKCS1_V1_5_SHA_256"
    )
    signature_bytes = response["Signature"]
    signature_encoded = base64.urlsafe_b64encode(signature_bytes).decode().rstrip("=")

    return f"{header_encoded}.{payload_encoded}.{signature_encoded}"


def verify_jwt_token_kms(token: str, kms_key_id: str) -> Dict[str, Any]:
    """
    Verify and decode a JWT token whose signature was created by AWS KMS (RS256).
    Returns the decoded payload dict on success, or None on failure.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_encoded, payload_encoded, signature_encoded = parts

        message = f"{header_encoded}.{payload_encoded}"

        # Restore base64url padding before decoding
        padding_needed = 4 - (len(signature_encoded) % 4)
        if padding_needed != 4:
            signature_encoded += "=" * padding_needed
        signature_bytes = base64.urlsafe_b64decode(signature_encoded)

        kms = get_kms_client()
        verify_response = kms.verify(
            KeyId=kms_key_id,
            Message=message.encode(),
            MessageType="RAW",
            Signature=signature_bytes,
            SigningAlgorithm="RSASSA_PKCS1_V1_5_SHA_256"
        )

        if not verify_response.get("SignatureValid", False):
            return None

        # Decode payload
        padding_needed = 4 - (len(payload_encoded) % 4)
        if padding_needed != 4:
            payload_encoded += "=" * padding_needed

        payload = json.loads(base64.urlsafe_b64decode(payload_encoded))

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
    
    # Determine signing mode: KMS (RS256) when KMS_KEY_ID is set, HMAC fallback otherwise
    kms_key_id = os.environ.get("KMS_KEY_ID")
    use_kms = bool(kms_key_id)
    print(f"JWT signing mode: {'KMS (RS256)' if use_kms else 'HMAC fallback (HS256)'}")
    
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
                "isEnterprise": creds["is_enterprise"],
                "iat": now,
                "exp": now + (24 * 3600)  # 24 hours
            }
            
            if use_kms:
                token = create_jwt_token_kms(payload, kms_key_id)
            else:
                token = _create_jwt_token_hmac(
                    payload,
                    os.environ.get("JWT_SECRET", "demo-secret-fallback")
                )
            
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({
                    "token": token,
                    "customer": {
                        "id": creds["customer_id"],
                        "name": creds["name"],
                        "email": email,
                        "tier": creds["tier"],
                        "isEnterprise": creds["is_enterprise"]
                    },
                    "expires_in": 86400
                })
            }
        
        elif action == "verify":
            # Verify token
            token = body.get("token", "")

            if use_kms:
                payload = verify_jwt_token_kms(token, kms_key_id)
            else:
                payload = _verify_jwt_token_hmac(
                    token,
                    os.environ.get("JWT_SECRET", "demo-secret-fallback")
                )
            
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
                    "email": payload.get("sub"),
                    "isEnterprise": payload.get("isEnterprise", False)
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
