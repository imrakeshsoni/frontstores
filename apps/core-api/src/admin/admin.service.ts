import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

const TABLES = [
  'tenants', 'shops', 'users', 'profiles', 'roles', 'products',
  'inventory', 'customers', 'suppliers', 'purchase_orders',
  'orders', 'payments', 'stock_movements',
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
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

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
        this.dataSource.query(`SELECT status, COUNT(*)::int AS count FROM tenants GROUP BY status ORDER BY count DESC`),
        this.dataSource.query(`SELECT plan, COUNT(*)::int AS count FROM tenants GROUP BY plan ORDER BY count DESC`),
        this.dataSource.query(`
          SELECT t.id, t.name, t.slug, t.plan, t.status, t.created_at,
            COALESCE(sc.shops,0)::int AS shops, COALESCE(uc.users,0)::int AS users
          FROM tenants t
          LEFT JOIN (SELECT tenant_id, COUNT(*) AS shops FROM shops GROUP BY tenant_id) sc ON sc.tenant_id=t.id
          LEFT JOIN (SELECT tenant_id, COUNT(*) AS users FROM users GROUP BY tenant_id) uc ON uc.tenant_id=t.id
          ORDER BY t.created_at DESC LIMIT 8
        `),
        this.dataSource.query(`
          SELECT o.id, o.bill_number, o.status, o.total, o.payment_status, o.created_at,
            t.name AS tenant_name, t.slug AS tenant_slug
          FROM orders o JOIN tenants t ON t.id=o.tenant_id ORDER BY o.created_at DESC LIMIT 8
        `),
        this.dataSource.query(`
          SELECT
            COUNT(*) FILTER (WHERE is_platform_admin=true)::int AS platform_admins,
            COUNT(*) FILTER (WHERE is_active=false)::int AS locked_users,
            COUNT(*) FILTER (WHERE last_login >= now()-interval '7 days')::int AS active_last_7d
          FROM users
        `),
      ]);

    return {
      counts: counts[0],
      totalRevenue: revenue[0]?.total_revenue ?? 0,
      revenue30d: revenue[0]?.revenue_30d ?? 0,
      tenantStatus, planMix, recentTenants, recentOrders,
      accessStats: accessStats[0] ?? { platform_admins: 0, locked_users: 0, active_last_7d: 0 },
    };
  }

  async apps() {
    return this.dataSource.query(`
      SELECT COALESCE(s.type, 'unknown') AS type,
        COUNT(DISTINCT s.tenant_id)::int AS tenant_count,
        COUNT(*)::int AS shop_count,
        COUNT(*) FILTER (WHERE t.status='active')::int AS active_count,
        COUNT(*) FILTER (WHERE t.status='suspended')::int AS suspended_count
      FROM shops s JOIN tenants t ON t.id=s.tenant_id
      GROUP BY s.type ORDER BY shop_count DESC
    `);
  }

  async tenants({ page=1, perPage=12, search='', status='' }: { page?:number; perPage?:number; search?:string; status?:string }) {
    const safePage = Math.max(1, page||1);
    const safePerPage = Math.min(50, Math.max(6, perPage||12));
    const offset = (safePage-1)*safePerPage;
    const params: unknown[] = [];
    const filters: string[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      const ref = `$${params.length}`;
      filters.push(`(t.name ILIKE ${ref} OR t.slug ILIKE ${ref} OR t.plan ILIKE ${ref})`);
    }
    if (status.trim() && status !== 'all') {
      params.push(status.trim());
      filters.push(`t.status=$${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows, totalRows] = await Promise.all([
      this.dataSource.query(
        `SELECT t.id, t.name, t.slug, t.plan, t.status, t.created_at,
          COALESCE(sc.shops,0)::int AS shop_count, COALESCE(uc.users,0)::int AS user_count,
          COALESCE(oc.orders,0)::int AS order_count, COALESCE(oc.revenue,0) AS revenue,
          COALESCE(lo.last_order_at, t.created_at) AS last_activity_at
         FROM tenants t
         LEFT JOIN (SELECT tenant_id, COUNT(*) AS shops FROM shops GROUP BY tenant_id) sc ON sc.tenant_id=t.id
         LEFT JOIN (SELECT tenant_id, COUNT(*) AS users FROM users GROUP BY tenant_id) uc ON uc.tenant_id=t.id
         LEFT JOIN (SELECT tenant_id, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders GROUP BY tenant_id) oc ON oc.tenant_id=t.id
         LEFT JOIN (SELECT tenant_id, MAX(created_at) AS last_order_at FROM orders GROUP BY tenant_id) lo ON lo.tenant_id=t.id
         ${where} ORDER BY last_activity_at DESC, t.created_at DESC
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, safePerPage, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM tenants t ${where}`, params),
    ]);

    return { rows, meta: { page: safePage, perPage: safePerPage, total: totalRows[0]?.total??0, totalPages: Math.max(1, Math.ceil((totalRows[0]?.total??0)/safePerPage)) } };
  }

  async createTenant(data: { name: string; slug: string; plan?: string; shopType?: string }) {
    const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const [existing] = await this.dataSource.query(`SELECT id FROM tenants WHERE slug=$1 LIMIT 1`, [slug]);
    if (existing) throw new BadRequestException('Tenant slug already taken');

    const [tenant] = await this.dataSource.query(
      `INSERT INTO tenants (name, slug, plan, status) VALUES ($1,$2,$3,'active') RETURNING id, name, slug, plan, status, created_at`,
      [data.name.trim(), slug, data.plan??'starter'],
    );
    if (data.shopType) {
      await this.dataSource.query(`INSERT INTO shops (tenant_id, name, type, is_active) VALUES ($1,$2,$3,true)`, [tenant.id, data.name.trim(), data.shopType]);
    }
    return tenant;
  }

  async tenantDetail(tenantId: string) {
    const [tenant] = await this.dataSource.query(
      `SELECT id, name, slug, plan, status, settings, metadata, COALESCE(feature_flags,'{}') AS feature_flags, created_at, updated_at FROM tenants WHERE id=$1 LIMIT 1`,
      [tenantId],
    );
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [shops, users, recentOrders, metrics] = await Promise.all([
      this.dataSource.query(`SELECT id, name, type, phone, gst_number, is_active, created_at FROM shops WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10`, [tenantId]),
      this.dataSource.query(`SELECT id, email, phone, name, is_active, is_platform_admin, last_login, created_at FROM users WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10`, [tenantId]),
      this.dataSource.query(`SELECT id, bill_number, status, payment_status, total, created_at FROM orders WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10`, [tenantId]),
      this.dataSource.query(`
        SELECT
          (SELECT COUNT(*)::int FROM shops WHERE tenant_id=$1) AS shops,
          (SELECT COUNT(*)::int FROM users WHERE tenant_id=$1) AS users,
          (SELECT COUNT(*)::int FROM orders WHERE tenant_id=$1) AS orders,
          (SELECT COUNT(*)::int FROM customers WHERE tenant_id=$1) AS customers,
          (SELECT COUNT(*)::int FROM products WHERE tenant_id=$1) AS products,
          (SELECT COALESCE(SUM(total),0) FROM orders WHERE tenant_id=$1) AS revenue,
          (SELECT MAX(created_at) FROM orders WHERE tenant_id=$1) AS last_order_at
      `, [tenantId]),
    ]);

    return { tenant, metrics: metrics[0], shops, users, recentOrders };
  }

  async updateTenantStatus(tenantId: string, status: string) {
    if (!['active','suspended','churned'].includes(status)) throw new BadRequestException('Unsupported tenant status');
    const result = await this.dataSource.query(
      `UPDATE tenants SET status=$2, updated_at=now() WHERE id=$1 RETURNING id, name, slug, plan, status, updated_at`,
      [tenantId, status],
    );
    if (!result[0]) throw new NotFoundException('Tenant not found');
    return result[0];
  }

  async updateTenantPlan(tenantId: string, plan: string) {
    if (!['free','starter','pro','enterprise'].includes(plan)) throw new BadRequestException('Unsupported plan');
    const result = await this.dataSource.query(
      `UPDATE tenants SET plan=$2, updated_at=now() WHERE id=$1 RETURNING id, name, slug, plan, status, updated_at`,
      [tenantId, plan],
    );
    if (!result[0]) throw new NotFoundException('Tenant not found');
    return result[0];
  }

  async getTenantFlags(tenantId: string) {
    const [row] = await this.dataSource.query(`SELECT COALESCE(feature_flags,'{}') AS feature_flags FROM tenants WHERE id=$1`, [tenantId]);
    if (!row) throw new NotFoundException('Tenant not found');
    return row.feature_flags ?? {};
  }

  async updateTenantFlags(tenantId: string, flags: Record<string, boolean>) {
    const [row] = await this.dataSource.query(
      `UPDATE tenants SET feature_flags=COALESCE(feature_flags,'{}') || $2::jsonb, updated_at=now() WHERE id=$1 RETURNING COALESCE(feature_flags,'{}') AS feature_flags`,
      [tenantId, JSON.stringify(flags)],
    );
    if (!row) throw new NotFoundException('Tenant not found');
    return row.feature_flags ?? {};
  }

  async getTenantNotes(tenantId: string) {
    return this.dataSource.query(`SELECT id, tenant_id, content, author, created_at FROM admin_tenant_notes WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
  }

  async addTenantNote(tenantId: string, content: string, author: string) {
    const [row] = await this.dataSource.query(
      `INSERT INTO admin_tenant_notes (tenant_id, content, author) VALUES ($1,$2,$3) RETURNING id, tenant_id, content, author, created_at`,
      [tenantId, content.trim(), author],
    );
    return row;
  }

  async deleteTenantNote(noteId: string) {
    const result = await this.dataSource.query(`DELETE FROM admin_tenant_notes WHERE id=$1 RETURNING id`, [noteId]);
    if (!result[0]) throw new NotFoundException('Note not found');
    return { deleted: true };
  }

  async getAnnouncements() {
    return this.dataSource.query(`SELECT id, title, body, type, target_plan, is_active, created_at, updated_at FROM admin_announcements ORDER BY created_at DESC LIMIT 50`);
  }

  async createAnnouncement(data: { title: string; body: string; type?: string; target_plan?: string }) {
    const [row] = await this.dataSource.query(
      `INSERT INTO admin_announcements (title, body, type, target_plan) VALUES ($1,$2,$3,$4) RETURNING id, title, body, type, target_plan, is_active, created_at`,
      [data.title, data.body, data.type??'info', data.target_plan??null],
    );
    return row;
  }

  async statsMrr() {
    const [monthly, byPlan] = await Promise.all([
      this.dataSource.query(`
        SELECT to_char(date_trunc('month', o.created_at),'YYYY-MM') AS month,
          COALESCE(SUM(o.total),0)::numeric AS revenue,
          COUNT(DISTINCT o.tenant_id)::int AS active_tenants
        FROM orders o WHERE o.created_at >= now()-interval '12 months'
        GROUP BY 1 ORDER BY 1
      `),
      this.dataSource.query(`
        SELECT t.plan, COUNT(DISTINCT t.id)::int AS tenants, COALESCE(SUM(o.total),0)::numeric AS revenue
        FROM tenants t
        LEFT JOIN orders o ON o.tenant_id=t.id AND o.created_at >= date_trunc('month', now())
        GROUP BY t.plan ORDER BY revenue DESC
      `),
    ]);
    return { monthly, byPlan };
  }

  async statsFunnel() {
    const [signups, byPlan, retention] = await Promise.all([
      this.dataSource.query(`
        SELECT to_char(date_trunc('week', created_at),'YYYY-MM-DD') AS week, COUNT(*)::int AS signups
        FROM tenants WHERE created_at >= now()-interval '12 weeks'
        GROUP BY 1 ORDER BY 1
      `),
      this.dataSource.query(`SELECT plan, COUNT(*)::int AS count FROM tenants WHERE status='active' GROUP BY plan ORDER BY count DESC`),
      this.dataSource.query(`
        SELECT COUNT(*) FILTER (WHERE status='active')::int AS active,
          COUNT(*) FILTER (WHERE status='suspended')::int AS suspended,
          COUNT(*) FILTER (WHERE status='churned')::int AS churned,
          COUNT(*)::int AS total FROM tenants
      `),
    ]);
    return { signups, byPlan, retention: retention[0] };
  }

  async audit({ page=1, perPage=25, action='', search='' }: { page?:number; perPage?:number; action?:string; search?:string }) {
    const safePage = Math.max(1, page||1);
    const safePerPage = Math.min(100, Math.max(10, perPage||25));
    const offset = (safePage-1)*safePerPage;
    const params: unknown[] = [];
    const filters: string[] = [];

    if (action.trim() && action !== 'all') {
      params.push(action.trim());
      filters.push(`action=$${params.length}`);
    }
    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      const ref = `$${params.length}`;
      filters.push(`(admin_email ILIKE ${ref} OR action ILIKE ${ref} OR target_type ILIKE ${ref})`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows, totalRows] = await Promise.all([
      this.dataSource.query(
        `SELECT id, admin_id AS actor_id, admin_email AS actor_email, action, target_type, target_id, details AS metadata, ip_address, created_at
         FROM admin_audit_logs ${where} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, safePerPage, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM admin_audit_logs ${where}`, params),
    ]);

    return { rows, meta: { page: safePage, perPage: safePerPage, total: totalRows[0]?.total??0, totalPages: Math.max(1, Math.ceil((totalRows[0]?.total??0)/safePerPage)) } };
  }

  async health() {
    const [dbCheck] = await this.dataSource.query(`SELECT 1 AS ok`);
    const services = [
      { name: 'auth-service', port: 3001 },
      { name: 'tenant-service', port: 3002 },
      { name: 'core-api', port: 3003 },
      { name: 'order-service', port: 3007 },
      { name: 'report-service', port: 3008 },
    ];
    return { database: dbCheck?.ok===1 ? 'up' : 'down', services: services.map((s) => ({ ...s, status: 'up' })), timestamp: new Date().toISOString() };
  }

  async gcpMetrics() {
    const [tableStats] = await this.dataSource.query(`
      SELECT (SELECT COUNT(*)::int FROM tenants) AS tenants,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM orders) AS orders,
        (SELECT COUNT(*)::int FROM products) AS products
    `);
    return {
      cloudRun: ['auth-service','tenant-service','core-api','order-service','report-service'].map((service) => ({ service, requestCount: 0, errorRate: 0, latencyP99: 0 })),
      cloudSql: { cpuUtilization: 0, memoryUtilization: 0, diskUtilization: 0, connections: 0 },
      dbStats: tableStats,
    };
  }

  async impersonate(userId: string, adminEmail: string) {
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.name, u.tenant_id, u.is_active, u.profile_id, u.role_id, u.shop_id,
              t.slug AS tenant_slug, t.status AS tenant_status
       FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1 LIMIT 1`,
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');
    if (!user.is_active) throw new BadRequestException('User is not active');

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, tenantId: user.tenant_id, tenantSlug: user.tenant_slug, shopId: user.shop_id, profileId: user.profile_id, roleId: user.role_id, isPlatformAdmin: false, impersonatedBy: adminEmail },
      { secret: process.env.JWT_SECRET, expiresIn: '1h' },
    );

    await this.dataSource.query(
      `INSERT INTO admin_audit_logs (admin_email, action, target_type, target_id, details) VALUES ($1,'impersonate','user',$2,$3)`,
      [adminEmail, userId, JSON.stringify({ impersonated_email: user.email, tenant_slug: user.tenant_slug })],
    );

    return { accessToken, tenantSlug: user.tenant_slug, user: { id: user.id, email: user.email, name: user.name } };
  }

  async addTenantUser(tenantId: string, data: { email: string; name: string; phone?: string }) {
    const [tenant] = await this.dataSource.query(`SELECT id FROM tenants WHERE id=$1 LIMIT 1`, [tenantId]);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [existing] = await this.dataSource.query(`SELECT id FROM users WHERE tenant_id=$1 AND email=$2 LIMIT 1`, [tenantId, data.email]);
    if (existing) throw new BadRequestException('User with this email already exists in this tenant');

    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const [user] = await this.dataSource.query(
      `INSERT INTO users (tenant_id, email, name, phone, password_hash, is_active) VALUES ($1,$2,$3,$4,crypt($5, gen_salt('bf',12)),true) RETURNING id, tenant_id, email, name, phone, is_active, created_at`,
      [tenantId, data.email, data.name, data.phone??null, tempPassword],
    );
    return { ...user, temporaryPassword: tempPassword };
  }

  async users({ page=1, perPage=15, search='', access='all' }: { page?:number; perPage?:number; search?:string; access?:string }) {
    const safePage = Math.max(1, page||1);
    const safePerPage = Math.min(50, Math.max(10, perPage||15));
    const offset = (safePage-1)*safePerPage;
    const params: unknown[] = [];
    const filters: string[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      const ref = `$${params.length}`;
      filters.push(`(u.email ILIKE ${ref} OR u.name ILIKE ${ref} OR COALESCE(u.phone,'') ILIKE ${ref} OR t.slug ILIKE ${ref})`);
    }
    if (access==='platform-admins') filters.push('u.is_platform_admin=true');
    else if (access==='locked') filters.push('u.is_active=false');
    else if (access==='inactive') filters.push(`(u.last_login IS NULL OR u.last_login < now()-interval '30 days')`);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows, totalRows] = await Promise.all([
      this.dataSource.query(
        `SELECT u.id, u.tenant_id, u.shop_id, u.email, u.phone, u.name, u.is_active, u.is_platform_admin, u.last_login, u.created_at,
                t.name AS tenant_name, t.slug AS tenant_slug, t.status AS tenant_status
         FROM users u JOIN tenants t ON t.id=u.tenant_id ${where} ORDER BY u.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, safePerPage, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM users u JOIN tenants t ON t.id=u.tenant_id ${where}`, params),
    ]);

    return { rows, meta: { page: safePage, perPage: safePerPage, total: totalRows[0]?.total??0, totalPages: Math.max(1, Math.ceil((totalRows[0]?.total??0)/safePerPage)) } };
  }

  async updateUserAccess(userId: string, access: { isActive?: boolean; isPlatformAdmin?: boolean }) {
    if (typeof access.isActive !== 'boolean' && typeof access.isPlatformAdmin !== 'boolean') throw new BadRequestException('No access fields provided');
    const sets: string[] = [];
    const params: unknown[] = [userId];
    if (typeof access.isActive === 'boolean') { params.push(access.isActive); sets.push(`is_active=$${params.length}`); }
    if (typeof access.isPlatformAdmin === 'boolean') { params.push(access.isPlatformAdmin); sets.push(`is_platform_admin=$${params.length}`); }
    sets.push('updated_at=now()');
    const result = await this.dataSource.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id=$1 RETURNING id, tenant_id, email, name, is_active, is_platform_admin, updated_at`,
      params,
    );
    if (!result[0]) throw new NotFoundException('User not found');
    return result[0];
  }

  async resetUserPassword(userId: string, password: string) {
    if (!password || password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const result = await this.dataSource.query(
      `UPDATE users SET password_hash=crypt($2, gen_salt('bf',12)), updated_at=now() WHERE id=$1 RETURNING id, email, name, updated_at`,
      [userId, password],
    );
    if (!result[0]) throw new NotFoundException('User not found');
    return { ...result[0], temporaryPassword: password };
  }

  async table(name: string, page=1, perPage=25, search='') {
    if (!TABLES.includes(name as AdminTable)) throw new BadRequestException('Unsupported admin table');
    const table = name as AdminTable;
    const safePage = Math.max(1, page||1);
    const safePerPage = Math.min(100, Math.max(10, perPage||25));
    const offset = (safePage-1)*safePerPage;
    const columns = TABLE_COLUMNS[table];
    const params: unknown[] = [];
    let where = '';
    if (search.trim() && SEARCH_COLUMNS[table]?.length) {
      params.push(`%${search.trim()}%`);
      where = `WHERE ${SEARCH_COLUMNS[table]!.map((c) => `${c}::text ILIKE $1`).join(' OR ')}`;
    }
    const n = params.length;
    const [rows, totalRows] = await Promise.all([
      this.dataSource.query(`SELECT ${columns.join(', ')} FROM ${table} ${where} ORDER BY created_at DESC NULLS LAST LIMIT $${n+1} OFFSET $${n+2}`, [...params, safePerPage, offset]),
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM ${table} ${where}`, params),
    ]);
    return { table, columns, rows, meta: { page: safePage, perPage: safePerPage, total: totalRows[0]?.total??0, totalPages: Math.max(1, Math.ceil((totalRows[0]?.total??0)/safePerPage)) } };
  }
}
