-- Run this in Supabase SQL Editor
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TEXT;

-- Update existing April invoice for Gary with due date
UPDATE invoices SET due_date = '2026-04-01' WHERE month = 'April 2026';

-- Update any May invoices
UPDATE invoices SET due_date = '2026-05-01' WHERE month = 'May 2026';
