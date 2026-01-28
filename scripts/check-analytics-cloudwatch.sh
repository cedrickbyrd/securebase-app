#!/bin/bash
# CloudWatch Monitoring Script for Analytics Lambda Functions
# Phase 4 - Advanced Analytics
# 
# This script checks AWS CloudWatch for errors, invocation issues, and performance metrics
# related to the Analytics Lambda functions post-deployment.

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${ENVIRONMENT:-dev}"
REGION="${AWS_REGION:-us-east-1}"
TIME_WINDOW="${TIME_WINDOW:-3600}" # Default: last hour (in seconds)
VERBOSE="${VERBOSE:-false}"

# Lambda function names
ANALYTICS_QUERY="securebase-${ENVIRONMENT}-analytics-query"
ANALYTICS_AGGREGATOR="securebase-${ENVIRONMENT}-analytics-aggregator"
ANALYTICS_REPORTER="securebase-${ENVIRONMENT}-analytics-reporter"
REPORT_ENGINE="securebase-${ENVIRONMENT}-report-engine"

# Print usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Environment (dev, staging, prod) [default: dev]"
    echo "  -r, --region REGION      AWS region [default: us-east-1]"
    echo "  -t, --time-window SECS   Time window in seconds [default: 3600]"
    echo "  -v, --verbose            Show verbose output"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ENVIRONMENT              Override default environment"
    echo "  AWS_REGION               Override default AWS region"
    echo "  TIME_WINDOW              Override default time window"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Check dev environment, last hour"
    echo "  $0 -e staging -t 7200                 # Check staging, last 2 hours"
    echo "  $0 -e prod -t 86400 -v                # Check prod, last 24 hours, verbose"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -t|--time-window)
            TIME_WINDOW="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Update function names with environment
ANALYTICS_QUERY="securebase-${ENVIRONMENT}-analytics-query"
ANALYTICS_AGGREGATOR="securebase-${ENVIRONMENT}-analytics-aggregator"
ANALYTICS_REPORTER="securebase-${ENVIRONMENT}-analytics-reporter"
REPORT_ENGINE="securebase-${ENVIRONMENT}-report-engine"

# Print header
echo "=========================================="
echo "CloudWatch Analytics Monitoring Report"
echo "=========================================="
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $REGION"
echo -e "${BLUE}Time Window:${NC} $TIME_WINDOW seconds ($(($TIME_WINDOW / 60)) minutes)"
echo -e "${BLUE}Timestamp:${NC} $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=========================================="
echo ""

# Calculate start time (in milliseconds)
START_TIME=$(($(date +%s) - TIME_WINDOW))000
END_TIME=$(date +%s)000

# Function to check if Lambda function exists
check_lambda_exists() {
    local function_name=$1
    if aws lambda get-function --function-name "$function_name" --region "$REGION" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to get CloudWatch metrics for Lambda
get_lambda_metrics() {
    local function_name=$1
    local metric_name=$2
    local stat=$3
    
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name "$metric_name" \
        --dimensions Name=FunctionName,Value="$function_name" \
        --start-time "$(date -u -d @$((START_TIME / 1000)) '+%Y-%m-%dT%H:%M:%S')" \
        --end-time "$(date -u -d @$((END_TIME / 1000)) '+%Y-%m-%dT%H:%M:%S')" \
        --period "$TIME_WINDOW" \
        --statistics "$stat" \
        --region "$REGION" \
        --query "Datapoints[0].$stat" \
        --output text 2>/dev/null || echo "0"
}

# Function to get recent error logs
get_error_logs() {
    local function_name=$1
    local log_group="/aws/lambda/$function_name"
    
    # Check if log group exists
    if ! aws logs describe-log-groups --log-group-name-prefix "$log_group" --region "$REGION" --query "logGroups[?logGroupName=='$log_group']" --output text >/dev/null 2>&1; then
        echo "  No log group found"
        return
    fi
    
    # Get recent error logs
    local errors=$(aws logs filter-log-events \
        --log-group-name "$log_group" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --filter-pattern "ERROR" \
        --region "$REGION" \
        --query "events[*].[timestamp,message]" \
        --output text 2>/dev/null | head -10)
    
    if [ -z "$errors" ] || [ "$errors" == "None" ]; then
        echo -e "  ${GREEN}No errors found${NC}"
    else
        echo -e "  ${RED}Recent errors:${NC}"
        echo "$errors" | while IFS=$'\t' read -r timestamp message; do
            local readable_time=$(date -d "@$((timestamp / 1000))" '+%Y-%m-%d %H:%M:%S')
            echo "    [$readable_time] $(echo "$message" | head -c 100)"
        done
    fi
}

# Function to check Lambda function metrics
check_lambda_function() {
    local function_name=$1
    local display_name=$2
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Function: $display_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check if function exists
    if ! check_lambda_exists "$function_name"; then
        echo -e "  ${YELLOW}⚠ Function not found or not deployed${NC}"
        echo ""
        return
    fi
    
    # Get metrics
    local invocations=$(get_lambda_metrics "$function_name" "Invocations" "Sum")
    local errors=$(get_lambda_metrics "$function_name" "Errors" "Sum")
    local throttles=$(get_lambda_metrics "$function_name" "Throttles" "Sum")
    local duration=$(get_lambda_metrics "$function_name" "Duration" "Average")
    local concurrent=$(get_lambda_metrics "$function_name" "ConcurrentExecutions" "Maximum")
    
    # Convert None to 0
    invocations=${invocations//None/0}
    errors=${errors//None/0}
    throttles=${throttles//None/0}
    duration=${duration//None/0}
    concurrent=${concurrent//None/0}
    
    # Display metrics
    echo "  Invocations: $invocations"
    
    if (( $(echo "$errors > 0" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "  ${RED}✗ Errors: $errors${NC}"
    else
        echo -e "  ${GREEN}✓ Errors: $errors${NC}"
    fi
    
    if (( $(echo "$throttles > 0" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "  ${RED}✗ Throttles: $throttles${NC}"
    else
        echo -e "  ${GREEN}✓ Throttles: $throttles${NC}"
    fi
    
    # Duration in ms
    if (( $(echo "$duration > 0" | bc -l 2>/dev/null || echo 0) )); then
        # Convert to integer for comparison
        duration_int=$(printf "%.0f" "$duration" 2>/dev/null || echo 0)
        if [ "$duration_int" -gt 1000 ]; then
            echo -e "  ${YELLOW}⚠ Avg Duration: ${duration_int}ms (slow)${NC}"
        else
            echo -e "  ${GREEN}✓ Avg Duration: ${duration_int}ms${NC}"
        fi
    else
        echo "  Avg Duration: 0ms (no invocations)"
    fi
    
    echo "  Max Concurrent: $concurrent"
    
    # Get error logs
    echo ""
    echo "  Recent Error Logs:"
    get_error_logs "$function_name"
    
    echo ""
}

# Function to check CloudWatch Alarms
check_alarms() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}CloudWatch Alarms Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Get alarms for analytics
    local alarms=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "securebase-${ENVIRONMENT}-analytics" \
        --region "$REGION" \
        --query "MetricAlarms[*].[AlarmName,StateValue,StateReason]" \
        --output text 2>/dev/null)
    
    if [ -z "$alarms" ] || [ "$alarms" == "None" ]; then
        echo -e "  ${YELLOW}No CloudWatch alarms configured${NC}"
    else
        echo "$alarms" | while IFS=$'\t' read -r alarm_name state reason; do
            if [ "$state" == "ALARM" ]; then
                echo -e "  ${RED}✗ $alarm_name: $state${NC}"
                [ "$VERBOSE" == "true" ] && echo -e "    Reason: $reason"
            elif [ "$state" == "OK" ]; then
                echo -e "  ${GREEN}✓ $alarm_name: $state${NC}"
            else
                echo -e "  ${YELLOW}⚠ $alarm_name: $state${NC}"
            fi
        done
    fi
    echo ""
}

# Function to check DynamoDB metrics
check_dynamodb_metrics() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}DynamoDB Analytics Tables${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local tables=(
        "securebase-${ENVIRONMENT}-metrics"
        "securebase-${ENVIRONMENT}-reports"
        "securebase-${ENVIRONMENT}-report-cache"
        "securebase-${ENVIRONMENT}-report-schedules"
    )
    
    for table in "${tables[@]}"; do
        # Check if table exists
        if aws dynamodb describe-table --table-name "$table" --region "$REGION" >/dev/null 2>&1; then
            # Get user errors (throttling)
            local user_errors=$(aws cloudwatch get-metric-statistics \
                --namespace AWS/DynamoDB \
                --metric-name UserErrors \
                --dimensions Name=TableName,Value="$table" \
                --start-time "$(date -u -d @$((START_TIME / 1000)) '+%Y-%m-%dT%H:%M:%S')" \
                --end-time "$(date -u -d @$((END_TIME / 1000)) '+%Y-%m-%dT%H:%M:%S')" \
                --period "$TIME_WINDOW" \
                --statistics Sum \
                --region "$REGION" \
                --query "Datapoints[0].Sum" \
                --output text 2>/dev/null || echo "0")
            
            user_errors=${user_errors//None/0}
            
            if (( $(echo "$user_errors > 0" | bc -l 2>/dev/null || echo 0) )); then
                echo -e "  ${RED}✗ $table: ${user_errors} throttling events${NC}"
            else
                echo -e "  ${GREEN}✓ $table: No throttling${NC}"
            fi
        else
            echo -e "  ${YELLOW}⚠ $table: Not found${NC}"
        fi
    done
    echo ""
}

# Function to get API Gateway metrics
check_api_gateway() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}API Gateway Analytics Endpoints${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local api_name="securebase-${ENVIRONMENT}-api"
    
    # Check if API exists
    local api_id=$(aws apigateway get-rest-apis \
        --region "$REGION" \
        --query "items[?name=='$api_name'].id" \
        --output text 2>/dev/null)
    
    if [ -z "$api_id" ] || [ "$api_id" == "None" ]; then
        echo -e "  ${YELLOW}⚠ API Gateway not found or not configured${NC}"
        echo ""
        return
    fi
    
    # Get API Gateway metrics
    local count=$(get_api_metric "$api_name" "Count" "Sum")
    local errors_4xx=$(get_api_metric "$api_name" "4XXError" "Sum")
    local errors_5xx=$(get_api_metric "$api_name" "5XXError" "Sum")
    local latency=$(get_api_metric "$api_name" "Latency" "Average")
    
    count=${count//None/0}
    errors_4xx=${errors_4xx//None/0}
    errors_5xx=${errors_5xx//None/0}
    latency=${latency//None/0}
    
    echo "  Total Requests: $count"
    echo "  4XX Errors: $errors_4xx"
    
    if (( $(echo "$errors_5xx > 0" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "  ${RED}✗ 5XX Errors: $errors_5xx${NC}"
    else
        echo -e "  ${GREEN}✓ 5XX Errors: $errors_5xx${NC}"
    fi
    
    if (( $(echo "$latency > 0" | bc -l 2>/dev/null || echo 0) )); then
        latency_int=$(printf "%.0f" "$latency" 2>/dev/null || echo 0)
        if [ "$latency_int" -gt 500 ]; then
            echo -e "  ${YELLOW}⚠ Avg Latency: ${latency_int}ms (slow)${NC}"
        else
            echo -e "  ${GREEN}✓ Avg Latency: ${latency_int}ms${NC}"
        fi
    else
        echo "  Avg Latency: 0ms (no requests)"
    fi
    
    echo ""
}

# Helper function for API Gateway metrics
get_api_metric() {
    local api_name=$1
    local metric_name=$2
    local stat=$3
    
    aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name "$metric_name" \
        --dimensions Name=ApiName,Value="$api_name" \
        --start-time "$(date -u -d @$((START_TIME / 1000)) '+%Y-%m-%dT%H:%M:%S')" \
        --end-time "$(date -u -d @$((END_TIME / 1000)) '+%Y-%m-%dT%H:%M:%S')" \
        --period "$TIME_WINDOW" \
        --statistics "$stat" \
        --region "$REGION" \
        --query "Datapoints[0].$stat" \
        --output text 2>/dev/null || echo "0"
}

# Function to display summary
display_summary() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Summary${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Count total errors across all functions
    local total_errors=0
    for func in "$ANALYTICS_QUERY" "$ANALYTICS_AGGREGATOR" "$ANALYTICS_REPORTER" "$REPORT_ENGINE"; do
        if check_lambda_exists "$func"; then
            local func_errors=$(get_lambda_metrics "$func" "Errors" "Sum")
            func_errors=${func_errors//None/0}
            total_errors=$(echo "$total_errors + $func_errors" | bc 2>/dev/null || echo 0)
        fi
    done
    
    if (( $(echo "$total_errors > 0" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "  ${RED}✗ Issues detected: $total_errors total errors${NC}"
        echo -e "  ${YELLOW}⚠ Action required: Review error logs above${NC}"
    else
        echo -e "  ${GREEN}✓ All systems operational${NC}"
        echo -e "  ${GREEN}✓ No errors or throttling detected${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Review error logs for any issues"
    echo "  2. Check CloudWatch dashboard: https://console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=securebase-${ENVIRONMENT}-analytics"
    echo "  3. View detailed logs: https://console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups"
    echo ""
}

# Main execution
main() {
    # Check AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI is not installed${NC}"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
        echo -e "${RED}Error: AWS credentials not configured or invalid${NC}"
        exit 1
    fi
    
    # Check Lambda functions
    check_lambda_function "$ANALYTICS_QUERY" "Analytics Query API"
    check_lambda_function "$ANALYTICS_AGGREGATOR" "Analytics Aggregator (Hourly)"
    check_lambda_function "$ANALYTICS_REPORTER" "Analytics Reporter"
    check_lambda_function "$REPORT_ENGINE" "Report Engine (Legacy)"
    
    # Check DynamoDB
    check_dynamodb_metrics
    
    # Check API Gateway
    check_api_gateway
    
    # Check CloudWatch Alarms
    check_alarms
    
    # Display summary
    display_summary
}

# Run main
main
