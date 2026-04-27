import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

const TABLES = [
  'tenants',
  'shops',
  'users',
  'profiles',
  'roles',
  'products',
  'inventory',
  'customers',
  'suppliers',
  'purchase_orders',
  'orders',
  'payments',
  'stock_movements',
] as const;

type AdminTable = typeof TABLES[number];

const TABLE_COLUMNS: Record<AdminTable, string[]> = {
  tenants: ['id', 'name', 'slug', 'plan', 'status', 'created_at'],
  shops: ['id', 'tenant_id', 'name', 'type', 'phone', 'gst_number', 'is_active', 'created_at'],
  users: ['id', 'tenant_id', 'shop_id', 'email', 'phone', 'name', 'is_active', 'is_platform_admin', 'last_login', 'created_at'],
  profiles: ['id', 'tenant_id', 'name', 'is_system', 'permissions', 'created_at'],
  roles: ['id', 'tenant_id', 'name', 'parent_role_id', 'level', 'created_at'],
  products: ['id', 'tenant_id', 'shop_id', 'name', 'sku', 'barcode', 'price', 'mrp', 'is_active', 'created_at'],
  inventory: ['id', 'tenant_id', 'shop_id', 'product_id', 'batch_number', 'quantity', 'expiry_date', 'created_at'],
  customers: ['id', 'tenant_id', 'shop_id', 'name', 'phone', 'email', 'credit_balance', 'loyalty_points', 'created_at'],
  suppliers: ['id', 'tenant_id', 'name', 'phone', 'email', 'gst_number', 'is_active', 'created_at'],
  purchase_orders: ['id', 'tenant_id', 'supplier_id', 'status', 'total_amount', 'created_at'],
  orders: ['id', 'tenant_id', 'shop_id', 'customer_id', 'bill_number', 'status', 'total', 'payment_status', 'created_at'],
  payments: ['id', 'tenant_id', 'order_id', 'method', 'amount', 'status', 'created_at'],
  stock_movements: ['id', 'tenant_id', 'shop_id', 'product_id', 'movement_type', 'quantity', 'created_at'],
};

const SEARCH_COLUMNS: Partial<Record<AdminTable, string[]>> = {
  tenants: ['name', 'slug', 'status'],
  shops: ['name', 'type', 'phone', 'gst_number'],
  users: ['email', 'phone', 'name'],
  products: ['name', 'sku', 'barcode'],
  customers: ['name', 'phone', 'email'],
  suppliers: ['name', 'phone', 'email', 'gst_number'],
  orders: ['bill_number', 'status', 'payment_status'],
};

@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  tables() {
    return TABLES.map((name) => ({ name, columns: TABLE_COLUMNS[name] }));
  }

  async overview() {
    const [counts, revenue, tenantStatus, planMix, recentTenants, recentOrders, accessStats] =
      await Promise.all([
        this.dataSource.query(`
          SELECT
            (SELECT COUNT(*)::int FROM tenants) AS tenants,
            (SELECT COUNT(*)::int FROM shops) AS shops,
            (SELECT COUNT(*)::int FROM users) AS users,
            (SELECT COUNT(*)::int FROM products) AS products,
            (SELECT COUNT(*)::int FROM orders) AS orders,
            (SELECT COUNT(*)::int FROM customers) AS customers
        `),
        this.dataSource.query(`
          SELECT
            COALESCE(SUM(total), 0) AS total_revenue,
            COALESCE(SUM(CASE WHEN created_at >= now() - interval '30 days' THEN total ELSE 0 END), 0) AS revenue_30d
          FROM orders
        `),
        this.dataSource.query(`
          SELECT status, COUNT(*)::int AS count
          FROM tenants
          GROUP BY status
          ORDER BY count DESC, status ASC
        `),
        this.dataSource.query(`
          SELECT plan, COUNT(*)::int AS count
          FROM tenants
          GROUP BY plan
          ORDER BY count DESC, plan ASC
        `),
        this.dataSource.query(`
          SELECT
            t.id,
            t.name,
            t.slug,
            t.plan,
            t.status,
            t.created_at,
            COALESCE(shop_counts.shops, 0)::int AS shops,
            COALESCE(user_counts.users, 0)::int AS users
          FROM tenants t
          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS shops
            FROM shops
            GROUP BY tenant_id
          ) shop_counts ON shop_counts.tenant_id = t.id
          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS users
            FROM users
            GROUP BY tenant_id
          ) user_counts ON user_counts.tenant_id = t.id
          ORDER BY t.created_at DESC
          LIMIT 8
        `),
        this.dataSource.query(`
          SELECT
            o.id,
            o.bill_number,
            o.status,
            o.total,
            o.payment_status,
            o.created_at,
            t.name AS tenant_name,
            t.slug AS tenant_slug
          FROM orders o
          JOIN tenants t ON t.id = o.tenant_id
          ORDER BY o.created_at DESC
          LIMIT 8
        `),
        this.dataSource.query(`
          SELECT
            COUNT(*) FILTER (WHERE is_platform_admin = true)::int AS platform_admins,
            COUNT(*) FILTER (WHERE is_active = false)::int AS locked_users,
            COUNT(*) FILTER (WHERE last_login >= now() - interval '7 days')::int AS active_last_7d
          FROM users
        `),
      ]);

    return {
      counts: counts[0],
      totalRevenue: revenue[0]?.total_revenue ?? 0,
      revenue30d: revenue[0]?.revenue_30d ?? 0,
      tenantStatus,
      planMix,
      recentTenants,
      recentOrders,
      accessStats: accessStats[0] ?? {
        platform_admins: 0,
        locked_users: 0,
        active_last_7d: 0,
      },
    };
  }

  async tenants({
    page = 1,
    perPage = 12,
    search = '',
    status = '',
  }: {
    page?: number;
    perPage?: number;
    search?: string;
    status?: string;
  }) {
    const safePage = Math.max(1, page || 1);
    const safePerPage = Math.min(50, Math.max(6, perPage || 12));
    const offset = (safePage - 1) * safePerPage;

    const params: unknown[] = [];
    const filters: string[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      const ref = `$${params.length}`;
      filters.push(`(t.name ILIKE ${ref} OR t.slug ILIKE ${ref} OR t.plan ILIKE ${ref})`);
    }

    if (status.trim() && status !== 'all') {
      params.push(status.trim());
      filters.push(`t.status = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows, totalRows] = await Promise.all([
      this.dataSource.query(
        `
          SELECT
            t.id,
            t.name,
            t.slug,
            t.plan,
            t.status,
            t.created_at,
            COALESCE(shop_counts.shops, 0)::int AS shop_count,
            COALESCE(user_counts.users, 0)::int AS user_count,
            COALESCE(order_counts.orders, 0)::int AS order_count,
            COALESCE(order_counts.revenue, 0) AS revenue,
            COALESCE(last_order.last_order_at, t.created_at) AS last_activity_at
          FROM tenants t
          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS shops
            FROM shops
            GROUP BY tenant_id
          ) shop_counts ON shop_counts.tenant_id = t.id
          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS users
            FROM users
            GROUP BY tenant_id
          ) user_counts ON user_counts.tenant_id = t.id
          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
            FROM orders
            GROUP BY tenant_id
          ) order_counts ON order_counts.tenant_id = t.id
          LEFT JOIN (
            SELECT tenant_id, MAX(created_at) AS last_order_at
            FROM orders
            GROUP BY tenant_id
          ) last_order ON last_order.tenant_id = t.id
          ${where}
          ORDER BY last_activity_at DESC, t.created_at DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, safePerPage, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS total FROM tenants t ${where}`,
        params,
      ),
    ]);

    return {
      rows,
      meta: {
        page: safePage,
        perPage: safePerPage,
        total: totalRows[0]?.total ?? 0,
        totalPages: Math.max(1, Math.ceil((totalRows[0]?.total ?? 0) / safePerPage)),
      },
    };
  }

  async tenantDetail(tenantId: string) {
    const [tenant] = await this.dataSource.query(
      `
        SELECT id, name, slug, plan, status, settings, metadata, created_at, updated_at
        FROM tenants
        WHERE id = $1
        LIMIT 1
      `,
      [tenantId],
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [shops, users, recentOrders, metrics] = await Promise.all([
      this.dataSource.query(
        `
          SELECT id, name, type, phone, gst_number, is_active, created_at
          FROM shops
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT 10
        `,
        [tenantId],
      ),
      this.dataSource.query(
        `
          SELECT id, email, phone, name, is_active, is_platform_admin, last_login, created_at
          FROM users
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT 10
        `,
        [tenantId],
      ),
      this.dataSource.query(
        `
          SELECT id, bill_number, status, payment_status, total, created_at
          FROM orders
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT 10
        `,
        [tenantId],
      ),
      this.dataSource.query(
        `
          SELECT
            (SELECT COUNT(*)::int FROM shops WHERE tenant_id = $1) AS shops,
            (SELECT COUNT(*)::int FROM users WHERE tenant_id = $1) AS users,
            (SELECT COUNT(*)::int FROM orders WHERE tenant_id = $1) AS orders,
            (SELECT COUNT(*)::int FROM customers WHERE tenant_id = $1) AS customers,
            (SELECT COUNT(*)::int FROM products WHERE tenant_id = $1) AS products,
            (SELECT COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = $1) AS revenue,
            (SELECT MAX(created_at) FROM orders WHERE tenant_id = $1) AS last_order_at
        `,
        [tenantId],
      ),
    ]);

    return {
      tenant,
      metrics: metrics[0],
      shops,
      users,
      recentOrders,
    };
  }

  async updateTenantStatus(tenantId: string, status: string) {
    const allowed = ['active', 'suspended', 'churned'];
    if (!allowed.includes(status)) {
      throw new BadRequestException('Unsupported tenant status');
    }

    const result = await this.dataSource.query(
      `
        UPDATE tenants
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, name, slug, plan, status, updated_at
      `,
      [tenantId, status],
    );

    if (!result[0]) {
      throw new NotFoundException('Tenant not found');
    }

    return result[0];
  }

  async users({
    page = 1,
    perPage = 15,
    search = '',
    access = 'all',
  }: {
    page?: number;
    perPage?: number;
    search?: string;
    access?: string;
  }) {
    const safePage = Math.max(1, page || 1);
    const safePerPage = Math.min(50, Math.max(10, perPage || 15));
    const offset = (safePage - 1) * safePerPage;

    const params: unknown[] = [];
    const filters: string[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      const ref = `$${params.length}`;
      filters.push(
        `(u.email ILIKE ${ref} OR u.name ILIKE ${ref} OR COALESCE(u.phone, '') ILIKE ${ref} OR t.slug ILIKE ${ref})`,
      );
    }

    if (access === 'platform-admins') {
      filters.push('u.is_platform_admin = true');
    } else if (access === 'locked') {
      filters.push('u.is_active = false');
    } else if (access === 'inactive') {
      filters.push(`(u.last_login IS NULL OR u.last_login < now() - interval '30 days')`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows, totalRows] = await Promise.all([
      this.dataSource.query(
        `
          SELECT
            u.id,
            u.tenant_id,
            u.shop_id,
            u.email,
            u.phone,
            u.name,
            u.is_active,
            u.is_platform_admin,
            u.last_login,
            u.created_at,
            t.name AS tenant_name,
            t.slug AS tenant_slug,
            t.status AS tenant_status
          FROM users u
          JOIN tenants t ON t.id = u.tenant_id
          ${where}
          ORDER BY u.created_at DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, safePerPage, offset],
      ),
      this.dataSource.query(
        `
          SELECT COUNT(*)::int AS total
          FROM users u
          JOIN tenants t ON t.id = u.tenant_id
          ${where}
        `,
        params,
      ),
    ]);

    return {
      rows,
      meta: {
        page: safePage,
        perPage: safePerPage,
        total: totalRows[0]?.total ?? 0,
        totalPages: Math.max(1, Math.ceil((totalRows[0]?.total ?? 0) / safePerPage)),
      },
    };
  }

  async updateUserAccess(
    userId: string,
    access: { isActive?: boolean; isPlatformAdmin?: boolean },
  ) {
    if (
      typeof access.isActive !== 'boolean' &&
      typeof access.isPlatformAdmin !== 'boolean'
    ) {
      throw new BadRequestException('No access fields provided');
    }

    const sets: string[] = [];
    const params: unknown[] = [userId];

    if (typeof access.isActive === 'boolean') {
      params.push(access.isActive);
      sets.push(`is_active = $${params.length}`);
    }

    if (typeof access.isPlatformAdmin === 'boolean') {
      params.push(access.isPlatformAdmin);
      sets.push(`is_platform_admin = $${params.length}`);
    }

    sets.push('updated_at = now()');

    const result = await this.dataSource.query(
      `
        UPDATE users
        SET ${sets.join(', ')}
        WHERE id = $1
        RETURNING id, tenant_id, email, name, is_active, is_platform_admin, updated_at
      `,
      params,
    );

    if (!result[0]) {
      throw new NotFoundException('User not found');
    }

    return result[0];
  }

  async resetUserPassword(userId: string, password: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const result = await this.dataSource.query(
      `
        UPDATE users
        SET password_hash = crypt($2, gen_salt('bf', 12)), updated_at = now()
        WHERE id = $1
        RETURNING id, email, name, updated_at
      `,
      [userId, password],
    );

    if (!result[0]) {
      throw new NotFoundException('User not found');
    }

    return {
      ...result[0],
      temporaryPassword: password,
    };
  }

  async table(name: string, page = 1, perPage = 25, search = '') {
    if (!TABLES.includes(name as AdminTable)) {
      throw new BadRequestException('Unsupported admin table');
    }

    const table = name as AdminTable;
    const safePage = Math.max(1, page || 1);
    const safePerPage = Math.min(100, Math.max(10, perPage || 25));
    const offset = (safePage - 1) * safePerPage;
    const columns = TABLE_COLUMNS[table];
    const params: unknown[] = [];
    let where = '';

    if (search.trim() && SEARCH_COLUMNS[table]?.length) {
      params.push(`%${search.trim()}%`);
      where = `WHERE ${SEARCH_COLUMNS[table]!
        .map((column) => `${column}::text ILIKE $1`)
        .join(' OR ')}`;
    }

    const countParamOffset = params.length;
    const [rows, totalRows] = await Promise.all([
      this.dataSource.query(
        `SELECT ${columns.join(', ')} FROM ${table} ${where} ORDER BY created_at DESC NULLS LAST LIMIT $${countParamOffset + 1} OFFSET $${countParamOffset + 2}`,
        [...params, safePerPage, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM ${table} ${where}`, params),
    ]);

    return {
      table,
      columns,
      rows,
      meta: {
        page: safePage,
        perPage: safePerPage,
        total: totalRows[0]?.total ?? 0,
        totalPages: Math.max(1, Math.ceil((totalRows[0]?.total ?? 0) / safePerPage)),
      },
    };
  }
}
