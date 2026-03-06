#!/bin/bash
# Phase 5.3 SRE Dashboard Deployment Status Check & Next Steps

set -e

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}===== Phase 5.3 SRE Dashboard Deployment Status =====${NC}"

#############
# 1. Check Terraform infra deployment
#############

echo -ne "Checking Terraform infra (CloudWatch, SNS, API)... "
if [ -d "landing-zone/environments/dev" ] && terraform -chdir=landing-zone/environments/dev state list | grep sre_dashboard >/dev/null 2>&1; then
    echo -e "${GREEN}CloudWatch dashboard found${NC}"
else
    echo -e "${RED}CloudWatch dashboard NOT found${NC}"
    echo "  - Next: Deploy Terraform module for SRE dashboard in landing-zone/environments/dev"
fi

if terraform -chdir=landing-zone/environments/dev state list | grep sns >/dev/null 2>&1; then
    echo -e "${GREEN}SNS topics present${NC}"
else
    echo -e "${RED}SNS topics missing${NC}"
    echo "  - Next: Add/configure SNS alert topics via Terraform"
fi

if terraform -chdir=landing-zone/environments/dev state list | grep lambda.metric_aggregator >/dev/null 2>&1; then
    echo -e "${GREEN}Lambda metric aggregator present${NC}"
else
    echo -e "${RED}Lambda metric aggregator missing${NC}"
    echo "  - Next: Add Lambda function for metric aggregation"
fi

if terraform -chdir=landing-zone/environments/dev state list | grep api_gateway >/dev/null 2>&1; then
    echo -e "${GREEN}API Gateway endpoints configured${NC}"
else
    echo -e "${RED}API Gateway missing${NC}"
    echo "  - Next: Add API Gateway endpoints for dashboard data"
fi

#############
# 2. Lambda packages
#############

echo -ne "Checking packaged Lambda functions... "
if [ -f "phase2-backend/deploy/phase3b/metric_aggregator.zip" ]; then
    echo -e "${GREEN}metric_aggregator.zip exists${NC}"
else
    echo -e "${YELLOW}metric_aggregator.zip NOT found${NC}"
    echo "  - Next: Package metric_aggregator function in phase2-backend/functions/"
fi

#############
# 3. Frontend component
#############

echo -ne "Checking SREDashboard frontend build... "
if [ -d "phase5-3-sre-dashboard/dist" ]; then
    echo -e "${GREEN}Frontend build present${NC}"
else
    echo -e "${RED}Frontend build missing${NC}"
    echo "  - Next: Build dashboard: cd phase5-3-sre-dashboard && npm install && npm run build"
fi

#############
# 4. Integration keys and config
#############

echo -ne "Checking Alert integrations (PagerDuty config, etc)... "
if [ -f "phase5-3-sre-dashboard/config/pagerduty.json" ]; then
    echo -e "${GREEN}PagerDuty config found${NC}"
else
    echo -e "${YELLOW}PagerDuty config missing${NC}"
    echo "  - Next: Add PagerDuty/Opsgenie config to phase5-3-sre-dashboard/config/"
fi

#############
# 5. Documentation
#############

echo -ne "Checking for SRE_RUNBOOK.md... "
if [ -f "SRE_RUNBOOK.md" ]; then
    echo -e "${GREEN}SRE_RUNBOOK.md present${NC}"
else
    echo -e "${YELLOW}SRE_RUNBOOK.md missing${NC}"
    echo "  - Next: Create operations runbook SRE_RUNBOOK.md in project root"
fi

echo -e "\n${YELLOW}===== Status Report Complete =====${NC}"

echo "Review the above for missing items."
echo "Next actions:"
echo " - For any missing infrastructure, update your Terraform definitions and deploy."
echo " - Package any missing Lambda functions."
echo " - Build and deploy the frontend dashboard component."
echo " - Ensure integration config/docs are in place."
echo "Once all items are present and deployed, proceed with functional and load testing per your checklist."
