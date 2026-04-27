-- Migration 007: Force RLS for table owner + enable RLS on bill_sequences
-- Without FORCE ROW SECURITY, the PostgreSQL table owner (shoposphere user) bypasses
-- all RLS policies. This migration enforces policies for every role including the owner.

-- Enable RLS on bill_sequences (was missing from 001_initial_schema.sql)
ALTER TABLE bill_sequences ENABLE ROW LEVEL SECURITY;

-- Force RLS on all tenant-scoped tables so the app DB user cannot bypass policies
ALTER TABLE shops                  FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles               FORCE ROW LEVEL SECURITY;
ALTER TABLE roles                  FORCE ROW LEVEL SECURITY;
ALTER TABLE users                  FORCE ROW LEVEL SECURITY;
ALTER TABLE categories             FORCE ROW LEVEL SECURITY;
ALTER TABLE products               FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory              FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_movements        FORCE ROW LEVEL SECURITY;
ALTER TABLE customers              FORCE ROW LEVEL SECURITY;
ALTER TABLE suppliers              FORCE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders        FORCE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items   FORCE ROW LEVEL SECURITY;
ALTER TABLE orders                 FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items            FORCE ROW LEVEL SECURITY;
ALTER TABLE payments               FORCE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE bill_sequences         FORCE ROW LEVEL SECURITY;
