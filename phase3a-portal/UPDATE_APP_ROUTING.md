# Update App.jsx Routing

Change this line:
```javascript
import SREDashboard from './components/SREDashboard';
```

To:
```javascript
import SREDashboardWrapper from './components/SREDashboardWrapper';
```

And change the route:
```javascript
<Route path="/sre-dashboard" element={isAuthenticated ? <SREDashboardWrapper /> : <Navigate to="/login" />} />
```

This way:
- Demo mode → Shows DemoDashboard (simple, pre-built demo)
- Production mode → Shows SREDashboard (real API calls, no mock data)
