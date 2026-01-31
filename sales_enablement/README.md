# Sales Enablement Module

This module provides a comprehensive sales enablement platform for SecureBase PaaS, enabling sales teams to manage leads, share content, track analytics, and enforce role-based access controls.

## Overview

The Sales Enablement module is designed to support the full sales lifecycle from lead capture through conversion, with built-in analytics and content management capabilities.

## Submodules

### 📊 Leads (`/leads`)
Manages lead capture, qualification, and tracking throughout the sales funnel. Includes lead scoring, activity tracking, and conversion metrics.

### 📚 Content (`/content`)
Central repository for sales collateral, presentations, case studies, and marketing materials. Supports versioning, access tracking, and content effectiveness analytics.

### 📈 Analytics (`/analytics`)
Provides insights into sales performance, lead conversion rates, content engagement, and pipeline health. Supports custom dashboards and automated reporting.

### 🔐 Roles (`/roles`)
Role-based access control (RBAC) system for managing permissions across the sales organization. Supports hierarchical roles and fine-grained permissions.

### ⚙️ Config (`/config`)
Configuration files and environment variable templates for the sales enablement module.

### 📝 Types (`/types`)
Shared TypeScript type definitions and interfaces used across all submodules.

## Architecture

This module follows a service-oriented architecture with:
- **Controllers**: Handle HTTP requests and route to appropriate services
- **Services**: Contain business logic and data processing
- **Models**: Define data schemas and database interactions
- **Middleware**: Handle cross-cutting concerns like authentication and permissions

## Getting Started

1. Install dependencies: `npm install`
2. Copy environment template: `cp config/.env.example config/.env`
3. Configure database and API settings in `.env`
4. Run tests: `npm test`
5. Start development server: `npm run dev`

## Testing

Each submodule includes comprehensive unit tests in the `__tests__/` directory. Run all tests with:

```bash
npm test
```

## Integration

This module integrates with:
- **Phase 2 Backend**: Customer data and authentication
- **Phase 3a Portal**: Dashboard and UI components
- **Phase 4 Analytics**: Advanced reporting and forecasting

## Future Enhancements

- AI-powered lead scoring
- Automated content recommendations
- Predictive analytics for pipeline forecasting
- Salesforce/HubSpot integrations
- Mobile app support
