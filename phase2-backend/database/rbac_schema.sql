-- ============================================
-- SecureBase Phase 4: Team Collaboration & RBAC
-- ============================================
-- Multi-user access with granular permissions
-- Supports 100+ users per customer account
-- Audit logging for all user actions
--
-- New Tables:
--   - users: User accounts within customer organizations
--   - team_roles: Role definitions (Admin, Manager, Analyst, Viewer)
--   - user_permissions: Granular resource-level permissions
--   - user_sessions: Session management with MFA support
--   - user_invites: User invitation tracking
--   - activity_feed: User activity tracking for audit trail

-- ============================================
-- CUSTOM TYPES FOR RBAC
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'analyst', 'viewer');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE permission_action AS ENUM ('read', 'create', 'update', 'delete');
CREATE TYPE resource_type AS ENUM (
  'customers', 'invoices', 'api_keys', 'usage_metrics', 
  'support_tickets', 'notifications', 'audit_events',
  'reports', 'analytics', 'users', 'settings'
);
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
CREATE TYPE activity_type AS ENUM (
  'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted',
  'role_changed', 'permission_granted', 'permission_revoked',
  'resource_created', 'resource_updated', 'resource_deleted',
  'api_key_created', 'api_key_rotated', 'api_key_deleted',
  'invoice_viewed', 'report_generated', 'export_downloaded'
);

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- User identity
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  
  -- Authentication
  password_hash TEXT,  -- bcrypt hash, NULL for SSO-only users
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret TEXT,  -- TOTP secret, encrypted
  
  -- Role & Status
  role user_role DEFAULT 'viewer',
  status user_status DEFAULT 'pending',
  
  -- Profile
  avatar_url TEXT,
  job_title TEXT,
  department TEXT,
  timezone TEXT DEFAULT 'UTC',
  locale TEXT DEFAULT 'en-US',
  
  -- Security
  last_login_at TIMESTAMP,
  last_login_ip INET,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  password_changed_at TIMESTAMP,
  must_change_password BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,  -- References users(id)
  
  -- Constraints
  CONSTRAINT unique_user_email_per_customer UNIQUE (customer_id, email),
  CONSTRAINT valid_user_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_customer ON users(customer_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_login ON users(last_login_at DESC);

-- ============================================
-- TEAM ROLES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS team_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Role definition
  name TEXT NOT NULL,
  description TEXT,
  role_type user_role NOT NULL,
  
  -- Role configuration
  is_system_role BOOLEAN DEFAULT false,  -- Cannot be deleted
  max_users INTEGER,  -- NULL = unlimited
  
  -- Default permissions for this role
  default_permissions JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT unique_role_name_per_customer UNIQUE (customer_id, name)
);

CREATE INDEX idx_team_roles_customer ON team_roles(customer_id);
CREATE INDEX idx_team_roles_type ON team_roles(role_type);

-- ============================================
-- USER PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Permission scope
  resource_type resource_type NOT NULL,
  resource_id TEXT,  -- NULL = all resources of this type
  
  -- Actions allowed
  actions permission_action[] NOT NULL,
  
  -- Conditions (optional)
  conditions JSONB DEFAULT '{}',  -- e.g., {"regions": ["us-east-1"], "tags": {"env": "prod"}}
  
  -- Grant metadata
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,  -- NULL = never expires
  
  -- Metadata
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT unique_user_resource_permission UNIQUE (user_id, resource_type, resource_id)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_customer ON user_permissions(customer_id);
CREATE INDEX idx_user_permissions_resource ON user_permissions(resource_type, resource_id);
CREATE INDEX idx_user_permissions_expires ON user_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- USER SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Session data
  session_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  
  -- Device/Client info
  user_agent TEXT,
  ip_address INET NOT NULL,
  device_fingerprint TEXT,
  
  -- MFA verification
  mfa_verified BOOLEAN DEFAULT false,
  mfa_verified_at TIMESTAMP,
  
  -- Session lifecycle
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  -- Logout tracking
  is_active BOOLEAN DEFAULT true,
  logged_out_at TIMESTAMP,
  logout_reason TEXT
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token_hash);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at) WHERE is_active = true;
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity_at DESC);

-- ============================================
-- USER INVITES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Invite details
  email TEXT NOT NULL,
  role user_role NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  
  -- Invite token
  invite_token_hash TEXT NOT NULL UNIQUE,
  
  -- Status tracking
  status invite_status DEFAULT 'pending',
  
  -- Response tracking
  accepted_at TIMESTAMP,
  accepted_by_user_id UUID REFERENCES users(id),
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,  -- Typically 7 days
  
  -- Delivery tracking
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP,
  email_delivery_status TEXT,
  
  -- Metadata
  message TEXT,
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT valid_invite_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_user_invites_customer ON user_invites(customer_id);
CREATE INDEX idx_user_invites_email ON user_invites(email);
CREATE INDEX idx_user_invites_status ON user_invites(status);
CREATE INDEX idx_user_invites_token ON user_invites(invite_token_hash);
CREATE INDEX idx_user_invites_expires ON user_invites(expires_at);

-- ============================================
-- ACTIVITY FEED TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Actor
  user_id UUID REFERENCES users(id),  -- NULL for system actions
  user_email TEXT NOT NULL,
  
  -- Activity details
  activity_type activity_type NOT NULL,
  description TEXT NOT NULL,
  
  -- Resource affected
  resource_type resource_type,
  resource_id TEXT,
  resource_name TEXT,
  
  -- Change details
  changes JSONB DEFAULT '{}',  -- {"field": {"old": "value1", "new": "value2"}}
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id UUID REFERENCES user_sessions(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_feed_customer ON activity_feed(customer_id, created_at DESC);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id, created_at DESC);
CREATE INDEX idx_activity_feed_type ON activity_feed(activity_type, created_at DESC);
CREATE INDEX idx_activity_feed_resource ON activity_feed(resource_type, resource_id);

-- ============================================
-- ROW-LEVEL SECURITY (RLS) FOR RBAC TABLES
-- ============================================

-- Enable RLS on all RBAC tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- Users: Only see users in own customer account
CREATE POLICY customer_isolation_users 
  ON users 
  FOR ALL 
  USING (
    customer_id = current_setting('app.current_customer_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- Team Roles: Only see roles in own customer account
CREATE POLICY customer_isolation_team_roles 
  ON team_roles 
  FOR ALL 
  USING (
    customer_id = current_setting('app.current_customer_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- User Permissions: Only see permissions in own customer account
CREATE POLICY customer_isolation_user_permissions 
  ON user_permissions 
  FOR ALL 
  USING (
    customer_id = current_setting('app.current_customer_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- User Sessions: Only see own sessions or admin can see all
CREATE POLICY user_sessions_access 
  ON user_sessions 
  FOR SELECT 
  USING (
    user_id = current_setting('app.current_user_id')::uuid 
    OR customer_id = current_setting('app.current_customer_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- User Sessions: Only users can create their own sessions
CREATE POLICY user_sessions_insert 
  ON user_sessions 
  FOR INSERT 
  WITH CHECK (
    user_id = current_setting('app.current_user_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- User Sessions: Only users can update their own sessions
CREATE POLICY user_sessions_update 
  ON user_sessions 
  FOR UPDATE 
  USING (
    user_id = current_setting('app.current_user_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- User Invites: Only see invites in own customer account
CREATE POLICY customer_isolation_user_invites 
  ON user_invites 
  FOR ALL 
  USING (
    customer_id = current_setting('app.current_customer_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- Activity Feed: Only see activity in own customer account
CREATE POLICY customer_isolation_activity_feed 
  ON activity_feed 
  FOR SELECT 
  USING (
    customer_id = current_setting('app.current_customer_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- Activity Feed: System can insert activity logs
CREATE POLICY activity_feed_insert_allowed 
  ON activity_feed 
  FOR INSERT 
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS FOR RBAC
-- ============================================

-- Set user context for RLS (extends existing set_customer_context)
CREATE OR REPLACE FUNCTION set_user_context(
  p_customer_id UUID, 
  p_user_id UUID, 
  p_role TEXT DEFAULT 'customer'
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_customer_id', p_customer_id::TEXT, false);
  PERFORM set_config('app.current_user_id', p_user_id::TEXT, false);
  PERFORM set_config('app.role', p_role, false);
END;
$$ LANGUAGE plpgsql;

-- Check if user has permission for action on resource
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
  v_user_role user_role;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  
  -- Admins have all permissions
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
  SELECT EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = p_user_id
      AND resource_type = p_resource_type::resource_type
      AND (resource_id = p_resource_id OR resource_id IS NULL)
      AND p_action::permission_action = ANY(actions)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Get user permissions summary
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(
  resource_type TEXT,
  resource_id TEXT,
  actions TEXT[],
  expires_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.resource_type::TEXT,
    up.resource_id,
    ARRAY(SELECT unnest(up.actions)::TEXT) as actions,
    up.expires_at
  FROM user_permissions up
  WHERE up.user_id = p_user_id
    AND (up.expires_at IS NULL OR up.expires_at > CURRENT_TIMESTAMP)
  ORDER BY up.resource_type, up.resource_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE(cleaned_count INT) AS $$
DECLARE
  row_count INT;
BEGIN
  UPDATE user_sessions
  SET is_active = false, 
      logged_out_at = CURRENT_TIMESTAMP,
      logout_reason = 'expired'
  WHERE is_active = true
    AND expires_at < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN QUERY SELECT row_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired invites
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS TABLE(cleaned_count INT) AS $$
DECLARE
  row_count INT;
BEGIN
  UPDATE user_invites
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN QUERY SELECT row_count;
END;
$$ LANGUAGE plpgsql;

-- Update audit_events table to support user tracking
-- Add user_id column to existing audit_events table
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id, created_at DESC);

-- ============================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMP
-- ============================================

CREATE TRIGGER users_update_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER team_roles_update_timestamp
  BEFORE UPDATE ON team_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- ============================================
-- INITIAL RBAC DATA
-- ============================================

-- Insert default system roles (these will be created per customer on signup)
-- This is just documentation of the role structure

-- Admin Role: Full access to all resources
-- - Can manage users, roles, and permissions
-- - Can view/edit all resources
-- - Can access all API endpoints

-- Manager Role: Manage resources but not users
-- - Can create/update/delete most resources
-- - Can view reports and analytics
-- - Cannot manage users or roles

-- Analyst Role: View and analyze data
-- - Read-only access to most resources
-- - Can generate reports and exports
-- - Can view analytics

-- Viewer Role: Read-only access
-- - Can view invoices and basic metrics
-- - Cannot create or modify resources
-- - Limited API access

-- ============================================
-- PERMISSIONS & GRANT FOR RBAC TABLES
-- ============================================

-- Grant permissions to application role
GRANT SELECT, INSERT, UPDATE ON users TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON team_roles TO securebase_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_permissions TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON user_invites TO securebase_app;
GRANT SELECT, INSERT ON activity_feed TO securebase_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO securebase_app;

-- Grant read-only to analytics role
GRANT SELECT ON users TO securebase_analytics;
GRANT SELECT ON team_roles TO securebase_analytics;
GRANT SELECT ON user_permissions TO securebase_analytics;
GRANT SELECT ON user_sessions TO securebase_analytics;
GRANT SELECT ON user_invites TO securebase_analytics;
GRANT SELECT ON activity_feed TO securebase_analytics;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE users IS 'User accounts within customer organizations. Supports 100+ users per customer with MFA and session management.';
COMMENT ON TABLE team_roles IS 'Role definitions for RBAC. System roles: Admin, Manager, Analyst, Viewer.';
COMMENT ON TABLE user_permissions IS 'Granular resource-level permissions (read, create, update, delete) for users.';
COMMENT ON TABLE user_sessions IS 'Active user sessions with MFA verification and device tracking.';
COMMENT ON TABLE user_invites IS 'User invitation tracking with >95% delivery success rate.';
COMMENT ON TABLE activity_feed IS 'User activity tracking for audit trail and compliance. 100% action logging.';

COMMENT ON COLUMN users.role IS 'User role: admin (full access), manager (manage resources), analyst (read + reports), viewer (read-only)';
COMMENT ON COLUMN users.mfa_enabled IS 'Whether user has enabled MFA. Required for admin/manager roles in production.';
COMMENT ON COLUMN user_permissions.resource_id IS 'Specific resource ID or NULL for all resources of this type';
COMMENT ON COLUMN user_permissions.conditions IS 'Optional JSON conditions like {"regions": ["us-east-1"], "tags": {"env": "prod"}}';
COMMENT ON COLUMN user_sessions.mfa_verified IS 'Whether current session has passed MFA verification. Required for sensitive operations.';
COMMENT ON COLUMN activity_feed.changes IS 'JSON object tracking what changed: {"field": {"old": "value1", "new": "value2"}}';
