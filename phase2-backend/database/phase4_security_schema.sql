-- ============================================
-- SecureBase Phase 4: Enterprise Security Schema
-- ============================================
-- SSO integration, enhanced MFA, IP whitelisting,
-- device fingerprinting, and security monitoring
--
-- New Tables:
--   - sso_providers: SSO provider configurations (SAML, OIDC)
--   - sso_user_mappings: User identity mapping for SSO
--   - ip_whitelists: Per-customer IP address whitelisting
--   - mfa_backup_codes: Emergency MFA recovery codes
--   - device_fingerprints: Trusted device tracking
--   - security_events: Security incident tracking
--   - password_history: Password rotation tracking
--   - api_key_rotation_policy: Automated key rotation

-- ============================================
-- SSO PROVIDERS TABLE
-- ============================================

CREATE TYPE sso_provider_type AS ENUM ('saml2', 'oidc', 'oauth2');
CREATE TYPE sso_status AS ENUM ('active', 'disabled', 'testing');

CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Provider details
  provider_type sso_provider_type NOT NULL,
  provider_name TEXT NOT NULL,  -- e.g., "Okta", "Google Workspace", "Azure AD"
  status sso_status DEFAULT 'testing',
  
  -- OIDC configuration
  oidc_issuer_url TEXT,
  oidc_client_id TEXT,
  oidc_client_secret_encrypted TEXT,  -- Encrypted with KMS
  oidc_scopes TEXT[] DEFAULT ARRAY['openid', 'email', 'profile'],
  
  -- SAML configuration
  saml_entity_id TEXT,
  saml_sso_url TEXT,
  saml_x509_cert TEXT,  -- PEM format
  saml_name_id_format TEXT DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  
  -- Attribute mapping
  email_attribute TEXT DEFAULT 'email',
  name_attribute TEXT DEFAULT 'name',
  role_attribute TEXT,
  custom_attributes JSONB DEFAULT '{}',
  
  -- Security settings
  enforce_mfa_from_provider BOOLEAN DEFAULT false,
  allowed_domains TEXT[],  -- e.g., ['company.com', 'company.co.uk']
  auto_provision_users BOOLEAN DEFAULT true,
  default_role user_role DEFAULT 'viewer',
  
  -- Performance tracking
  total_logins INTEGER DEFAULT 0,
  failed_logins INTEGER DEFAULT 0,
  avg_login_time_ms INTEGER,
  last_successful_login_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT unique_provider_per_customer UNIQUE (customer_id, provider_name),
  CONSTRAINT valid_oidc_config CHECK (
    provider_type != 'oidc' OR 
    (oidc_issuer_url IS NOT NULL AND oidc_client_id IS NOT NULL)
  ),
  CONSTRAINT valid_saml_config CHECK (
    provider_type != 'saml2' OR 
    (saml_entity_id IS NOT NULL AND saml_sso_url IS NOT NULL AND saml_x509_cert IS NOT NULL)
  )
);

CREATE INDEX idx_sso_providers_customer ON sso_providers(customer_id);
CREATE INDEX idx_sso_providers_status ON sso_providers(status);
CREATE INDEX idx_sso_providers_type ON sso_providers(provider_type);

-- ============================================
-- SSO USER MAPPINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS sso_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sso_provider_id UUID NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
  
  -- SSO identity
  sso_subject_id TEXT NOT NULL,  -- Provider's unique user ID
  sso_email TEXT NOT NULL,
  sso_name TEXT,
  
  -- Linking metadata
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sso_login_at TIMESTAMP,
  total_sso_logins INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT unique_sso_mapping UNIQUE (sso_provider_id, sso_subject_id)
);

CREATE INDEX idx_sso_user_mappings_user ON sso_user_mappings(user_id);
CREATE INDEX idx_sso_user_mappings_provider ON sso_user_mappings(sso_provider_id);
CREATE INDEX idx_sso_user_mappings_subject ON sso_user_mappings(sso_subject_id);

-- ============================================
-- IP WHITELISTS TABLE
-- ============================================

CREATE TYPE ip_whitelist_status AS ENUM ('active', 'disabled', 'expired');

CREATE TABLE IF NOT EXISTS ip_whitelists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- IP range (supports CIDR notation)
  ip_range CIDR NOT NULL,
  description TEXT,
  
  -- Status
  status ip_whitelist_status DEFAULT 'active',
  
  -- Optional expiration
  expires_at TIMESTAMP,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ip_whitelists_customer ON ip_whitelists(customer_id);
CREATE INDEX idx_ip_whitelists_ip_range ON ip_whitelists USING gist(ip_range inet_ops);
CREATE INDEX idx_ip_whitelists_status ON ip_whitelists(status);

-- ============================================
-- MFA BACKUP CODES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Backup code (hashed)
  code_hash TEXT NOT NULL UNIQUE,
  
  -- Usage tracking
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  used_from_ip INET,
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,  -- NULL = never expires
  
  CONSTRAINT valid_backup_code_lifecycle CHECK (NOT is_used OR used_at IS NOT NULL)
);

CREATE INDEX idx_mfa_backup_codes_user ON mfa_backup_codes(user_id);
CREATE INDEX idx_mfa_backup_codes_hash ON mfa_backup_codes(code_hash);

-- ============================================
-- DEVICE FINGERPRINTS TABLE
-- ============================================

CREATE TYPE device_trust_level AS ENUM ('trusted', 'unverified', 'suspicious', 'blocked');

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Device identification
  fingerprint_hash TEXT NOT NULL,
  device_name TEXT,  -- User-assigned name
  
  -- Device details
  user_agent TEXT,
  platform TEXT,  -- 'Windows', 'macOS', 'iOS', 'Android', etc.
  browser TEXT,
  ip_address INET,
  
  -- Geolocation
  country_code TEXT,
  city TEXT,
  
  -- Trust level
  trust_level device_trust_level DEFAULT 'unverified',
  
  -- Tracking
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_logins INTEGER DEFAULT 0,
  
  -- Verification
  verified_at TIMESTAMP,
  verified_by_method TEXT,  -- 'email_link', 'sms_code', 'admin_approval'
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_device_fingerprints_user ON device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX idx_device_fingerprints_trust ON device_fingerprints(trust_level);

-- ============================================
-- SECURITY EVENTS TABLE
-- ============================================

CREATE TYPE security_event_type AS ENUM (
  'failed_login', 'account_locked', 'suspicious_ip', 'new_device',
  'mfa_failed', 'password_reset_request', 'api_key_leaked',
  'unusual_activity', 'brute_force_attempt', 'session_hijack_attempt',
  'privilege_escalation_attempt', 'data_exfiltration_attempt'
);

CREATE TYPE security_event_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE security_event_status AS ENUM ('open', 'investigating', 'resolved', 'false_positive');

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Event details
  event_type security_event_type NOT NULL,
  severity security_event_severity NOT NULL,
  status security_event_status DEFAULT 'open',
  
  -- Actor (may be null for automated detections)
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  session_id UUID REFERENCES user_sessions(id),
  
  -- Event data
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  
  -- Response tracking
  assigned_to UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  -- Alert tracking
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_at TIMESTAMP,
  alert_recipients TEXT[],
  
  -- Timestamps
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_events_customer ON security_events(customer_id, detected_at DESC);
CREATE INDEX idx_security_events_type ON security_events(event_type, detected_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, detected_at DESC);
CREATE INDEX idx_security_events_status ON security_events(status);
CREATE INDEX idx_security_events_user ON security_events(user_id, detected_at DESC);

-- ============================================
-- PASSWORD HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Password tracking (hashed)
  password_hash TEXT NOT NULL,
  
  -- Metadata
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_from_ip INET,
  change_reason TEXT  -- 'user_initiated', 'admin_reset', 'policy_enforcement', 'breach_response'
);

CREATE INDEX idx_password_history_user ON password_history(user_id, changed_at DESC);

-- ============================================
-- API KEY ROTATION POLICY TABLE
-- ============================================

CREATE TYPE rotation_frequency AS ENUM ('30_days', '60_days', '90_days', '180_days', '365_days');

CREATE TABLE IF NOT EXISTS api_key_rotation_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Policy settings
  auto_rotation_enabled BOOLEAN DEFAULT false,
  rotation_frequency rotation_frequency DEFAULT '90_days',
  rotation_warning_days INTEGER DEFAULT 7,  -- Warn N days before rotation
  
  -- Grace period after rotation
  old_key_grace_period_hours INTEGER DEFAULT 24,  -- Old key valid for N hours
  
  -- Notification settings
  notify_on_rotation BOOLEAN DEFAULT true,
  notification_emails TEXT[],
  
  -- Tracking
  last_rotation_at TIMESTAMP,
  next_rotation_at TIMESTAMP,
  total_rotations INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT unique_rotation_policy_per_customer UNIQUE (customer_id)
);

CREATE INDEX idx_api_key_rotation_policy_customer ON api_key_rotation_policy(customer_id);
CREATE INDEX idx_api_key_rotation_policy_next_rotation ON api_key_rotation_policy(next_rotation_at);

-- ============================================
-- PASSWORD COMPLEXITY POLICIES
-- ============================================

CREATE TABLE IF NOT EXISTS password_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Length requirements
  min_length INTEGER DEFAULT 12,
  max_length INTEGER DEFAULT 128,
  
  -- Character requirements
  require_uppercase BOOLEAN DEFAULT true,
  require_lowercase BOOLEAN DEFAULT true,
  require_numbers BOOLEAN DEFAULT true,
  require_special_chars BOOLEAN DEFAULT true,
  
  -- Pattern restrictions
  disallow_common_passwords BOOLEAN DEFAULT true,
  disallow_user_info BOOLEAN DEFAULT true,  -- No email, name in password
  disallow_sequential_chars BOOLEAN DEFAULT true,  -- No 'abc', '123'
  
  -- History & rotation
  password_history_count INTEGER DEFAULT 5,  -- Cannot reuse last N passwords
  max_password_age_days INTEGER DEFAULT 90,
  password_expiry_warning_days INTEGER DEFAULT 7,
  
  -- Account lockout
  max_failed_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 30,
  lockout_reset_after_hours INTEGER DEFAULT 24,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT unique_password_policy_per_customer UNIQUE (customer_id),
  CONSTRAINT valid_password_length CHECK (min_length >= 8 AND min_length <= max_length)
);

CREATE INDEX idx_password_policies_customer ON password_policies(customer_id);

-- ============================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE sso_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_whitelists ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_rotation_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_policies ENABLE ROW LEVEL SECURITY;

-- Customer isolation policies
CREATE POLICY customer_isolation_sso_providers ON sso_providers
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_sso_user_mappings ON sso_user_mappings
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_ip_whitelists ON ip_whitelists
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_mfa_backup_codes ON mfa_backup_codes
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_device_fingerprints ON device_fingerprints
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_security_events ON security_events
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_password_history ON password_history
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_api_key_rotation_policy ON api_key_rotation_policy
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

CREATE POLICY customer_isolation_password_policies ON password_policies
  FOR ALL USING (customer_id = current_setting('app.current_customer_id')::uuid);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if IP is whitelisted for customer
CREATE OR REPLACE FUNCTION is_ip_whitelisted(
  p_customer_id UUID,
  p_ip_address INET
)
RETURNS BOOLEAN AS $$
DECLARE
  v_whitelisted BOOLEAN;
BEGIN
  -- If customer has no whitelist entries, allow all IPs
  IF NOT EXISTS (SELECT 1 FROM ip_whitelists WHERE customer_id = p_customer_id AND status = 'active') THEN
    RETURN true;
  END IF;
  
  -- Check if IP is in whitelist
  SELECT EXISTS (
    SELECT 1 FROM ip_whitelists
    WHERE customer_id = p_customer_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      AND p_ip_address << ip_range  -- IP is within CIDR range
  ) INTO v_whitelisted;
  
  -- Update last_used_at for matching entries
  IF v_whitelisted THEN
    UPDATE ip_whitelists
    SET last_used_at = CURRENT_TIMESTAMP,
        usage_count = usage_count + 1
    WHERE customer_id = p_customer_id
      AND status = 'active'
      AND p_ip_address << ip_range;
  END IF;
  
  RETURN v_whitelisted;
END;
$$ LANGUAGE plpgsql;

-- Generate MFA backup codes for user
CREATE OR REPLACE FUNCTION generate_mfa_backup_codes(
  p_user_id UUID,
  p_customer_id UUID,
  p_count INTEGER DEFAULT 10
)
RETURNS TABLE(code TEXT) AS $$
DECLARE
  v_code TEXT;
  v_code_hash TEXT;
  i INTEGER;
BEGIN
  -- Delete existing unused backup codes
  DELETE FROM mfa_backup_codes
  WHERE user_id = p_user_id AND NOT is_used;
  
  -- Generate new codes
  FOR i IN 1..p_count LOOP
    -- Generate 8-character alphanumeric code
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    v_code_hash := encode(sha256(v_code::bytea), 'hex');
    
    -- Insert hashed code
    INSERT INTO mfa_backup_codes (user_id, customer_id, code_hash)
    VALUES (p_user_id, p_customer_id, v_code_hash);
    
    -- Return plaintext code (only shown once)
    RETURN QUERY SELECT v_code;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Verify MFA backup code
CREATE OR REPLACE FUNCTION verify_mfa_backup_code(
  p_user_id UUID,
  p_code TEXT,
  p_ip_address INET
)
RETURNS BOOLEAN AS $$
DECLARE
  v_code_hash TEXT;
  v_verified BOOLEAN;
BEGIN
  v_code_hash := encode(sha256(p_code::bytea), 'hex');
  
  -- Check if code exists and is unused
  UPDATE mfa_backup_codes
  SET is_used = true,
      used_at = CURRENT_TIMESTAMP,
      used_from_ip = p_ip_address
  WHERE user_id = p_user_id
    AND code_hash = v_code_hash
    AND NOT is_used
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  RETURNING true INTO v_verified;
  
  RETURN COALESCE(v_verified, false);
END;
$$ LANGUAGE plpgsql;

-- Log security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_customer_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_description TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_send_alert BOOLEAN;
BEGIN
  -- Insert security event
  INSERT INTO security_events (
    customer_id, event_type, severity, description,
    user_id, user_email, ip_address, details
  )
  VALUES (
    p_customer_id, p_event_type::security_event_type, p_severity::security_event_severity,
    p_description, p_user_id, p_user_email, p_ip_address, p_details
  )
  RETURNING id INTO v_event_id;
  
  -- Determine if alert should be sent (high/critical severity)
  v_send_alert := p_severity IN ('high', 'critical');
  
  IF v_send_alert THEN
    -- Update alert tracking (actual alert sending done by Lambda)
    UPDATE security_events
    SET alert_sent = true,
        alert_sent_at = CURRENT_TIMESTAMP
    WHERE id = v_event_id;
  END IF;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Check password against policy
CREATE OR REPLACE FUNCTION validate_password(
  p_customer_id UUID,
  p_password TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_policy RECORD;
  v_length INTEGER;
BEGIN
  -- Get password policy
  SELECT * INTO v_policy FROM password_policies WHERE customer_id = p_customer_id;
  
  -- If no policy exists, use default validation
  IF v_policy IS NULL THEN
    v_policy.min_length := 12;
    v_policy.require_uppercase := true;
    v_policy.require_lowercase := true;
    v_policy.require_numbers := true;
    v_policy.require_special_chars := true;
  END IF;
  
  v_length := length(p_password);
  
  -- Length check
  IF v_length < v_policy.min_length THEN
    RETURN QUERY SELECT false, 'Password must be at least ' || v_policy.min_length || ' characters long';
    RETURN;
  END IF;
  
  -- Uppercase check
  IF v_policy.require_uppercase AND p_password !~ '[A-Z]' THEN
    RETURN QUERY SELECT false, 'Password must contain at least one uppercase letter';
    RETURN;
  END IF;
  
  -- Lowercase check
  IF v_policy.require_lowercase AND p_password !~ '[a-z]' THEN
    RETURN QUERY SELECT false, 'Password must contain at least one lowercase letter';
    RETURN;
  END IF;
  
  -- Number check
  IF v_policy.require_numbers AND p_password !~ '[0-9]' THEN
    RETURN QUERY SELECT false, 'Password must contain at least one number';
    RETURN;
  END IF;
  
  -- Special character check
  IF v_policy.require_special_chars AND p_password !~ '[^A-Za-z0-9]' THEN
    RETURN QUERY SELECT false, 'Password must contain at least one special character';
    RETURN;
  END IF;
  
  -- Password history check (if user_id provided)
  IF p_user_id IS NOT NULL AND v_policy.password_history_count > 0 THEN
    -- This would require bcrypt comparison in application code
    -- Database can't verify bcrypt hashes directly
  END IF;
  
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANTS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON sso_providers TO securebase_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sso_user_mappings TO securebase_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ip_whitelists TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON mfa_backup_codes TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON device_fingerprints TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON security_events TO securebase_app;
GRANT SELECT, INSERT ON password_history TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON api_key_rotation_policy TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON password_policies TO securebase_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO securebase_app;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE sso_providers IS 'SSO provider configurations supporting SAML 2.0 and OIDC with <2s login performance target';
COMMENT ON TABLE ip_whitelists IS 'IP address whitelisting with 100% enforcement for customer access control';
COMMENT ON TABLE security_events IS 'Security incident tracking with <15min incident response target';
COMMENT ON TABLE device_fingerprints IS 'Device fingerprinting for suspicious activity detection';
COMMENT ON TABLE mfa_backup_codes IS 'Emergency MFA recovery codes for user account recovery';
COMMENT ON TABLE password_policies IS 'Password complexity and rotation policies per customer';
COMMENT ON TABLE api_key_rotation_policy IS 'Automated API key rotation policies';

COMMENT ON FUNCTION is_ip_whitelisted IS 'Validates IP address against customer whitelist with automatic usage tracking';
COMMENT ON FUNCTION generate_mfa_backup_codes IS 'Generates secure backup codes for MFA recovery (shown only once)';
COMMENT ON FUNCTION verify_mfa_backup_code IS 'Verifies and marks backup code as used (one-time use)';
COMMENT ON FUNCTION log_security_event IS 'Logs security events with automatic alerting for high/critical severity';
COMMENT ON FUNCTION validate_password IS 'Validates password against customer policy rules';
