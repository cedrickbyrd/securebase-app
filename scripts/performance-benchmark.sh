#!/bin/bash

# Performance Benchmarking Script for Phase 3B
# Tests and measures performance of all Phase 3B components

set -e

echo "================================================"
echo "SecureBase Phase 3B Performance Benchmark"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-https://api.securebase.dev}"
CUSTOMER_ID="${CUSTOMER_ID:-test-customer-id}"
API_KEY="${API_KEY:-test-api-key}"
ITERATIONS=10

# Results storage
RESULTS_FILE="benchmark-results-$(date +%Y%m%d-%H%M%S).json"

echo "Configuration:"
echo "  API Base URL: $API_BASE_URL"
echo "  Iterations: $ITERATIONS"
echo "  Results File: $RESULTS_FILE"
echo ""

# Function to measure endpoint performance
measure_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing $name... "
    
    local total_time=0
    local min_time=999999
    local max_time=0
    local success_count=0
    
    for i in $(seq 1 $ITERATIONS); do
        if [ "$method" = "GET" ]; then
            response_time=$(curl -w '%{time_total}' -s -o /dev/null -f \
                -H "X-API-Key: $API_KEY" \
                "$API_BASE_URL$endpoint" 2>/dev/null)
            curl_exit_code=$?
        else
            response_time=$(curl -w '%{time_total}' -s -o /dev/null -f \
                -X "$method" \
                -H "Content-Type: application/json" \
                -H "X-API-Key: $API_KEY" \
                -d "$data" \
                "$API_BASE_URL$endpoint" 2>/dev/null)
            curl_exit_code=$?
        fi
        
        # Check if curl succeeded and response_time is valid
        if [ $curl_exit_code -eq 0 ] && [ -n "$response_time" ] && [[ "$response_time" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
            # Convert to milliseconds
            time_ms=$(echo "$response_time * 1000" | bc)
            
            # Update statistics
            total_time=$(echo "$total_time + $time_ms" | bc)
            
            if (( $(echo "$time_ms < $min_time" | bc -l) )); then
                min_time=$time_ms
            fi
            
            if (( $(echo "$time_ms > $max_time" | bc -l) )); then
                max_time=$time_ms
            fi
            
            success_count=$((success_count + 1))
        fi
    done
    
    # Calculate average only if we had successful requests
    if [ $success_count -gt 0 ]; then
        avg_time=$(echo "scale=2; $total_time / $success_count" | bc)
        
        # Determine status based on target
        local status="✓"
        local color=$GREEN
        
        if (( $(echo "$avg_time > 500" | bc -l) )); then
            status="⚠"
            color=$YELLOW
        fi
        
        if (( $(echo "$avg_time > 1000" | bc -l) )); then
            status="✗"
            color=$RED
        fi
        
        echo -e "${color}${status} Avg: ${avg_time}ms (Min: ${min_time}ms, Max: ${max_time}ms) [${success_count}/${ITERATIONS} succeeded]${NC}"
        
        # Store results (will be collected and properly formatted at the end)
        echo "${name}|${avg_time}|${min_time}|${max_time}|${ITERATIONS}" >> "$RESULTS_FILE.tmp"
    else
        echo -e "${RED}✗ All requests failed (0/${ITERATIONS} succeeded)${NC}"
        # Store failure result
        echo "${name}|0|0|0|0" >> "$RESULTS_FILE.tmp"
    fi
}

# Initialize results file
rm -f "$RESULTS_FILE.tmp"
touch "$RESULTS_FILE.tmp"

echo "================================================"
echo "Phase 3B Endpoint Performance Tests"
echo "================================================"
echo ""

# Support Tickets Endpoints
echo "Support Ticket System:"
measure_endpoint "List Tickets" "GET" "/support/tickets?limit=50" ""
measure_endpoint "Create Ticket" "POST" "/support/tickets/create" '{"subject":"Test","description":"Benchmark test","priority":"medium"}'
measure_endpoint "Get Ticket Details" "GET" "/support/tickets/test-ticket-id" ""
measure_endpoint "Add Comment" "POST" "/support/tickets/test-ticket-id/comments" '{"text":"Test comment"}'

echo ""

# Notifications Endpoints
echo "Notifications System:"
measure_endpoint "List Notifications" "GET" "/notifications?limit=20" ""
measure_endpoint "Mark as Read" "PUT" "/notifications/test-notification-id/read" ""
measure_endpoint "Mark All Read" "PUT" "/notifications/read-all" ""

echo ""

# Cost Forecasting Endpoints
echo "Cost Forecasting System:"
measure_endpoint "Generate Forecast (3mo)" "GET" "/cost/forecast?months=3" ""
measure_endpoint "Generate Forecast (12mo)" "GET" "/cost/forecast?months=12" ""
measure_endpoint "Get Budget Alerts" "GET" "/cost/budget-alerts" ""

echo ""

# Webhook Endpoints
echo "Webhook System:"
measure_endpoint "List Webhooks" "GET" "/webhooks" ""
measure_endpoint "Create Webhook" "POST" "/webhooks" '{"url":"https://example.com/webhook","events":["ticket_created"]}'

echo ""

# Generate properly formatted JSON from collected results
echo "{" > "$RESULTS_FILE"
echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$RESULTS_FILE"
echo "  \"config\": {" >> "$RESULTS_FILE"
echo "    \"iterations\": $ITERATIONS," >> "$RESULTS_FILE"
echo "    \"api_base_url\": \"$API_BASE_URL\"" >> "$RESULTS_FILE"
echo "  }," >> "$RESULTS_FILE"
echo "  \"results\": {" >> "$RESULTS_FILE"

# Process collected results
first_line=true
while IFS='|' read -r name avg min max iterations; do
    if [ "$first_line" = true ]; then
        first_line=false
    else
        echo "," >> "$RESULTS_FILE"
    fi
    echo -n "    \"$name\": {\"avg\": $avg, \"min\": $min, \"max\": $max, \"iterations\": $iterations}" >> "$RESULTS_FILE"
done < "$RESULTS_FILE.tmp"

echo "" >> "$RESULTS_FILE"
echo "  }" >> "$RESULTS_FILE"
echo "}" >> "$RESULTS_FILE"

rm -f "$RESULTS_FILE.tmp"

echo "================================================"
echo "Performance Benchmarking Complete"
echo "================================================"
echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""

# Frontend Performance Check
if [ -d "phase3a-portal" ]; then
    echo "================================================"
    echo "Frontend Bundle Size Analysis"
    echo "================================================"
    echo ""
    
    cd phase3a-portal
    
    if [ -d "dist" ]; then
        echo "Build artifacts found. Analyzing bundle size..."
        echo ""
        
        # Calculate total size
        total_size=$(du -sh dist | cut -f1)
        echo "Total bundle size: $total_size"
        
        # Show breakdown
        echo ""
        echo "Component breakdown:"
        find dist -name "*.js" -exec du -h {} \; | sort -hr | head -10
        
        echo ""
        
        # Check if gzipped sizes are acceptable
        if command -v gzip &> /dev/null; then
            echo "Gzipped sizes:"
            for file in dist/assets/*.js; do
                if [ -f "$file" ]; then
                    # Portable file size check (works on both Linux and macOS)
                    if stat -c%s "$file" &>/dev/null 2>&1; then
                        original=$(stat -c%s "$file")
                    else
                        original=$(stat -f%z "$file")
                    fi
                    gzipped=$(gzip -c "$file" | wc -c)
                    echo "  $(basename "$file"): $original bytes -> $gzipped bytes ($(echo "scale=1; $gzipped * 100 / $original" | bc)%)"
                fi
            done
        fi
    else
        echo "⚠ No build artifacts found. Run 'npm run build' first."
    fi
    
    cd ..
fi

echo ""
echo "================================================"
echo "Benchmark Summary"
echo "================================================"
echo ""
echo "✓ = Excellent (<500ms)"
echo "⚠ = Acceptable (500-1000ms)"  
echo "✗ = Needs Optimization (>1000ms)"
echo ""
echo "Review detailed results in: $RESULTS_FILE"
