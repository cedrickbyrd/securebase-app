/**
 * Roles Model
 * 
 * Defines the Role data schema for Role-Based Access Control (RBAC).
 * Includes role definitions, permissions, and user assignments.
 */

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  parentRoleId?: string; // For permission inheritance
  level: number; // Hierarchy level (1 = highest/admin)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  resource: string; // e.g., 'leads', 'content', 'analytics'
  actions: PermissionAction[]; // e.g., ['create', 'read', 'update', 'delete']
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'share' | 'view';

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string;
}

/**
 * Sample Roles Data
 * 
 * Predefined roles demonstrating the RBAC hierarchy:
 * 1. Admin - Full system access
 * 2. Sales Manager - Team management and oversight
 * 3. Sales Representative - Individual contributor
 * 4. Content Manager - Content library management
 * 5. Viewer - Read-only access
 */
export const sampleRoles: Role[] = [
  {
    id: 'role-001',
    name: 'Admin',
    description: 'Full system access with all permissions. Can manage users, roles, and system configuration.',
    permissions: [
      { resource: 'leads', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'content', actions: ['create', 'read', 'update', 'delete', 'publish'] },
      { resource: 'analytics', actions: ['view'] },
      { resource: 'roles', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'settings', actions: ['read', 'update'] },
    ],
    level: 1,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-002',
    name: 'Sales Manager',
    description: 'Manages sales team, oversees leads and opportunities, approves content, views team analytics.',
    permissions: [
      { resource: 'leads', actions: ['create', 'read', 'update'] }, // Can't delete
      { resource: 'content', actions: ['read', 'publish'] }, // Can publish but not create
      { resource: 'analytics', actions: ['view'] },
      { resource: 'team', actions: ['read', 'update'] },
    ],
    parentRoleId: 'role-001',
    level: 2,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-003',
    name: 'Sales Representative',
    description: 'Individual contributor who manages assigned leads, accesses content, and tracks personal performance.',
    permissions: [
      { resource: 'leads', actions: ['create', 'read', 'update'] }, // Only own leads
      { resource: 'content', actions: ['read', 'share'] },
      { resource: 'analytics', actions: ['view'] }, // Only personal analytics
    ],
    parentRoleId: 'role-002',
    level: 3,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-004',
    name: 'Content Manager',
    description: 'Manages content library, creates and publishes sales collateral, tracks content effectiveness.',
    permissions: [
      { resource: 'leads', actions: ['read'] }, // Read-only to understand needs
      { resource: 'content', actions: ['create', 'read', 'update', 'delete', 'publish'] },
      { resource: 'analytics', actions: ['view'] }, // Content analytics only
    ],
    level: 2,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-005',
    name: 'Viewer',
    description: 'Read-only access for stakeholders, executives, or partners who need visibility without modification rights.',
    permissions: [
      { resource: 'leads', actions: ['read'] },
      { resource: 'content', actions: ['read'] },
      { resource: 'analytics', actions: ['view'] },
    ],
    level: 4,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
];

/**
 * Sample User-Role Assignments
 * 
 * Examples of users assigned to different roles
 */
export const sampleUserRoles: UserRole[] = [
  {
    userId: 'user-admin-001',
    roleId: 'role-001', // Admin
    assignedAt: new Date('2025-01-01'),
    assignedBy: 'system',
  },
  {
    userId: 'sales-rep-john-doe',
    roleId: 'role-003', // Sales Representative
    assignedAt: new Date('2025-01-15'),
    assignedBy: 'user-admin-001',
  },
  {
    userId: 'sales-rep-jane-smith',
    roleId: 'role-003', // Sales Representative
    assignedAt: new Date('2025-01-15'),
    assignedBy: 'user-admin-001',
  },
  {
    userId: 'user-marketing-sarah',
    roleId: 'role-004', // Content Manager
    assignedAt: new Date('2025-01-10'),
    assignedBy: 'user-admin-001',
  },
];

/**
 * Helper function to get role by ID
 */
export function getRoleById(id: string): Role | undefined {
  return sampleRoles.find(role => role.id === id);
}

/**
 * Helper function to get user's roles
 */
export function getUserRoles(userId: string): Role[] {
  const userRoleIds = sampleUserRoles
    .filter(ur => ur.userId === userId)
    .map(ur => ur.roleId);
  
  return sampleRoles.filter(role => userRoleIds.includes(role.id));
}

/**
 * Helper function to check if role has permission
 * 
 * @param role - Role to check
 * @param resource - Resource name (e.g., 'leads')
 * @param action - Action name (e.g., 'create')
 * @returns boolean - True if role has permission
 */
export function hasPermission(role: Role, resource: string, action: PermissionAction): boolean {
  const permission = role.permissions.find(p => p.resource === resource);
  return permission ? permission.actions.includes(action) : false;
}

/**
 * Helper function to get all permissions for a role (including inherited)
 * 
 * @param roleId - Role ID
 * @returns Permission[] - All permissions including inherited from parent
 */
export function getAllPermissions(roleId: string): Permission[] {
  const role = getRoleById(roleId);
  if (!role) return [];
  
  let allPermissions = [...role.permissions];
  
  // Recursively get parent permissions
  if (role.parentRoleId) {
    const parentPermissions = getAllPermissions(role.parentRoleId);
    
    // Merge permissions (child overrides parent)
    parentPermissions.forEach(parentPerm => {
      const existingPerm = allPermissions.find(p => p.resource === parentPerm.resource);
      if (!existingPerm) {
        allPermissions.push(parentPerm);
      } else {
        // Merge actions
        parentPerm.actions.forEach(action => {
          if (!existingPerm.actions.includes(action)) {
            existingPerm.actions.push(action);
          }
        });
      }
    });
  }
  
  return allPermissions;
}
