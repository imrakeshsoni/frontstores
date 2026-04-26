-- Predefined products per customer.
-- Allows associating a fixed list of products with a customer so the POS
-- automatically filters the inventory search to only those products.
CREATE TABLE IF NOT EXISTS customer_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, customer_id, product_id)
);

ALTER TABLE customer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_products FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_customer_products ON customer_products
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_customer_products_customer ON customer_products(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_products_product  ON customer_products(tenant_id, product_id);
