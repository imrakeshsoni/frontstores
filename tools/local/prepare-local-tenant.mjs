#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

const SYSTEM_PROFILES = {
  Owner: {
    is_system: true,
    permissions: {
      products: { read: true, write: true, delete: true, import: true, export: true },
      inventory: { read: true, write: true, adjust: true },
      orders: { read: true, write: true, void: true, discount: true },
      customers: { read: true, write: true, delete: true },
      suppliers: { read: true, write: true, delete: true },
      reports: { read: true, export: true },
      settings: { read: true, write: true },
      billing: { read: true, write: true },
      users: { read: true, write: true, delete: true },
    },
  },
  Manager: {
    is_system: true,
    permissions: {
      products: { read: true, write: true, delete: false, import: true, export: true },
      inventory: { read: true, write: true, adjust: true },
      orders: { read: true, write: true, void: true, discount: true },
      customers: { read: true, write: true, delete: false },
      suppliers: { read: true, write: true, delete: false },
      reports: { read: true, export: true },
      settings: { read: true, write: false },
      billing: { read: false, write: false },
      users: { read: true, write: false, delete: false },
    },
  },
  Cashier: {
    is_system: true,
    permissions: {
      products: { read: true, write: false, delete: false, import: false, export: false },
      inventory: { read: true, write: false, adjust: false },
      orders: { read: true, write: true, void: false, discount: false },
      customers: { read: true, write: true, delete: false },
      suppliers: { read: false, write: false, delete: false },
      reports: { read: false, export: false },
      settings: { read: false, write: false },
      billing: { read: false, write: false },
      users: { read: false, write: false, delete: false },
    },
  },
  Stockist: {
    is_system: true,
    permissions: {
      products: { read: true, write: true, delete: false, import: true, export: false },
      inventory: { read: true, write: true, adjust: true },
      orders: { read: true, write: false, void: false, discount: false },
      customers: { read: false, write: false, delete: false },
      suppliers: { read: true, write: true, delete: false },
      reports: { read: false, export: false },
      settings: { read: false, write: false },
      billing: { read: false, write: false },
      users: { read: false, write: false, delete: false },
    },
  },
};

const ROLE_HIERARCHY = [
  { name: 'Owner', level: 0, parent: null },
  { name: 'Manager', level: 1, parent: 'Owner' },
  { name: 'Cashier', level: 2, parent: 'Manager' },
  { name: 'Stockist', level: 2, parent: 'Manager' },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
    return extra === undefined ? base : extra;
  }
  const result = Array.isArray(base) ? [...base] : { ...(base ?? {}) };
  for (const [key, value] of Object.entries(extra)) {
    result[key] = deepMerge(result[key], value);
  }
  return result;
}

function resolveConfigPath(inputPath) {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

async function ensureProfile(client, tenantId, profileName) {
  const profileConfig = SYSTEM_PROFILES[profileName];
  const existing = await client.query(
    `SELECT id, permissions FROM profiles WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
    [tenantId, profileName],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE profiles
       SET is_system = $3, permissions = $4::jsonb, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [existing.rows[0].id, tenantId, profileConfig.is_system, JSON.stringify(profileConfig.permissions)],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO profiles (tenant_id, name, is_system, permissions)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [tenantId, profileName, profileConfig.is_system, JSON.stringify(profileConfig.permissions)],
  );
  return inserted.rows[0].id;
}

async function ensureRoles(client, tenantId) {
  const roleIds = {};

  for (const role of ROLE_HIERARCHY) {
    const parentRoleId = role.parent ? roleIds[role.parent] : null;
    const existing = await client.query(
      `SELECT id FROM roles WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
      [tenantId, role.name],
    );

    if (existing.rows[0]) {
      await client.query(
        `UPDATE roles
         SET parent_role_id = $3, level = $4, updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [existing.rows[0].id, tenantId, parentRoleId, role.level],
      );
      roleIds[role.name] = existing.rows[0].id;
      continue;
    }

    const inserted = await client.query(
      `INSERT INTO roles (tenant_id, name, parent_role_id, level)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenantId, role.name, parentRoleId, role.level],
    );
    roleIds[role.name] = inserted.rows[0].id;
  }

  return roleIds;
}

async function ensureUser(client, tenantId, shopId, userConfig, profileId, roleId) {
  const passwordHash = await bcrypt.hash(userConfig.password, 12);
  const existing = await client.query(
    `SELECT id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
    [tenantId, userConfig.email],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE users
       SET shop_id = $3,
           phone = $4,
           name = $5,
           password_hash = $6,
           profile_id = $7,
           role_id = $8,
           is_active = true,
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [
        existing.rows[0].id,
        tenantId,
        userConfig.shopScoped ? shopId : null,
        userConfig.phone ?? null,
        userConfig.name,
        passwordHash,
        profileId,
        roleId,
      ],
    );
    return { id: existing.rows[0].id, email: userConfig.email, password: userConfig.password, role: userConfig.role };
  }

  const inserted = await client.query(
    `INSERT INTO users (tenant_id, shop_id, email, phone, name, password_hash, profile_id, role_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     RETURNING id`,
    [
      tenantId,
      userConfig.shopScoped ? shopId : null,
      userConfig.email,
      userConfig.phone ?? null,
      userConfig.name,
      passwordHash,
      profileId,
      roleId,
    ],
  );

  return { id: inserted.rows[0].id, email: userConfig.email, password: userConfig.password, role: userConfig.role };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const defaultConfig = path.resolve(__dirname, 'templates/medical-store-parity.json');
  const configPath = resolveConfigPath(args.config ?? defaultConfig);
  const rawConfig = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(rawConfig);

  const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://shoposphere:shoposphere@localhost:5432/shoposphere';
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const tenantSlug = args['tenant-slug'] ?? config.tenant.slug;
  const tenantName = args['tenant-name'] ?? config.tenant.name;

  try {
    await client.query('BEGIN');

    let tenantRow = (
      await client.query(
        `SELECT id, settings, metadata FROM tenants WHERE slug = $1 LIMIT 1`,
        [tenantSlug],
      )
    ).rows[0];

    if (tenantRow) {
      const nextTenantSettings = deepMerge(tenantRow.settings ?? {}, config.tenant.settings ?? {});
      const nextTenantMetadata = deepMerge(tenantRow.metadata ?? {}, config.tenant.metadata ?? {});
      await client.query(
        `UPDATE tenants
         SET name = $2,
             plan = $3,
             status = 'active',
             settings = $4::jsonb,
             metadata = $5::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [tenantRow.id, tenantName, config.tenant.plan ?? 'starter', JSON.stringify(nextTenantSettings), JSON.stringify(nextTenantMetadata)],
      );
    } else {
      tenantRow = (
        await client.query(
          `INSERT INTO tenants (name, slug, plan, status, settings, metadata)
           VALUES ($1, $2, $3, 'active', $4::jsonb, $5::jsonb)
           RETURNING id, settings, metadata`,
          [
            tenantName,
            tenantSlug,
            config.tenant.plan ?? 'starter',
            JSON.stringify(config.tenant.settings ?? {}),
            JSON.stringify(config.tenant.metadata ?? {}),
          ],
        )
      ).rows[0];
    }

    const tenantId = tenantRow.id;
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

    let shopRow = (
      await client.query(
        `SELECT id, address, settings FROM shops WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [tenantId],
      )
    ).rows[0];

    if (shopRow) {
      const nextAddress = deepMerge(shopRow.address ?? {}, config.shop.address ?? {});
      const nextSettings = deepMerge(shopRow.settings ?? {}, config.shop.settings ?? {});
      await client.query(
        `UPDATE shops
         SET name = $2,
             type = $3,
             gst_number = $4,
             phone = $5,
             address = $6::jsonb,
             settings = $7::jsonb,
             is_active = true,
             updated_at = now()
         WHERE id = $1 AND tenant_id = $8`,
        [
          shopRow.id,
          config.shop.name,
          config.shop.type ?? 'medical-store',
          config.shop.gstNumber ?? null,
          config.shop.phone ?? null,
          JSON.stringify(nextAddress),
          JSON.stringify(nextSettings),
          tenantId,
        ],
      );
    } else {
      shopRow = (
        await client.query(
          `INSERT INTO shops (tenant_id, name, type, gst_number, phone, address, settings, is_active)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, true)
           RETURNING id, address, settings`,
          [
            tenantId,
            config.shop.name,
            config.shop.type ?? 'medical-store',
            config.shop.gstNumber ?? null,
            config.shop.phone ?? null,
            JSON.stringify(config.shop.address ?? {}),
            JSON.stringify(config.shop.settings ?? {}),
          ],
        )
      ).rows[0];
    }

    const shopId = shopRow.id;
    const profileIds = {};
    for (const profileName of Object.keys(SYSTEM_PROFILES)) {
      profileIds[profileName] = await ensureProfile(client, tenantId, profileName);
    }
    const roleIds = await ensureRoles(client, tenantId);

    const createdUsers = [];
    for (const userConfig of config.users ?? []) {
      const profileId = profileIds[userConfig.role];
      const roleId = roleIds[userConfig.role];
      if (!profileId || !roleId) {
        throw new Error(`Missing profile/role mapping for ${userConfig.role}`);
      }
      const userSummary = await ensureUser(client, tenantId, shopId, userConfig, profileId, roleId);
      createdUsers.push(userSummary);
    }

    const sequence = await client.query(
      `SELECT tenant_id FROM bill_sequences WHERE tenant_id = $1 AND shop_id = $2 LIMIT 1`,
      [tenantId, shopId],
    );
    if (sequence.rows[0]) {
      await client.query(
        `UPDATE bill_sequences
         SET prefix = $3, updated_at = now()
         WHERE tenant_id = $1 AND shop_id = $2`,
        [tenantId, shopId, config.billSequencePrefix ?? 'OD'],
      );
    } else {
      await client.query(
        `INSERT INTO bill_sequences (tenant_id, shop_id, prefix, last_number, current_period)
         VALUES ($1, $2, $3, 0, to_char(current_date, 'YYYYMM'))`,
        [tenantId, shopId, config.billSequencePrefix ?? 'OD'],
      );
    }

    await client.query('COMMIT');

    console.log('');
    console.log('Local tenant parity prepared.');
    console.log(`Tenant slug : ${tenantSlug}`);
    console.log(`Tenant name : ${tenantName}`);
    console.log(`Shop name   : ${config.shop.name}`);
    console.log(`Login URL   : http://localhost:3000/login?slug=${encodeURIComponent(tenantSlug)}`);
    console.log('');
    console.log('Local credentials:');
    for (const user of createdUsers) {
      console.log(`- ${user.role}: ${user.email} / ${user.password}`);
    }
    console.log('');
    console.log(`Config file : ${configPath}`);
    console.log(`Database    : ${databaseUrl}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
