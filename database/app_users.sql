-- Create app_users table for login
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'provider')),
  password_hash TEXT NOT NULL,
  provider_id TEXT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- Insert initial admin user (Will)
INSERT INTO app_users (email, name, role, password_hash, is_active) 
VALUES ('admin@tourinkohsamui.com', 'Will (Admin)', 'admin', 'admin2026', true)
ON CONFLICT (email) DO NOTHING;

-- Sample users for testing
INSERT INTO app_users (email, name, role, password_hash, is_active) VALUES
('manager@tourinkohsamui.com', 'Sarah Manager', 'manager', 'manager2026', true),
('staff@tourinkohsamui.com', 'Tom Staff', 'staff', 'staff2026', true)
ON CONFLICT (email) DO NOTHING;
