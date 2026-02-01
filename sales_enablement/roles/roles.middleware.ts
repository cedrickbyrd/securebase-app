/**
 * Roles Middleware
 * 
 * Provides middleware functions for permission checking and access control.
 * Used to protect API routes based on user roles and permissions.
 */

import { Role, sampleRoles, sampleUserRoles, getAllPermissions, PermissionAction } from './roles.model';

/**
 * Check if a user has a specific permission
 * 
 * This is the core permission checking logic used by middleware
 * 
 * @param userId - ID of the user
 * @param resource - Resource being accessed (e.g., 'leads')
 * @param action - Action being performed (e.g., 'create')
 * @returns boolean - True if user has permission
 * 
 * Example:
 * ```typescript
 * const canCreate = checkUserPermission('user-123', 'leads', 'create');
 * if (!canCreate) {
 *   throw new Error('Unauthorized');
 * }
 * ```
 */
export function checkUserPermission(
  userId: string,
  resource: string,
  action: PermissionAction
): boolean {
  // Get user's role(s)
  const userRoleAssignments = sampleUserRoles.filter(ur => ur.userId === userId);
  
  if (userRoleAssignments.length === 0) {
    return false; // User has no roles
  }
  
  // Check each role for the permission
  for (const assignment of userRoleAssignments) {
    const allPermissions = getAllPermissions(assignment.roleId);
    
    const permission = allPermissions.find(p => p.resource === resource);
    if (permission && permission.actions.includes(action)) {
      return true; // User has permission through this role
    }
  }
  
  return false; // No role grants this permission
}

/**
 * Express.js middleware factory for permission checking
 * 
 * Creates middleware that checks if the authenticated user has the required permission
 * 
 * @param resource - Resource being accessed
 * @param action - Action being performed
 * @returns Express middleware function
 * 
 * Example:
 * ```typescript
 * import express from 'express';
 * import { checkPermission } from './roles.middleware';
 * 
 * const router = express.Router();
 * 
 * // Protect route - only users with 'leads:create' can access
 * router.post('/leads', 
 *   checkPermission('leads', 'create'),
 *   LeadsController.createLead
 * );
 * 
 * // Protect route - only users with 'analytics:view' can access
 * router.get('/analytics/dashboard',
 *   checkPermission('analytics', 'view'),
 *   AnalyticsController.getDashboard
 * );
 * ```
 */
export function checkPermission(resource: string, action: PermissionAction) {
  return (req: any, res: any, next: any) => {
    try {
      // Extract user ID from request (assumes authentication middleware has run)
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User ID not found in request'
        });
        return;
      }
      
      // Check if user has the required permission
      const hasPermission = checkUserPermission(userId, resource, action);
      
      if (!hasPermission) {
        // Log unauthorized access attempt
        console.warn('Unauthorized access attempt:', {
          userId,
          resource,
          action,
          timestamp: new Date(),
          ip: req.ip,
          endpoint: req.path
        });
        
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `You do not have permission to ${action} ${resource}`
        });
        return;
      }
      
      // User has permission, proceed to next middleware/handler
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Permission check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Middleware to check if user has ANY of the specified permissions
 * 
 * Useful when multiple permissions could grant access to a resource
 * 
 * @param permissionPairs - Array of [resource, action] pairs
 * @returns Express middleware function
 * 
 * Example:
 * ```typescript
 * // User needs either 'content:publish' OR 'content:update' to access
 * router.put('/content/:id/publish',
 *   checkAnyPermission([
 *     ['content', 'publish'],
 *     ['content', 'update']
 *   ]),
 *   ContentController.publishContent
 * );
 * ```
 */
export function checkAnyPermission(
  permissionPairs: Array<[string, PermissionAction]>
) {
  return (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      // Check if user has ANY of the permissions
      const hasAnyPermission = permissionPairs.some(([resource, action]) =>
        checkUserPermission(userId, resource, action)
      );
      
      if (!hasAnyPermission) {
        const permissionList = permissionPairs
          .map(([r, a]) => `${r}:${a}`)
          .join(' OR ');
        
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `You need one of these permissions: ${permissionList}`
        });
        return;
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Permission check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Middleware to check if user has ALL of the specified permissions
 * 
 * Useful when multiple permissions are required simultaneously
 * 
 * @param permissionPairs - Array of [resource, action] pairs
 * @returns Express middleware function
 * 
 * Example:
 * ```typescript
 * // User needs BOTH 'leads:read' AND 'analytics:view' to access
 * router.get('/leads/:id/analytics',
 *   checkAllPermissions([
 *     ['leads', 'read'],
 *     ['analytics', 'view']
 *   ]),
 *   LeadsController.getLeadAnalytics
 * );
 * ```
 */
export function checkAllPermissions(
  permissionPairs: Array<[string, PermissionAction]>
) {
  return (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      // Check if user has ALL of the permissions
      const hasAllPermissions = permissionPairs.every(([resource, action]) =>
        checkUserPermission(userId, resource, action)
      );
      
      if (!hasAllPermissions) {
        const permissionList = permissionPairs
          .map(([r, a]) => `${r}:${a}`)
          .join(' AND ');
        
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `You need all of these permissions: ${permissionList}`
        });
        return;
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Permission check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Middleware to check if user has a specific role
 * 
 * Simpler check when you just need to verify role membership
 * 
 * @param roleId - ID of the required role
 * @returns Express middleware function
 * 
 * Example:
 * ```typescript
 * // Only admins can access
 * router.delete('/users/:id',
 *   requireRole('role-001'),
 *   UsersController.deleteUser
 * );
 * ```
 */
export function requireRole(roleId: string) {
  return (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      const hasRole = sampleUserRoles.some(
        ur => ur.userId === userId && ur.roleId === roleId
      );
      
      if (!hasRole) {
        const role = sampleRoles.find(r => r.id === roleId);
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `You must have ${role?.name || roleId} role to access this resource`
        });
        return;
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Role check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Get user's effective permissions
 * 
 * Returns a list of all permissions the user has (useful for UI rendering)
 * 
 * @param userId - User ID
 * @returns Array of permission strings in 'resource:action' format
 * 
 * Example:
 * ```typescript
 * const permissions = getUserPermissions('user-123');
 * // Returns: ['leads:create', 'leads:read', 'leads:update', 'content:read', ...]
 * 
 * // Use in UI to show/hide features
 * if (permissions.includes('leads:create')) {
 *   showCreateButton();
 * }
 * ```
 */
export function getUserPermissions(userId: string): string[] {
  const userRoleAssignments = sampleUserRoles.filter(ur => ur.userId === userId);
  const allPermissions: string[] = [];
  
  for (const assignment of userRoleAssignments) {
    const permissions = getAllPermissions(assignment.roleId);
    
    permissions.forEach(perm => {
      perm.actions.forEach(action => {
        const permString = `${perm.resource}:${action}`;
        if (!allPermissions.includes(permString)) {
          allPermissions.push(permString);
        }
      });
    });
  }
  
  return allPermissions.sort();
}
