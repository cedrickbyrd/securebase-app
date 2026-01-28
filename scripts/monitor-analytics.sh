#!/bin/bash
# Monitor Analytics Lambda Functions - CloudWatch Logs and Metrics
# Provides real-time monitoring of deployed Analytics Lambda infrastructure
#
# Usage:
#   ./scripts/monitor-analytics.sh [ENVIRONMENT] [OPERATION]
#
# ENVIRONMENT: dev, staging, prod (default: dev)
# OPERATION: logs, metrics, alarms, dashboard, all (default: all)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
OPERATION=${2:-all}
AWS_REGION=${AWS_REGION:-us-east-1}

# Lambda function names
ANALYTICS_AGGREGATOR="securebase-${ENVIRONMENT}-analytics-aggregator"
ANALYTICS_REPORTER="securebase-${ENVIRONMENT}-analytics-reporter"
ANALYTICS_QUERY="securebase-${ENVIRONMENT}-analytics-query"
REPORT_ENGINE="securebase-${ENVIRONMENT}-report-engine"

# Log groups
LOG_GROUP_AGGREGATOR="/aws/lambda/${ANALYTICS_AGGREGATOR}"
LOG_GROUP_REPORTER="/aws/lambda/${ANALYTICS_REPORTER}"
LOG_GROUP_QUERY="/aws/lambda/${ANALYTICS_QUERY}"
LOG_GROUP_ENGINE="/aws/lambda/${REPORT_ENGINE}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Analytics Lambda - CloudWatch Monitoring            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $AWS_REGION"
echo -e "${BLUE}Operation:${NC} $OPERATION"
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}✗ AWS credentials not configured${NC}"
    echo "Please configure AWS credentials with:"
    echo "  aws configure"
    exit 1
fi

#######################################
# Function: Get recent Lambda logs
#######################################
get_lambda_logs() {
    local function_name=$1
    local log_group=$2
    
    echo -e "${CYAN}━━━ Logs: ${function_name} ━━━${NC}"
    
    # Check if log group exists
    if ! aws logs describe-log-groups \
        --log-group-name-prefix "$log_group" \
        --region "$AWS_REGION" \
        --query 'logGroups[0].logGroupName' \
        --output text 2>/dev/null | grep -q "$log_group"; then
        echo -e "${YELLOW}⚠ Log group not found: ${log_group}${NC}"
        echo "  Lambda may not have been invoked yet"
        echo ""
        return
    fi
    
    # Get most recent log stream
    LATEST_STREAM=$(aws logs describe-log-streams \
        --log-group-name "$log_group" \
        --order-by LastEventTime \
        --descending \
        --max-items 1 \
        --region "$AWS_REGION" \
        --query 'logStreams[0].logStreamName' \
        --output text 2>/dev/null)
    
    if [ -z "$LATEST_STREAM" ] || [ "$LATEST_STREAM" = "None" ]; then
        echo -e "${YELLOW}⚠ No log streams found${NC}"
        echo "  Lambda has not been invoked"
        echo ""
        return
    fi
    
    echo -e "${GREEN}✓ Latest stream:${NC} $LATEST_STREAM"
    
    # Get last 20 log events
    echo ""
    echo -e "${BLUE}Recent log entries (last 20):${NC}"
    aws logs get-log-events \
        --log-group-name "$log_group" \
        --log-stream-name "$LATEST_STREAM" \
        --limit 20 \
        --region "$AWS_REGION" \
        --query 'events[].message' \
        --output text 2>/dev/null || echo -e "${YELLOW}  No events found${NC}"
    
    echo ""
    
    # Count errors in last hour
    START_TIME=$(($(date +%s) - 3600))000  # Last hour in milliseconds
    ERROR_COUNT=$(aws logs filter-log-events \
        --log-group-name "$log_group" \
        --start-time "$START_TIME" \
        --filter-pattern "ERROR" \
        --region "$AWS_REGION" \
        --query 'length(events)' \
        --output text 2>/dev/null || echo "0")
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "${RED}⚠ Errors in last hour: ${ERROR_COUNT}${NC}"
        echo -e "${BLUE}Recent errors:${NC}"
        aws logs filter-log-events \
            --log-group-name "$log_group" \
            --start-time "$START_TIME" \
            --filter-pattern "ERROR" \
            --region "$AWS_REGION" \
            --query 'events[0:5].message' \
            --output text 2>/dev/null
    else
        echo -e "${GREEN}✓ No errors in last hour${NC}"
    fi
    
    echo ""
}

#######################################
# Function: Get Lambda metrics
#######################################
get_lambda_metrics() {
    local function_name=$1
    
    echo -e "${CYAN}━━━ Metrics: ${function_name} ━━━${NC}"
    
    # Check if Lambda exists
    if ! aws lambda get-function \
        --function-name "$function_name" \
        --region "$AWS_REGION" &>/dev/null; then
        echo -e "${YELLOW}⚠ Lambda function not found: ${function_name}${NC}"
        echo ""
        return
    fi
    
    # Calculate time range (last hour)
    END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
    START_TIME=$(date -u -d '1 hour ago' +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -v-1H +"%Y-%m-%dT%H:%M:%S")
    
    # Get invocation count
    INVOCATIONS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value="$function_name" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 3600 \
        --statistics Sum \
        --region "$AWS_REGION" \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    [ "$INVOCATIONS" = "None" ] && INVOCATIONS=0
    
    # Get error count
    ERRORS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value="$function_name" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 3600 \
        --statistics Sum \
        --region "$AWS_REGION" \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    [ "$ERRORS" = "None" ] && ERRORS=0
    
    # Get throttles
    THROTTLES=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Throttles \
        --dimensions Name=FunctionName,Value="$function_name" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 3600 \
        --statistics Sum \
        --region "$AWS_REGION" \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    [ "$THROTTLES" = "None" ] && THROTTLES=0
    
    # Get average duration
    DURATION=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Duration \
        --dimensions Name=FunctionName,Value="$function_name" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 3600 \
        --statistics Average \
        --region "$AWS_REGION" \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "0")
    
    [ "$DURATION" = "None" ] && DURATION=0
    
    # Display metrics
    echo -e "${BLUE}Time range:${NC} Last 1 hour"
    echo -e "${BLUE}Invocations:${NC} ${INVOCATIONS}"
    
    if [ "$(echo "$ERRORS > 0" | bc 2>/dev/null || [ "$ERRORS" -gt 0 ] && echo 1 || echo 0)" = "1" ]; then
        echo -e "${RED}Errors:${NC} ${ERRORS}"
    else
        echo -e "${GREEN}Errors:${NC} ${ERRORS}"
    fi
    
    if [ "$(echo "$THROTTLES > 0" | bc 2>/dev/null || [ "$THROTTLES" -gt 0 ] && echo 1 || echo 0)" = "1" ]; then
        echo -e "${RED}Throttles:${NC} ${THROTTLES}"
    else
        echo -e "${GREEN}Throttles:${NC} ${THROTTLES}"
    fi
    
    echo -e "${BLUE}Avg Duration:${NC} ${DURATION} ms"
    
    # Health assessment
    if [ "$(echo "$INVOCATIONS > 0" | bc 2>/dev/null || [ "$INVOCATIONS" -gt 0 ] && echo 1 || echo 0)" = "1" ]; then
        ERROR_RATE=$(echo "scale=2; ($ERRORS / $INVOCATIONS) * 100" | bc 2>/dev/null || echo "0")
        echo -e "${BLUE}Error Rate:${NC} ${ERROR_RATE}%"
        
        if [ "$(echo "$ERROR_RATE > 5" | bc 2>/dev/null || echo 0)" = "1" ]; then
            echo -e "${RED}⚠ Health: DEGRADED (High error rate)${NC}"
        elif [ "$(echo "$THROTTLES > 0" | bc 2>/dev/null || [ "$THROTTLES" -gt 0 ] && echo 1 || echo 0)" = "1" ]; then
            echo -e "${YELLOW}⚠ Health: WARNING (Throttling detected)${NC}"
        else
            echo -e "${GREEN}✓ Health: HEALTHY${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Health: NO DATA (No invocations in last hour)${NC}"
    fi
    
    echo ""
}

#######################################
# Function: Check CloudWatch alarms
#######################################
check_alarms() {
    echo -e "${CYAN}━━━ CloudWatch Alarms Status ━━━${NC}"
    
    # Get all alarms for this environment
    ALARMS=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "securebase-${ENVIRONMENT}-analytics" \
        --region "$AWS_REGION" \
        --query 'MetricAlarms[*].[AlarmName,StateValue,StateReason]' \
        --output text 2>/dev/null)
    
    if [ -z "$ALARMS" ]; then
        echo -e "${YELLOW}⚠ No alarms found for environment: ${ENVIRONMENT}${NC}"
        echo ""
        return
    fi
    
    # Count alarms by state
    ALARM_COUNT=0
    OK_COUNT=0
    INSUFFICIENT_COUNT=0
    
    while IFS=$'\t' read -r name state reason; do
        ALARM_COUNT=$((ALARM_COUNT + 1))
        
        case "$state" in
            "OK")
                echo -e "${GREEN}✓${NC} ${name}: ${state}"
                OK_COUNT=$((OK_COUNT + 1))
                ;;
            "ALARM")
                echo -e "${RED}✗${NC} ${name}: ${state}"
                echo -e "  ${YELLOW}Reason: ${reason}${NC}"
                ;;
            "INSUFFICIENT_DATA")
                echo -e "${YELLOW}⚠${NC} ${name}: ${state}"
                INSUFFICIENT_COUNT=$((INSUFFICIENT_COUNT + 1))
                ;;
        esac
    done <<< "$ALARMS"
    
    echo ""
    echo -e "${BLUE}Summary:${NC}"
    echo -e "  Total alarms: ${ALARM_COUNT}"
    echo -e "  ${GREEN}OK: ${OK_COUNT}${NC}"
    echo -e "  ${YELLOW}Insufficient data: ${INSUFFICIENT_COUNT}${NC}"
    echo -e "  ${RED}Alarming: $((ALARM_COUNT - OK_COUNT - INSUFFICIENT_COUNT))${NC}"
    echo ""
}

#######################################
# Function: Show dashboard info
#######################################
show_dashboard() {
    echo -e "${CYAN}━━━ CloudWatch Dashboard ━━━${NC}"
    
    DASHBOARD_NAME="securebase-${ENVIRONMENT}-analytics"
    
    # Check if dashboard exists
    if aws cloudwatch get-dashboard \
        --dashboard-name "$DASHBOARD_NAME" \
        --region "$AWS_REGION" &>/dev/null; then
        echo -e "${GREEN}✓ Dashboard exists:${NC} ${DASHBOARD_NAME}"
        echo ""
        echo -e "${BLUE}View dashboard:${NC}"
        echo "  https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=${DASHBOARD_NAME}"
        echo ""
    else
        echo -e "${YELLOW}⚠ Dashboard not found:${NC} ${DASHBOARD_NAME}"
        echo "  Run Terraform to create the dashboard"
        echo ""
    fi
}

#######################################
# Main execution
#######################################

case "$OPERATION" in
    "logs")
        get_lambda_logs "$ANALYTICS_AGGREGATOR" "$LOG_GROUP_AGGREGATOR"
        get_lambda_logs "$ANALYTICS_REPORTER" "$LOG_GROUP_REPORTER"
        get_lambda_logs "$ANALYTICS_QUERY" "$LOG_GROUP_QUERY"
        get_lambda_logs "$REPORT_ENGINE" "$LOG_GROUP_ENGINE"
        ;;
    
    "metrics")
        get_lambda_metrics "$ANALYTICS_AGGREGATOR"
        get_lambda_metrics "$ANALYTICS_REPORTER"
        get_lambda_metrics "$ANALYTICS_QUERY"
        get_lambda_metrics "$REPORT_ENGINE"
        ;;
    
    "alarms")
        check_alarms
        ;;
    
    "dashboard")
        show_dashboard
        ;;
    
    "all")
        # Metrics first (compact view)
        echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}         LAMBDA FUNCTION METRICS (Last Hour)        ${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
        echo ""
        get_lambda_metrics "$ANALYTICS_AGGREGATOR"
        get_lambda_metrics "$ANALYTICS_REPORTER"
        get_lambda_metrics "$ANALYTICS_QUERY"
        get_lambda_metrics "$REPORT_ENGINE"
        
        # Alarms
        echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}              CLOUDWATCH ALARMS STATUS              ${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
        echo ""
        check_alarms
        
        # Dashboard
        show_dashboard
        
        # Quick log summary
        echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}           RECENT ERRORS (Last Hour)                ${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
        echo ""
        
        for func in "$ANALYTICS_AGGREGATOR" "$ANALYTICS_REPORTER" "$ANALYTICS_QUERY" "$REPORT_ENGINE"; do
            LOG_GROUP="/aws/lambda/$func"
            if aws logs describe-log-groups \
                --log-group-name-prefix "$LOG_GROUP" \
                --region "$AWS_REGION" \
                --query 'logGroups[0].logGroupName' \
                --output text 2>/dev/null | grep -q "$LOG_GROUP"; then
                
                START_TIME=$(($(date +%s) - 3600))000
                ERROR_COUNT=$(aws logs filter-log-events \
                    --log-group-name "$LOG_GROUP" \
                    --start-time "$START_TIME" \
                    --filter-pattern "ERROR" \
                    --region "$AWS_REGION" \
                    --query 'length(events)' \
                    --output text 2>/dev/null || echo "0")
                
                if [ "$ERROR_COUNT" -gt 0 ]; then
                    echo -e "${RED}✗ ${func}: ${ERROR_COUNT} errors${NC}"
                else
                    echo -e "${GREEN}✓ ${func}: No errors${NC}"
                fi
            fi
        done
        echo ""
        
        # Final summary
        echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}✓ Monitoring check complete${NC}"
        echo ""
        echo -e "${BLUE}For detailed logs, run:${NC}"
        echo "  $0 $ENVIRONMENT logs"
        echo ""
        ;;
    
    *)
        echo -e "${RED}Invalid operation: $OPERATION${NC}"
        echo ""
        echo "Usage: $0 [ENVIRONMENT] [OPERATION]"
        echo ""
        echo "ENVIRONMENT: dev, staging, prod (default: dev)"
        echo "OPERATION:"
        echo "  logs      - Show recent CloudWatch logs"
        echo "  metrics   - Show Lambda function metrics"
        echo "  alarms    - Check CloudWatch alarm status"
        echo "  dashboard - Show dashboard URL"
        echo "  all       - Show all monitoring data (default)"
        echo ""
        exit 1
        ;;
esac

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Monitoring complete for environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
