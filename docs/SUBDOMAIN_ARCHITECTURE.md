# Subdomain Architecture

## Current Active Subdomains
- `securebase.io` - Marketing website
- `demo.securebase.io` - Demo customer portal

## Future Subdomains (Planned)
- `app.securebase.io` - Production customer portal
- `api.securebase.io` - Backend API (API Gateway)
- `docs.securebase.io` - Documentation site
- `status.securebase.io` - Status page
- `blog.securebase.io` - Company blog (optional)

## Security Considerations
- Each subdomain isolated
- Wildcard SSL certificate for `*.securebase.io`
- CORS configured per subdomain
- CSP headers enforced
