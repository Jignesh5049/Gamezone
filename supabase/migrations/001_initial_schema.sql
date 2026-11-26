-- Game Zone Management & Rental Dashboard
-- PostgreSQL / Supabase Initial Schema Migration (All 14 Tables)
-- Run in Supabase SQL Editor or via `supabase db push`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. staff
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  phone TEXT,
  pin_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. game_categories
CREATE TABLE IF NOT EXISTS game_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'gamepad',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. gaming_stations
CREATE TABLE IF NOT EXISTS gaming_stations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id TEXT NOT NULL REFERENCES game_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'disabled')),
  equipment_model TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(12, 2),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. pricing_rules
CREATE TABLE IF NOT EXISTS pricing_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id TEXT NOT NULL REFERENCES game_categories(id) ON DELETE CASCADE,
  station_id TEXT REFERENCES gaming_stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate_30min NUMERIC(10, 2) NOT NULL CHECK (rate_30min >= 0),
  rate_60min NUMERIC(10, 2) NOT NULL CHECK (rate_60min >= 0),
  custom_hourly_rate NUMERIC(10, 2),
  default_billing_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (default_billing_mode IN ('fixed', 'pay_as_you_play')),
  billing_increment_minutes INTEGER NOT NULL DEFAULT 30 CHECK (billing_increment_minutes IN (15, 30, 60)),
  offer_label TEXT,
  offer_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (offer_discount_percent >= 0 AND offer_discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  total_visits INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_code TEXT NOT NULL UNIQUE,
  group_booking_id TEXT,
  station_id TEXT NOT NULL REFERENCES gaming_stations(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  billing_mode TEXT NOT NULL CHECK (billing_mode IN ('fixed', 'pay_as_you_play')),
  billing_increment_minutes INTEGER NOT NULL DEFAULT 30 CHECK (billing_increment_minutes IN (15, 30, 60)),
  rate_30min NUMERIC(10, 2) NOT NULL,
  rate_60min NUMERIC(10, 2) NOT NULL,
  offer_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  planned_duration_minutes INTEGER,
  started_at TIMESTAMPTZ NOT NULL,
  expected_end_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  accumulated_paused_seconds INTEGER NOT NULL DEFAULT 0,
  billable_minutes INTEGER NOT NULL DEFAULT 0,
  base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  additional_charges NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_reason TEXT,
  discount_authorized_by TEXT REFERENCES staff(id) ON DELETE SET NULL,
  final_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  notes TEXT,
  cancel_reason TEXT,
  started_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  ended_by TEXT REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rule #1: One station cannot have two active/paused sessions simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_station
  ON sessions(station_id)
  WHERE status IN ('active', 'paused');

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions(customer_id);

-- 8. session_events
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  actor_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id, created_at);

-- 9. payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receipt_number TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'upi', 'card', 'other')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded')),
  reference_note TEXT,
  received_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);

-- 10. bookings
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_code TEXT NOT NULL UNIQUE,
  group_booking_id TEXT,
  station_id TEXT NOT NULL REFERENCES gaming_stations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  scheduled_start_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'cancelled', 'completed')),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_start ON bookings(scheduled_start_at);

-- 11. expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  expense_date DATE NOT NULL,
  notes TEXT,
  recorded_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. maintenance_records
CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_id TEXT NOT NULL REFERENCES gaming_stations(id) ON DELETE CASCADE,
  issue_title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  technician TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  recorded_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- 14. settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: For Supabase deployments, enable RLS on all tables and grant access via authenticated staff policies or server-side service role.
