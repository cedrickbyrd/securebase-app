# Customer Recovery Gate (Customer #1 style)

This gate is a Playwright E2E check for founder/customer-success recovery validation of a real onboarding journey.

## What this gate automates

`tests/e2e/customer-recovery-gate.spec.js` verifies:

1. **Invite accepted or password reset path works**
   - automated when `RECOVERY_INVITE_TOKEN` or `RECOVERY_RESET_TOKEN` is provided
2. **Login works**
   - via `POST /auth/login`
3. **Dashboard loads after login**
   - browser login through `/login` then assert `/dashboard`
4. **Relevant compliance view loads**
   - browser check on `RECOVERY_COMPLIANCE_PATH` (default `/compliance`)

## Manual confirmation mode (when tokens are unavailable)

If you cannot safely provide invite/reset tokens, you can still run the gate by manually validating invite availability/acceptance first, then setting:

- `RECOVERY_MANUAL_INVITE_CONFIRMED=true`

This keeps the run explicit about what was manual vs automated.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORTAL_URL` | no | Portal base URL (default production portal URL) |
| `API_URL` | no | API base URL (default production API Gateway URL) |
| `RECOVERY_CUSTOMER_EMAIL` | yes | Real customer email to validate |
| `RECOVERY_PASSWORD` | yes | Password to validate login/dashboard/compliance |
| `RECOVERY_INVITE_TOKEN` | conditional | Invite token for `/auth/accept-invite` automation |
| `RECOVERY_RESET_TOKEN` | conditional | Reset token for `/auth/reset-password` automation |
| `RECOVERY_MANUAL_INVITE_CONFIRMED` | conditional | Set to `true` only after manual invite verification if no token is provided |
| `RECOVERY_COMPLIANCE_PATH` | no | Compliance route to validate (default `/compliance`) |

## Run

```bash
cd /tmp/workspace/cedrickbyrd/securebase-app/phase3a-portal
npx playwright test tests/e2e/customer-recovery-gate.spec.js
```

Or via npm script:

```bash
cd /tmp/workspace/cedrickbyrd/securebase-app/phase3a-portal
npm run test:e2e:customer-recovery
```

## Interpreting pass/fail

- The test prints stage logs prefixed with `[RECOVERY_GATE]`.
- **PASS** means the configured automated stages succeeded (and manual stage was explicitly acknowledged when used).
- **FAIL** means customer recovery is not verified end-to-end and should be treated as not recovered.
