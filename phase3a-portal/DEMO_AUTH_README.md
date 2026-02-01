# Demo Authentication Mode - Phase 3a Portal

This directory contains the demo authentication mock and adapter for running the Phase 3a portal in demonstration mode without a backend.

## Files Added

### 1. `src/mocks/mockAuth.js`
Mock authentication service that accepts demo credentials:
- **Username**: `demo`
- **Password**: `demo`
- Returns a demo token and user data
- Simulates network latency for realistic UX

### 2. `src/services/authAdapter.js`
Authentication adapter that switches between mock and real auth based on the `VITE_USE_MOCK_API` environment variable.

### 3. `netlify.toml`
Netlify deployment configuration that:
- Sets `VITE_USE_MOCK_API=true` in production context
- Configures build settings for the portal
- Adds SPA redirect rules

### 4. `src/components/Login.jsx` (modified)
Updated to support both authentication modes:
- **Demo Mode**: Shows username/password fields
- **Production Mode**: Shows API key field
- Automatically detects mode based on environment variable

### 5. `src/__tests__/DemoAuth.test.jsx`
Comprehensive test suite for demo authentication:
- MockAuthService unit tests
- Login component tests in demo mode
- Credential validation
- Token storage verification

## How to Test Locally

### Option 1: Using Environment Variable (Recommended)
```bash
cd phase3a-portal
export VITE_USE_MOCK_API=true
npm install
npm run dev
```

### Option 2: Using .env File
```bash
cd phase3a-portal
echo "VITE_USE_MOCK_API=true" > .env
npm install
npm run dev
```

Then open http://localhost:3000 and login with:
- **Username**: demo
- **Password**: demo

## Deployment

### Netlify
The included `netlify.toml` automatically sets `VITE_USE_MOCK_API=true` for production deployments.

1. Connect your repository to Netlify
2. Set base directory to `phase3a-portal`
3. Deploy - the demo mode will be active automatically

### Vercel
For Vercel deployments, set the environment variable in the Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add `VITE_USE_MOCK_API` with value `true`
3. Scope to Production (or all environments as needed)

### Other Platforms
Set the environment variable `VITE_USE_MOCK_API=true` in your build/deploy configuration.

## Security Notes

⚠️ **Important**: The demo credentials (`demo/demo`) are:
- **For demonstration purposes only**
- **Do NOT grant access to real backend services**
- **Do NOT expose any sensitive data**
- **Safe to ship in production** (as a demo mode)

The mock authentication service:
- Returns hard-coded demo data
- Does not connect to any real databases
- Does not expose any secrets or API keys
- Is completely isolated from production systems

## Architecture

```
User Login
    ↓
isDemoMode check (VITE_USE_MOCK_API === 'true')
    ↓
    ├─→ Demo Mode
    │   ├─ Show username/password fields
    │   ├─ Use authAdapter → MockAuthService
    │   ├─ Store demo token in sessionStorage
    │   └─ Navigate to dashboard
    │
    └─→ Production Mode
        ├─ Show API key field
        ├─ Use apiService (real backend)
        ├─ Store session token in localStorage
        └─ Navigate to dashboard
```

## Testing

Run the demo authentication tests:
```bash
cd phase3a-portal
npm run test -- DemoAuth.test.jsx
```

Run all tests:
```bash
npm test
```

## Troubleshooting

### Demo mode not activating
- Check that `VITE_USE_MOCK_API=true` is set
- For Vite, env vars must start with `VITE_`
- Restart dev server after changing environment variables

### Build errors with dynamic imports
The auth adapter uses synchronous imports to avoid build issues with top-level await. If you encounter module errors, verify that:
- `src/mocks/mockAuth.js` exports `MockAuthService` class
- The adapter is imported correctly in `Login.jsx`

### Token not persisting
Demo tokens are stored in `sessionStorage` (not `localStorage`) to:
- Automatically clear when browser tab closes
- Prevent confusion with real session tokens
- Make it obvious this is a demo session

## Future Enhancements

When adding a real authentication service:
1. Create `src/services/realAuthService.js`
2. Update the auth adapter to import it conditionally
3. The adapter will automatically use the real service when `VITE_USE_MOCK_API=false`
