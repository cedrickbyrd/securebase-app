# Unified Authentication Implementation Plan
**Sprint Day:** 2 (PM)  
**Issue 2:** Implement Shared Session Management  
**Status:** Implementation Design

## Implementation Overview

### Current State Problems
1. Marketing site creates users but doesn't persist sessions
2. Portal requires separate Supabase authentication
3. No session sharing between domains
4. Different JWT implementations

### Solution: Lambda-Based SSO with Secure Cookies

## 1. Enhanced Session Management Lambda

### New Endpoints to Add

```python
# phase2-backend/functions/session_management.py additions

def create_cross_domain_session(data: Dict, source_ip: str, user_agent: str) -> Dict:
    """
    Create session that works across marketing and portal domains.
    Sets httpOnly cookie with SameSite=None for cross-domain.
    """
    # Implementation details below
    
def validate_cookie_session(cookie_header: str) -> Dict:
    """
    Validate session from cookie instead of Authorization header.
    Used by portal to check marketing site sessions.
    """
    # Implementation details below
```

### Cookie Configuration

```python
COOKIE_CONFIG = {
    'name': 'securebase_session',
    'httpOnly': True,
    'secure': True,  # HTTPS only
    'sameSite': 'None',  # Allow cross-domain
    'domain': '.tximhotep.com',  # Shared parent domain
    'path': '/',
    'maxAge': 86400  # 24 hours
}

def set_session_cookie(session_token: str) -> str:
    """Generate Set-Cookie header value."""
    cookie_parts = [
        f"{COOKIE_CONFIG['name']}={session_token}",
        f"HttpOnly",
        f"Secure",
        f"SameSite={COOKIE_CONFIG['sameSite']}",
        f"Domain={COOKIE_CONFIG['domain']}",
        f"Path={COOKIE_CONFIG['path']}",
        f"Max-Age={COOKIE_CONFIG['maxAge']}"
    ]
    return '; '.join(cookie_parts)
```

## 2. Marketing Site Updates

### Update Signup Flow
```javascript
// src/components/Signup.jsx
const handleSignupSuccess = async (response) => {
    // After successful signup, create session
    const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // Include cookies
        body: JSON.stringify({
            email: response.email,
            temporary_token: response.temp_token
        })
    });
    
    if (sessionResponse.ok) {
        // Cookie is set, redirect to portal
        window.location.href = 'https://demo.securebase.tximhotep.com/dashboard';
    }
};
```

### Add Session Check Hook
```javascript
// src/hooks/useSession.js
import { useState, useEffect } from 'react';

export const useSession = () => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetch('/api/auth/session', {
            credentials: 'include'
        })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            setSession(data);
            setLoading(false);
        })
        .catch(() => setLoading(false));
    }, []);
    
    return { session, loading };
};
```

## 3. Portal Updates

### Replace Supabase Auth with Lambda
```javascript
// phase3a-portal/src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        // Check for existing session via cookie
        checkSession();
    }, []);
    
    const checkSession = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/session`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            }
        } catch (error) {
            console.error('Session check failed:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const login = async (email, password) => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            return { success: true };
        } else {
            const error = await response.json();
            return { success: false, error: error.message };
        }
    };
    
    const logout = async () => {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        setUser(null);
        window.location.href = '/login';
    };
    
    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
```

## 4. API Gateway CORS Updates

```hcl
# landing-zone/modules/api-gateway/cors/main.tf
resource "aws_api_gateway_method_response" "cors_200" {
  # ... existing config ...
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Credentials" = true  # Add this
  }
}

resource "aws_api_gateway_integration_response" "cors_integration" {
  # ... existing config ...
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'https://securebase.tximhotep.com,https://demo.securebase.tximhotep.com'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Cookie'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
    "method.response.header.Access-Control-Allow-Credentials" = "'true'"  # Add this
  }
}
```

## 5. Security Considerations

### CSRF Protection
```python
def generate_csrf_token(session_id: str) -> str:
    """Generate CSRF token tied to session."""
    secret = get_jwt_secret()
    return hashlib.sha256(f"{session_id}:{secret}".encode()).hexdigest()[:32]

def validate_csrf_token(session_id: str, token: str) -> bool:
    """Validate CSRF token."""
    expected = generate_csrf_token(session_id)
    return secrets.compare_digest(expected, token)
```

### Session Security Rules
1. **httpOnly cookies** - Prevent XSS attacks
2. **Secure flag** - HTTPS only
3. **SameSite=None** - Required for cross-domain
4. **CSRF tokens** - For state-changing operations
5. **15-minute idle timeout** - Compliance requirement
6. **IP validation** - Optional security check

## 6. Migration Strategy

### Phase 1: Parallel Systems (Current)
- Marketing site uses Lambda auth
- Portal uses Supabase auth
- No session sharing

### Phase 2: Bridge Implementation (This Sprint)
- Add cookie-based sessions to Lambda
- Portal checks Lambda sessions first
- Fallback to Supabase for existing users

### Phase 3: Full Migration (Future)
- Remove Supabase auth completely
- All auth through Lambda
- Single session across all properties

## 7. Testing Plan

### Unit Tests
```python
# test_session_management.py
def test_cross_domain_cookie():
    """Test cookie has correct attributes."""
    
def test_session_validation():
    """Test session validation from cookie."""
    
def test_csrf_protection():
    """Test CSRF token generation and validation."""
```

### Integration Tests
```javascript
// tests/e2e/test_unified_auth.js
describe('Unified Authentication', () => {
    test('Signup on marketing creates portal session', async () => {
        // 1. Sign up on marketing site
        // 2. Check cookie is set
        // 3. Navigate to portal
        // 4. Verify auto-login
    });
    
    test('Portal login works on marketing site', async () => {
        // 1. Login on portal
        // 2. Navigate to marketing site
        // 3. Verify session active
    });
});
```

## 8. Rollback Plan

If issues arise:
1. Portal reverts to Supabase auth (code flag)
2. Marketing site continues with Lambda
3. No session sharing (current state)

```javascript
// Feature flag in portal
const USE_UNIFIED_AUTH = process.env.VITE_UNIFIED_AUTH === 'true';

export const useAuth = USE_UNIFIED_AUTH 
    ? useUnifiedAuth()  // New Lambda-based
    : useSupabaseAuth(); // Existing
```

## Implementation Checklist

- [ ] Update session_management.py with cookie support
- [ ] Add CSRF protection
- [ ] Update API Gateway CORS settings
- [ ] Modify marketing site signup flow
- [ ] Create useSession hook for marketing site
- [ ] Replace portal auth with Lambda client
- [ ] Add feature flag for rollback
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation