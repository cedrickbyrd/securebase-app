/**
 * Roles Unit Tests
 * 
 * Test suite for the roles submodule including:
 * - Role model and permissions
 * - Permission checking logic
 * - Middleware functions
 * - Role inheritance
 */

import { 
  Role, 
  sampleRoles, 
  sampleUserRoles, 
  getRoleById, 
  getUserRoles, 
  hasPermission,
  getAllPermissions 
} from '../roles.model';
import { 
  checkUserPermission,
  checkPermission,
  getUserPermissions 
} from '../roles.middleware';

describe('Roles Model', () => {
  test('should have valid sample roles', () => {
    expect(sampleRoles).toBeDefined();
    expect(sampleRoles.length).toBeGreaterThan(0);
    
    sampleRoles.forEach(role => {
      expect(role.id).toBeDefined();
      expect(role.name).toBeDefined();
      expect(role.permissions).toBeDefined();
      expect(role.level).toBeGreaterThan(0);
    });
  });

  test('should retrieve role by ID', () => {
    const adminRole = getRoleById('role-001');
    expect(adminRole).toBeDefined();
    expect(adminRole?.name).toBe('Admin');
    expect(adminRole?.level).toBe(1);
  });

  test('should get user roles', () => {
    const roles = getUserRoles('sales-rep-john-doe');
    expect(roles.length).toBeGreaterThan(0);
    expect(roles[0].name).toBe('Sales Representative');
  });

  test('should check role permissions', () => {
    const adminRole = getRoleById('role-001');
    expect(adminRole).toBeDefined();
    
    if (adminRole) {
      expect(hasPermission(adminRole, 'leads', 'create')).toBe(true);
      expect(hasPermission(adminRole, 'leads', 'delete')).toBe(true);
      expect(hasPermission(adminRole, 'analytics', 'view')).toBe(true);
    }
  });

  test('should check Sales Rep has limited permissions', () => {
    const repRole = getRoleById('role-003');
    expect(repRole).toBeDefined();
    
    if (repRole) {
      expect(hasPermission(repRole, 'leads', 'create')).toBe(true);
      expect(hasPermission(repRole, 'leads', 'read')).toBe(true);
      expect(hasPermission(repRole, 'leads', 'delete')).toBe(false); // Can't delete
      expect(hasPermission(repRole, 'content', 'publish')).toBe(false); // Can't publish
    }
  });

  test('should inherit permissions from parent role', () => {
    // Sales Rep (role-003) inherits from Sales Manager (role-002)
    const repPermissions = getAllPermissions('role-003');
    
    expect(repPermissions).toBeDefined();
    expect(repPermissions.length).toBeGreaterThan(0);
    
    // Should have own permissions
    const leadsPermission = repPermissions.find(p => p.resource === 'leads');
    expect(leadsPermission).toBeDefined();
    
    // Should inherit team permission from parent
    const teamPermission = repPermissions.find(p => p.resource === 'team');
    expect(teamPermission).toBeDefined();
  });

  test('should have valid user role assignments', () => {
    expect(sampleUserRoles).toBeDefined();
    expect(sampleUserRoles.length).toBeGreaterThan(0);
    
    sampleUserRoles.forEach(userRole => {
      expect(userRole.userId).toBeDefined();
      expect(userRole.roleId).toBeDefined();
      expect(userRole.assignedAt).toBeInstanceOf(Date);
    });
  });
});

describe('Roles Middleware', () => {
  test('should check user permission correctly', () => {
    // Admin user should have all permissions
    expect(checkUserPermission('user-admin-001', 'leads', 'create')).toBe(true);
    expect(checkUserPermission('user-admin-001', 'leads', 'delete')).toBe(true);
    expect(checkUserPermission('user-admin-001', 'roles', 'create')).toBe(true);
    
    // Sales Rep should have limited permissions
    expect(checkUserPermission('sales-rep-john-doe', 'leads', 'create')).toBe(true);
    expect(checkUserPermission('sales-rep-john-doe', 'leads', 'read')).toBe(true);
    expect(checkUserPermission('sales-rep-john-doe', 'leads', 'delete')).toBe(false);
    
    // Content Manager should have content permissions
    expect(checkUserPermission('user-marketing-sarah', 'content', 'create')).toBe(true);
    expect(checkUserPermission('user-marketing-sarah', 'content', 'publish')).toBe(true);
  });

  test('should return false for user with no roles', () => {
    expect(checkUserPermission('unknown-user', 'leads', 'create')).toBe(false);
  });

  test('should get user permissions list', () => {
    const adminPermissions = getUserPermissions('user-admin-001');
    
    expect(adminPermissions).toBeDefined();
    expect(adminPermissions.length).toBeGreaterThan(0);
    expect(adminPermissions).toContain('leads:create');
    expect(adminPermissions).toContain('leads:read');
    expect(adminPermissions).toContain('content:publish');
    expect(adminPermissions).toContain('analytics:view');
  });

  test('should get limited permissions for Sales Rep', () => {
    const repPermissions = getUserPermissions('sales-rep-john-doe');
    
    expect(repPermissions).toBeDefined();
    expect(repPermissions).toContain('leads:create');
    expect(repPermissions).toContain('leads:read');
    expect(repPermissions).toContain('content:read');
    expect(repPermissions).not.toContain('leads:delete');
    expect(repPermissions).not.toContain('content:publish');
  });

  test('checkPermission middleware should allow authorized access', () => {
    const mockReq = {
      user: { id: 'user-admin-001' },
      headers: {},
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockNext = jest.fn();
    
    const middleware = checkPermission('leads', 'create');
    middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  test('checkPermission middleware should deny unauthorized access', () => {
    const mockReq = {
      user: { id: 'sales-rep-john-doe' },
      headers: {},
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockNext = jest.fn();
    
    const middleware = checkPermission('leads', 'delete');
    middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Forbidden',
      })
    );
  });

  test('checkPermission middleware should require authentication', () => {
    const mockReq = {
      headers: {},
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockNext = jest.fn();
    
    const middleware = checkPermission('leads', 'create');
    middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Authentication required',
      })
    );
  });
});

describe('Role Hierarchy', () => {
  test('Admin role should be level 1', () => {
    const admin = getRoleById('role-001');
    expect(admin?.level).toBe(1);
  });

  test('Manager role should be level 2', () => {
    const manager = getRoleById('role-002');
    expect(manager?.level).toBe(2);
    expect(manager?.parentRoleId).toBe('role-001');
  });

  test('Sales Rep role should be level 3 and inherit from Manager', () => {
    const rep = getRoleById('role-003');
    expect(rep?.level).toBe(3);
    expect(rep?.parentRoleId).toBe('role-002');
  });

  test('should inherit permissions through hierarchy', () => {
    const repPermissions = getAllPermissions('role-003');
    const managerPermissions = getAllPermissions('role-002');
    const adminPermissions = getAllPermissions('role-001');
    
    // Rep should have fewer permissions than manager
    expect(repPermissions.length).toBeLessThanOrEqual(managerPermissions.length);
    
    // Manager should have fewer permissions than admin
    expect(managerPermissions.length).toBeLessThanOrEqual(adminPermissions.length);
  });
});
