#!/bin/bash
# Update API Gateway CORS for unified authentication

set -e

echo "🌐 Updating API Gateway CORS Configuration"
echo "=========================================="
echo ""

API_ID="9xyetu7zq3"  # securebase-phase2-api
REGION="us-east-1"

# Function to add CORS to a method
add_cors_to_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local RESOURCE_PATH=$3
    
    echo "Updating CORS for $HTTP_METHOD $RESOURCE_PATH..."
    
    # Update method response to include CORS headers
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --status-code 200 \
        --response-parameters "{
            \"method.response.header.Access-Control-Allow-Origin\": true,
            \"method.response.header.Access-Control-Allow-Credentials\": true,
            \"method.response.header.Access-Control-Allow-Headers\": true,
            \"method.response.header.Access-Control-Allow-Methods\": true,
            \"method.response.header.Access-Control-Expose-Headers\": true
        }" \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
    
    # Update integration response to map CORS headers
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --status-code 200 \
        --response-parameters "{
            \"method.response.header.Access-Control-Allow-Origin\": \"'https://securebase.tximhotep.com'\",
            \"method.response.header.Access-Control-Allow-Credentials\": \"'true'\",
            \"method.response.header.Access-Control-Allow-Headers\": \"'Content-Type,Authorization,X-CSRF-Token,Cookie'\",
            \"method.response.header.Access-Control-Allow-Methods\": \"'GET,POST,PUT,DELETE,OPTIONS'\",
            \"method.response.header.Access-Control-Expose-Headers\": \"'Set-Cookie,X-CSRF-Token'\"
        }" \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
}

# Get all resources
echo "Fetching API Gateway resources..."
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)

# Extract auth-related resources
AUTH_RESOURCES=$(echo $RESOURCES | jq -r '.items[] | select(.path | contains("/auth") or contains("/demo-auth") or contains("/validate")) | "\(.id)|\(.path)"')

# Update CORS for each auth resource
while IFS='|' read -r RESOURCE_ID RESOURCE_PATH; do
    if [ -n "$RESOURCE_ID" ]; then
        # Get methods for this resource
        METHODS=$(echo $RESOURCES | jq -r ".items[] | select(.id == \"$RESOURCE_ID\") | .resourceMethods | keys[]" 2>/dev/null || echo "")
        
        for METHOD in $METHODS; do
            if [ "$METHOD" != "OPTIONS" ]; then
                add_cors_to_method "$RESOURCE_ID" "$METHOD" "$RESOURCE_PATH"
            fi
        done
    fi
done <<< "$AUTH_RESOURCES"

# Create OPTIONS method for preflight
echo ""
echo "Adding OPTIONS methods for CORS preflight..."
while IFS='|' read -r RESOURCE_ID RESOURCE_PATH; do
    if [ -n "$RESOURCE_ID" ]; then
        # Check if OPTIONS already exists
        HAS_OPTIONS=$(echo $RESOURCES | jq -r ".items[] | select(.id == \"$RESOURCE_ID\") | .resourceMethods.OPTIONS" 2>/dev/null || echo "null")
        
        if [ "$HAS_OPTIONS" = "null" ]; then
            echo "Adding OPTIONS to $RESOURCE_PATH..."
            
            # Add OPTIONS method
            aws apigateway put-method \
                --rest-api-id $API_ID \
                --resource-id $RESOURCE_ID \
                --http-method OPTIONS \
                --authorization-type NONE \
                --region $REGION \
                --no-cli-pager 2>/dev/null || true
            
            # Add mock integration for OPTIONS
            aws apigateway put-integration \
                --rest-api-id $API_ID \
                --resource-id $RESOURCE_ID \
                --http-method OPTIONS \
                --type MOCK \
                --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
                --region $REGION \
                --no-cli-pager 2>/dev/null || true
            
            # Add OPTIONS method response
            aws apigateway put-method-response \
                --rest-api-id $API_ID \
                --resource-id $RESOURCE_ID \
                --http-method OPTIONS \
                --status-code 200 \
                --response-parameters "{
                    \"method.response.header.Access-Control-Allow-Origin\": true,
                    \"method.response.header.Access-Control-Allow-Credentials\": true,
                    \"method.response.header.Access-Control-Allow-Headers\": true,
                    \"method.response.header.Access-Control-Allow-Methods\": true,
                    \"method.response.header.Access-Control-Max-Age\": true
                }" \
                --region $REGION \
                --no-cli-pager 2>/dev/null || true
            
            # Add OPTIONS integration response
            aws apigateway put-integration-response \
                --rest-api-id $API_ID \
                --resource-id $RESOURCE_ID \
                --http-method OPTIONS \
                --status-code 200 \
                --response-parameters "{
                    \"method.response.header.Access-Control-Allow-Origin\": \"'https://securebase.tximhotep.com'\",
                    \"method.response.header.Access-Control-Allow-Credentials\": \"'true'\",
                    \"method.response.header.Access-Control-Allow-Headers\": \"'Content-Type,Authorization,X-CSRF-Token,Cookie'\",
                    \"method.response.header.Access-Control-Allow-Methods\": \"'GET,POST,PUT,DELETE,OPTIONS'\",
                    \"method.response.header.Access-Control-Max-Age\": \"'7200'\"
                }" \
                --region $REGION \
                --no-cli-pager 2>/dev/null || true
        fi
    fi
done <<< "$AUTH_RESOURCES"

# Deploy the API
echo ""
echo "Deploying API Gateway changes..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "CORS update for unified authentication" \
    --region $REGION \
    --query "id" \
    --output text)

echo "✅ API Gateway deployment created: $DEPLOYMENT_ID"
echo ""
echo "CORS configuration updated for:"
echo "$AUTH_RESOURCES" | while IFS='|' read -r ID PATH; do
    [ -n "$PATH" ] && echo "  - $PATH"
done
echo ""