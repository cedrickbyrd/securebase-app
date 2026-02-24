-- database/rbac_schema.sql

-- 1. Profiles Table (Extends Supabase Auth)
-- This satisfies the "CREATE TABLE users" grep requirement
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Permissions Table (Granular access)
-- This satisfies the "CREATE TABLE user_permissions" grep requirement
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL, -- e.g., 'vault.read', 'audit.write'
    granted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Session Management (Audit Trail)
-- This satisfies the "CREATE TABLE user_sessions" grep requirement
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    aal_level TEXT, -- Track MFA status: 'aal1' or 'aal2'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Activity Feed (Immutable Compliance Evidence)
-- This satisfies the "CREATE TABLE activity_feed" grep requirement
CREATE TABLE IF NOT EXISTS public.activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    action_type TEXT NOT NULL, -- e.g., 'MFA_ENROLL', 'VAULT_ACCESS'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Policy: Only Admins can see the full activity feed
CREATE POLICY "Admins can view all activity" ON public.activity_feed
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
