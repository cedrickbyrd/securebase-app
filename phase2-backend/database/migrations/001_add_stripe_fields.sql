-- Migration: Add Stripe subscription fields to customers table
-- Date: 2026-01-27
-- Purpose: Support self-service signup workflow with Stripe integration

-- Add new columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP;

-- Add index for subscription status lookups
CREATE INDEX IF NOT EXISTS idx_customers_subscription_status ON customers(subscription_status);
CREATE INDEX IF NOT EXISTS idx_customers_trial_end_date ON customers(trial_end_date);

-- Add Stripe invoice fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Create index for Stripe invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);

-- Make AWS Organization fields nullable (will be populated after infrastructure provisioning)
ALTER TABLE customers 
ALTER COLUMN aws_org_id DROP NOT NULL,
ALTER COLUMN aws_management_account_id DROP NOT NULL;

-- Comment on new fields
COMMENT ON COLUMN customers.stripe_subscription_id IS 'Stripe subscription ID from checkout.session.completed webhook';
COMMENT ON COLUMN customers.subscription_status IS 'Current subscription status: active, trialing, past_due, canceled, etc.';
COMMENT ON COLUMN customers.trial_end_date IS 'End date of free trial period (30 days from signup)';
COMMENT ON COLUMN invoices.stripe_invoice_id IS 'Stripe invoice ID for payment tracking';
COMMENT ON COLUMN invoices.stripe_payment_intent_id IS 'Stripe payment intent ID for transaction reconciliation';
