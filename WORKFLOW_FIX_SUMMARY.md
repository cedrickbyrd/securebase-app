# Deploy Phase 3A Demo Workflow Fix Summary

## Problem
The workflow `.github/workflows/deploy-phase3a-demo.yml` was failing immediately at the Setup Node.js step because:
- Lines 41-42 configured built-in caching with `cache: 'npm'` and `cache-dependency-path: phase3a-portal/package-lock.json`
- The `package-lock.json` file does not exist in the phase3a-portal directory
- The `setup-node@v4` action requires this file to exist when using built-in caching

## Root Cause
Duplicate caching configuration:
1. **Built-in setup-node cache** - Required package-lock.json (FAILED)
2. **Manual cache action** - Uses hashFiles() which gracefully handles missing files (WORKS)

## Solution Applied
Made two minimal changes to fix immediate failure:

### Change 1: Removed built-in cache from setup-node (lines 41-42)
```yaml
# BEFORE
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'
    cache-dependency-path: phase3a-portal/package-lock.json

# AFTER  
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
```

### Change 2: Changed npm ci to npm install (line 53)
```yaml
# BEFORE
- name: Install dependencies
  run: npm ci

# AFTER
- name: Install dependencies
  run: npm install
```

## Why This Works
- Manual cache action (lines 44-52) uses `hashFiles('phase3a-portal/package-lock.json')`
- When file doesn't exist, hashFiles() returns empty string (not an error)
- Cache key becomes `${{ runner.os }}-build-` which is valid
- First workflow run creates package-lock.json via `npm install`
- Subsequent runs cache based on the generated lock file

## Follow-up Recommendation
For deterministic builds, consider:
1. Generate package-lock.json locally: `cd phase3a-portal && npm install`
2. Commit the package-lock.json file to the repository
3. Change back to `npm ci` in the workflow

This ensures identical dependency versions across all builds.

## Status
✅ Workflow will now run successfully (was completely failing before)
⚠️ First run will be uncached (subsequent runs will benefit from caching)
📝 Follow-up: Commit package-lock.json for fully deterministic builds
