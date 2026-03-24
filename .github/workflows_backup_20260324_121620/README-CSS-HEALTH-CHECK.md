# CSS Health Check Workflow

## Overview

The CSS Health Check workflow (`css-health-check.yml`) systematically validates the CSS rendering pipeline for both the root project and phase3a-portal to ensure CSS is properly configured, built, and deployed.

## Triggers

The workflow runs automatically when:

- **Push/PR to branches**: `main` or `develop`
- **File changes in**:
  - Any CSS files (`**/*.css`)
  - Any SCSS files (`**/*.scss`)
  - Tailwind config files (`**/tailwind.config.js`)
  - PostCSS config files (`**/postcss.config.js`)
  - Package.json files (`**/package.json`)
  - The workflow file itself (`.github/workflows/css-health-check.yml`)
- **Manual trigger**: Via GitHub Actions UI (workflow_dispatch)

## Projects Tested

The workflow uses a test matrix to validate both:

1. **Root Project** (path: `.`)
   - Marketing/landing page
   - Uses Tailwind CSS 4.x
   - Vite build system

2. **Phase3A Portal** (path: `phase3a-portal`)
   - Customer portal dashboard
   - Uses Tailwind CSS 4.x with custom color palette
   - Vite build system

## 9 Validation Checkpoints

### Checkpoint 1: Verify CSS Source Files Exist
- Checks for `src/index.css` and `src/App.css`
- Ensures CSS source files are present before building

### Checkpoint 2: Verify Tailwind Config Exists and Display Contents
- Confirms `tailwind.config.js` exists
- Displays full configuration in workflow summary
- Validates Tailwind is properly configured

### Checkpoint 3: Verify PostCSS Config Exists and Display Contents
- Confirms `postcss.config.js` exists
- Displays full configuration in workflow summary
- Validates PostCSS processing is configured

### Checkpoint 4: Verify CSS Dependencies Installed
- Checks that `tailwindcss` is installed
- Checks that `postcss` is installed
- Checks that `autoprefixer` is installed
- Reports version numbers for each dependency

### Checkpoint 5: Verify CSS Is Imported in Entry Files
- Confirms `src/main.jsx` imports `index.css`
- Ensures CSS will be included in the build

### Checkpoint 6: Build the Project Successfully
- Runs `npm run build`
- Verifies the build process completes without errors
- Critical gate before further validation

### Checkpoint 7: Verify CSS Files Exist in Build Output
- Checks `dist/assets/` directory for CSS files
- Reports count and size of generated CSS files
- Ensures CSS was actually generated during build

### Checkpoint 8: Verify Tailwind Utilities Are Processed
- Scans generated CSS for Tailwind patterns
- Looks for base/reset styles, utility classes, and CSS custom properties
- Confirms Tailwind processing occurred

### Checkpoint 9: Verify HTML References CSS Files
- Checks `dist/index.html` for CSS link tags
- Displays CSS references found
- Ensures the HTML will load the CSS

## Artifacts

The workflow uploads build artifacts with 7-day retention:

- **Artifacts included**:
  - All CSS files from `dist/assets/*.css`
  - The built `dist/index.html`

- **Artifact naming**: `css-health-check-{ProjectName}-{CommitSHA}`

## Summary Report

The workflow generates a detailed summary in the GitHub Actions UI showing:

- Status of each checkpoint (✅ Pass / ❌ Fail / ⚠️ Warning)
- Configuration file contents
- CSS file sizes and counts
- Tailwind processing verification
- HTML CSS references

## Failure Scenarios

The workflow will fail if:

1. Required CSS source files are missing
2. Tailwind or PostCSS config files are missing
3. Required CSS dependencies are not installed
4. CSS is not imported in entry files
5. Build process fails
6. No CSS files are generated in dist/assets/
7. HTML doesn't reference any CSS files

## Permissions

- **Read-only**: `contents: read`
- Minimal permissions for security

## Node.js Version

- **Version**: Node.js 20
- **Cache**: npm dependencies cached between runs

## Timeout

- **Timeout**: 10 minutes per project
- Prevents hung workflows

## Debugging Failed Checkpoints

If a checkpoint fails:

1. **Review the workflow summary** - Each checkpoint logs detailed output
2. **Check the artifact** - Download build artifacts to inspect generated files
3. **Look for missing files** - Ensure all source files exist
4. **Verify dependencies** - Check package.json has all required CSS dependencies
5. **Review build logs** - Checkpoint 6 will show build errors

## Example Output

```
## Checkpoint 1: Verify CSS Source Files
✅ src/index.css exists
✅ src/App.css exists

## Checkpoint 2: Verify Tailwind Config
✅ tailwind.config.js exists

### Tailwind Config Contents:
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  ...
}
```

## Checkpoint 7: Verify CSS Files in Build Output
✅ Found 1 CSS file(s) in dist/assets/

### CSS Files:
- index-abc123.css (12.5K)
```

## Integration with Other Workflows

This workflow complements:

- **securebase-frontend-pipeline.yml** - Full frontend CI/CD
- **deploy-phase3a-staging.yml** - Phase3A deployment
- **securebase-pr-checks.yml** - PR quality gates

## Maintenance

- **Location**: `.github/workflows/css-health-check.yml`
- **Owner**: SecureBase Platform Team
- **Update frequency**: As needed when CSS pipeline changes
