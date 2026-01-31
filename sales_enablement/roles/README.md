# Roles Submodule

## Purpose

The Roles submodule implements Role-Based Access Control (RBAC) for the sales enablement platform. It manages user roles, permissions, and access controls to ensure proper security and data isolation.

## Features

- **Hierarchical Roles**: Define role hierarchies (Admin → Manager → Sales Rep → Viewer)
- **Fine-Grained Permissions**: Control access at resource and action level
- **Permission Inheritance**: Child roles inherit parent permissions
- **Dynamic Permission Checks**: Runtime permission validation via middleware
- **Audit Logging**: Track permission grants/revocations and access attempts
- **Team Management**: Organize users into teams with shared permissions

## Predefined Roles

### Admin
- Full access to all resources
- User and role management
- System configuration
- Analytics and reporting

### Sales Manager
- View and manage team's leads
- Access all content
- View team analytics
- Approve content publishing

### Sales Representative
- View and manage assigned leads
- Access published content
- Track personal analytics
- Share content with prospects

### Content Manager
- Create and publish content
- Manage content library
- View content analytics

### Viewer (Read-Only)
- View leads (limited)
- Access published content
- View basic analytics

## Data Model

The Role model includes:
- Role name and description
- Permission set (resource:action pairs)
- Parent role for inheritance
- Users assigned to role
- Active/inactive status

## Permissions Structure

Permissions follow the format: `resource:action`

Examples:
- `leads:create`
- `leads:read`
- `leads:update`
- `leads:delete`
- `content:publish`
- `analytics:view`

## API Endpoints

- `GET /api/roles` - List all roles
- `GET /api/roles/:id` - Get role details
- `POST /api/roles` - Create new role
- `PUT /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role
- `POST /api/roles/:id/users` - Assign user to role
- `GET /api/roles/check` - Check permission

## Middleware Usage

```typescript
import { checkPermission } from './roles.middleware';

// Protect route with permission check
router.post('/leads', checkPermission('leads:create'), LeadsController.createLead);
router.get('/analytics', checkPermission('analytics:view'), AnalyticsController.getDashboard);
```

## Testing

Run roles tests with:
```bash
npm test roles.test.ts
```
