import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ContextService {
  constructor(private readonly dataSource: DataSource) {}

  async bootstrap(tenantId: string, userId: string, requestedShopId?: string) {
    const user = await this.dataSource.query(
      `SELECT u.id, u.name, u.email, u.shop_id, p.permissions
       FROM users u
       LEFT JOIN profiles p ON p.id = u.profile_id
       WHERE u.id = $1 AND u.tenant_id = $2
       LIMIT 1`,
      [userId, tenantId],
    );

    const tenant = await this.dataSource.query(
      `SELECT id, name, slug, plan, status, settings, metadata
       FROM tenants
       WHERE id = $1
       LIMIT 1`,
      [tenantId],
    );

    const shops = await this.dataSource.query(
      `SELECT id, name, type, phone, gst_number, address, settings
       FROM shops
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY created_at ASC`,
      [tenantId],
    );

    const selectedShop =
      shops.find((shop: any) => shop.id === requestedShopId) ??
      shops.find((shop: any) => shop.id === user[0]?.shop_id) ??
      shops[0] ??
      null;

    const counts = await this.dataSource.query(
      `SELECT
        (SELECT COUNT(*) FROM products WHERE tenant_id = $1 AND is_active = true) AS products,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = $1) AS customers,
        (SELECT COUNT(*) FROM suppliers WHERE tenant_id = $1 AND is_active = true) AS suppliers,
        (SELECT COUNT(*) FROM orders WHERE tenant_id = $1) AS orders`,
      [tenantId],
    );

    return {
      user: {
        id: user[0]?.id,
        name: user[0]?.name,
        email: user[0]?.email,
        tenantId,
        permissions: user[0]?.permissions ?? {},
      },
      tenant: tenant[0] ?? null,
      shops,
      activeShopId: selectedShop?.id ?? null,
      counts: counts[0] ?? { products: 0, customers: 0, suppliers: 0, orders: 0 },
    };
  }

  async getSettings(tenantId: string, shopId?: string) {
    const [tenant] = await this.dataSource.query(
      `SELECT id, name, slug, plan, status, settings, metadata
       FROM tenants
       WHERE id = $1
       LIMIT 1`,
      [tenantId],
    );

    const [shop] = shopId
      ? await this.dataSource.query(
          `SELECT id, name, type, phone, gst_number, address, settings
           FROM shops
           WHERE tenant_id = $1 AND id = $2
           LIMIT 1`,
          [tenantId, shopId],
        )
      : [null];

    return { tenant, shop };
  }

  async updateSettings(
    tenantId: string,
    shopId: string | undefined,
    dto: {
      tenantName: string;
      plan?: string;
      tenantSettings?: Record<string, unknown>;
      shopName?: string;
      shopType?: string;
      phone?: string;
      gstNumber?: string;
      address?: Record<string, unknown>;
      shopSettings?: Record<string, unknown>;
    },
  ) {
    const [tenant] = await this.dataSource.query(
      `UPDATE tenants
       SET name = $2,
           plan = COALESCE($3, plan),
           settings = COALESCE(settings, '{}'::jsonb) || $4::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, slug, plan, status, settings, metadata`,
      [
        tenantId,
        dto.tenantName,
        dto.plan ?? null,
        JSON.stringify(dto.tenantSettings ?? {}),
      ],
    );

    const [shop] = shopId
      ? await this.dataSource.query(
          `UPDATE shops
           SET name = COALESCE($3, name),
               type = COALESCE($4, type),
               phone = COALESCE($5, phone),
               gst_number = COALESCE($6, gst_number),
               address = COALESCE($7::jsonb, address),
               settings = COALESCE(settings, '{}'::jsonb) || $8::jsonb,
               updated_at = NOW()
           WHERE tenant_id = $1 AND id = $2
           RETURNING id, name, type, phone, gst_number, address, settings`,
          [
            tenantId,
            shopId,
            dto.shopName ?? null,
            dto.shopType ?? null,
            dto.phone ?? null,
            dto.gstNumber ?? null,
            dto.address ? JSON.stringify(dto.address) : null,
            JSON.stringify(dto.shopSettings ?? {}),
          ],
        )
      : [null];

    return { tenant, shop };
  }

}
