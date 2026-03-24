#!/bin/bash

# Script to identify and remove manual approval steps from GitHub Actions workflows
# Repository: cedrickbyrd/securebase-app

set -e

WORKFLOWS_DIR=".github/workflows"
BACKUP_DIR=".github/workflows_backup_$(date +%Y%m%d_%H%M%S)"

echo "=========================================="
echo "GitHub Actions Approval Removal Tool"
echo "=========================================="
echo ""

# Check if running from repo root
if [ ! -d "$WORKFLOWS_DIR" ]; then
    echo "❌ Error: $WORKFLOWS_DIR not found."
    echo "Please run this script from the repository root directory."
    exit 1
fi

echo "✅ Found workflows directory: $WORKFLOWS_DIR"
echo ""

# Create backup
echo "📦 Creating backup of workflows..."
mkdir -p "$BACKUP_DIR"
cp -r "$WORKFLOWS_DIR"/* "$BACKUP_DIR/"
echo "✅ Backup created at: $BACKUP_DIR"
echo ""

# Function to display findings
display_findings() {
    echo "=========================================="
    echo "DIAGNOSTIC REPORT"
    echo "=========================================="
    echo ""
    
    echo "1️⃣  ENVIRONMENT-BASED APPROVALS"
    echo "   (These require manual approval if configured in GitHub UI)"
    echo "   ────────────────────────────────────────"
    ENV_COUNT=$(grep -l "environment:" "$WORKFLOWS_DIR"/*.yml 2>/dev/null | wc -l || echo 0)
    if [ "$ENV_COUNT" -gt 0 ]; then
        grep -n "environment:" "$WORKFLOWS_DIR"/*.yml 2>/dev/null | while IFS=: read -r file line content; do
            echo "   📄 $(basename $file):$line → $content"
        done
    else
        echo "   ✅ None found"
    fi
    echo ""
    
    echo "2️⃣  MANUAL APPROVAL ACTIONS"
    echo "   (Actions like 'trstringer/manual-approval')"
    echo "   ────────────────────────────────────────"
    MANUAL_COUNT=$(grep -il "manual.*approval\|trstringer" "$WORKFLOWS_DIR"/*.yml 2>/dev/null | wc -l || echo 0)
    if [ "$MANUAL_COUNT" -gt 0 ]; then
        grep -in "manual.*approval\|trstringer" "$WORKFLOWS_DIR"/*.yml 2>/dev/null | while IFS=: read -r file line content; do
            echo "   📄 $(basename $file):$line → $content"
        done
    else
        echo "   ✅ None found"
    fi
    echo ""
    
    echo "3️⃣  WORKFLOW_DISPATCH ONLY (Manual Trigger)"
    echo "   (Workflows that ONLY run when manually triggered)"
    echo "   ────────────────────────────────────────"
    for workflow in "$WORKFLOWS_DIR"/*.yml; do
        if grep -q "^on:" "$workflow" && grep -A 1 "^on:" "$workflow" | grep -q "workflow_dispatch" && ! grep -A 5 "^on:" "$workflow" | grep -qE "push:|pull_request:|schedule:"; then
            echo "   📄 $(basename $workflow) - Manual trigger ONLY"
        fi
    done
    echo ""
    
    echo "4️⃣  WORKFLOW FILES SUMMARY"
    echo "   ────────────────────────────────────────"
    echo "   Total workflow files: $(ls "$WORKFLOWS_DIR"/*.yml 2>/dev/null | wc -l)"
    echo ""
}

# Function to fix environment approvals
fix_environments() {
    echo "=========================================="
    echo "FIXING ENVIRONMENT APPROVALS"
    echo "=========================================="
    echo ""
    echo "ℹ️  This will comment out 'environment:' lines in workflows."
    echo "   Note: You may also need to disable required reviewers in GitHub UI:"
    echo "   Settings → Environments → [environment name] → Required reviewers"
    echo ""
    
    FILES_WITH_ENV=$(grep -l "environment:" "$WORKFLOWS_DIR"/*.yml 2>/dev/null || echo "")
    
    if [ -z "$FILES_WITH_ENV" ]; then
        echo "✅ No environment-based approvals found"
        return
    fi
    
    for file in $FILES_WITH_ENV; do
        echo "🔧 Processing: $(basename $file)"
        # Comment out environment lines (but not in comments already)
        sed -i.bak 's/^\(\s*\)environment:\(.*\)$/\1# environment:\2  # REMOVED: Auto-approval enabled/' "$file"
        rm -f "${file}.bak"
        echo "   ✅ Commented out environment approval"
    done
    echo ""
}

# Function to fix manual approval actions
fix_manual_actions() {
    echo "=========================================="
    echo "FIXING MANUAL APPROVAL ACTIONS"
    echo "=========================================="
    echo ""
    
    FILES_WITH_MANUAL=$(grep -il "manual.*approval\|trstringer" "$WORKFLOWS_DIR"/*.yml 2>/dev/null || echo "")
    
    if [ -z "$FILES_WITH_MANUAL" ]; then
        echo "✅ No manual approval actions found"
        return
    fi
    
    for file in $FILES_WITH_MANUAL; do
        echo "🔧 Processing: $(basename $file)"
        echo "⚠️  Manual review required - please edit this file manually to remove approval steps"
        echo "   File: $file"
    done
    echo ""
}

# Function to add automatic triggers
add_auto_triggers() {
    echo "=========================================="
    echo "ADDING AUTOMATIC TRIGGERS"
    echo "=========================================="
    echo ""
    echo "ℹ️  This will add 'push' triggers to workflow_dispatch-only workflows"
    echo ""
    
    for workflow in "$WORKFLOWS_DIR"/*.yml; do
        if grep -q "^on:" "$workflow" && grep -A 1 "^on:" "$workflow" | grep -q "workflow_dispatch" && ! grep -A 5 "^on:" "$workflow" | grep -qE "push:|pull_request:|schedule:"; then
            echo "🔧 Processing: $(basename $workflow)"
            # This is complex - we'll just notify for manual addition
            echo "   ⚠️  Currently only has workflow_dispatch trigger"
            echo "   📝 Consider adding automatic triggers like:"
            echo "      on:"
            echo "        push:"
            echo "          branches: [main]"
            echo "        workflow_dispatch:"
        fi
    done
    echo ""
}

# Main execution
display_findings

echo "=========================================="
echo "RECOMMENDED ACTIONS"
echo "=========================================="
echo ""
echo "Do you want to automatically fix environment approvals? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    fix_environments
    fix_manual_actions
    
    echo "=========================================="
    echo "✅ FIXES APPLIED"
    echo "=========================================="
    echo ""
    echo "📋 Next steps:"
    echo ""
    echo "1. Review the changes:"
    echo "   git diff .github/workflows/"
    echo ""
    echo "2. If you have environment protection rules in GitHub:"
    echo "   - Go to: Settings → Environments"
    echo "   - For each environment, remove required reviewers"
    echo ""
    echo "3. Commit and push the changes:"
    echo "   git add .github/workflows/"
    echo "   git commit -m 'Remove manual approval steps from workflows'"
    echo "   git push"
    echo ""
    echo "4. Your backup is saved at: $BACKUP_DIR"
    echo "   (Delete this after verifying everything works)"
    echo ""
else
    echo "❌ No changes made. Backup is still available at: $BACKUP_DIR"
fi

echo ""
echo "=========================================="
echo "DONE"
echo "=========================================="
