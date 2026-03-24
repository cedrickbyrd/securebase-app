# 🔐 Demo Login Credentials

## Working Credentials

**URL:** https://demo.securebase.tximhotep.com

**Email:** demo@securebase.tximhotep.com  
**Password:** SecureBaseDemo2026!

**Cognito User Pool:** us-east-1_uJSKU0Tdc  
**User ID:** 249874d8-f091-70e4-9d48-4b47da971461

---

## Add to Login Page

Update your login page to show these credentials for demo users:
```jsx
// In your Login.jsx component
export default function Login() {
  const isDemo = window.location.hostname.startsWith('demo.');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Demo Credentials Banner */}
        {isDemo && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-6 shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  🎯 Demo Environment
                </h3>
                <div className="bg-white rounded-md p-4 border border-blue-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Email:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-blue-700 font-mono text-xs">
                        demo@securebase.tximhotep.com
                      </code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Password:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-blue-700 font-mono text-xs">
                        SecureBaseDemo2026!
                      </code>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  💡 Copy and paste these credentials to explore SecureBase
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Regular Login Form */}
        <div className="bg-white py-8 px-6 shadow rounded-lg">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">
              Sign in to SecureBase
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {isDemo ? 'Demo Environment' : 'Access your compliant infrastructure'}
            </p>
          </div>

          {/* Your existing login form here */}
          <form className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                defaultValue={isDemo ? "demo@securebase.tximhotep.com" : ""}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign in
            </button>
          </form>

          {!isDemo && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    New to SecureBase?
                  </span>
                </div>
              </div>
              <div className="mt-6">
                
                  href="https://securebase.tximhotep.com/signup"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Start free trial
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Update Credentials Card

Save this for easy reference:
```bash
cat > demo-credentials.txt << 'TXT'
╔════════════════════════════════════════════════╗
║        DEMO LOGIN CREDENTIALS                  ║
╠════════════════════════════════════════════════╣
║                                                ║
║  URL:      demo.securebase.tximhotep.com      ║
║                                                ║
║  Email:    demo@securebase.tximhotep.com      ║
║                                                ║
║  Password: SecureBaseDemo2026!                 ║
║                                                ║
╚════════════════════════════════════════════════╝

Display these credentials ON the login page
so prospects don't get stuck!
TXT

cat demo-credentials.txt
```

---

## Next Steps

1. ✅ Cognito user created
2. ✅ Password set (SecureBaseDemo2026!)
3. 🔄 Add credentials display to login page
4. 🔄 Build and deploy updated portal
5. 🔄 Test login flow

Want me to help you with the next step?
