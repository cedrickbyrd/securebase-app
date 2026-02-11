# DNS Configuration for securebase.io

## Required DNS Records

Add these records to your DNS provider (Cloudflare, Route53, etc.):

### Marketing Site (securebase.io)
| Type  | Name | Value                    | TTL  |
|-------|------|--------------------------|------|
| A     | @    | 75.2.60.5               | 3600 |
| CNAME | www  | securebase.io           | 3600 |

### Demo Portal (demo.securebase.io)
| Type  | Name | Value                        | TTL  |
|-------|------|------------------------------|------|
| CNAME | demo | securebase-demo.netlify.app  | 3600 |

### Future Subdomains (Documentation Only)
| Type  | Name   | Value                    | TTL  |
|-------|--------|--------------------------|------|
| CNAME | app    | TBD                      | 3600 |
| CNAME | api    | TBD (API Gateway)        | 3600 |
| CNAME | docs   | TBD                      | 3600 |
| CNAME | status | TBD                      | 3600 |

## Netlify Configuration

### Marketing Site
1. Go to Netlify dashboard → securebase-app site
2. Settings → Domain management → Custom domains
3. Add domain: `securebase.io`
4. Add domain: `www.securebase.io`
5. Set primary domain to `securebase.io`
6. Enable HTTPS (auto via Let's Encrypt)

### Demo Portal
1. Go to Netlify dashboard → securebase-demo site
2. Settings → Domain management → Custom domains
3. Add domain: `demo.securebase.io`
4. Enable HTTPS (auto via Let's Encrypt)

## SSL Certificates
- Netlify automatically provisions Let's Encrypt SSL certificates
- Auto-renewal enabled
- Force HTTPS via netlify.toml redirects

## Verification
```bash
# Test DNS propagation
dig securebase.io
dig demo.securebase.io

# Test HTTPS
curl -I https://securebase.io
curl -I https://demo.securebase.io
```
