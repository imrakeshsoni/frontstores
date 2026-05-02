#!/usr/bin/env node

import process from 'node:process';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

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

function runGcloud(args) {
  return execFileSync('gcloud', args, { encoding: 'utf8' }).trim();
}

function resolveProdDbUrl(args) {
  if (args['source-db-url']) return args['source-db-url'];
  if (process.env.PROD_DATABASE_URL) return process.env.PROD_DATABASE_URL;

  const projectId = process.env.PROJECT_ID || 'cloudystores';
  const region = process.env.REGION || 'asia-south1';
  const dbInstance = process.env.DB_INSTANCE || 'shoposphere-sql';
  const dbName = process.env.DB_NAME || 'shoposphere';
  const dbUser = process.env.DB_USER || 'shoposphere';
  const dbPassword = runGcloud([
    'secrets',
    'versions',
    'access',
    'latest',
    '--secret=shoposphere-db-password',
    `--project=${projectId}`,
  ]);
  const sqlIp = runGcloud([
    'sql',
    'instances',
    'describe',
    dbInstance,
    `--project=${projectId}`,
    '--format=value(ipAddresses[0].ipAddress)',
  ]);
  return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${sqlIp}:5432/${encodeURIComponent(dbName)}`;
}

function passwordForUser(user, defaultPassword) {
  const safeLocal = user.email.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase();
  return `${defaultPassword}:${safeLocal}`;
}

async function queryRows(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function syncTenant(localClient, tenant, shopRows, profileRows, roleRows, userRows, billSequenceRows, passwordBase) {
  await localClient.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant.id]);

  const existingTenant = await localClient.query(`SELECT id FROM tenants WHERE id = $1 LIMIT 1`, [tenant.id]);
  if (existingTenant.rows[0]) {
    await localClient.query(
      `UPDATE tenants
       SET name = $2, slug = $3, plan = $4, status = $5, settings = $6::jsonb, metadata = $7::jsonb, updated_at = now()
       WHERE id = $1`,
      [tenant.id, tenant.name, tenant.slug, tenant.plan, tenant.status, JSON.stringify(tenant.settings ?? {}), JSON.stringify(tenant.metadata ?? {})],
    );
  } else {
    await localClient.query(
      `INSERT INTO tenants (id, name, slug, plan, status, settings, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
      [
        tenant.id,
        tenant.name,
        tenant.slug,
        tenant.plan,
        tenant.status,
        JSON.stringify(tenant.settings ?? {}),
        JSON.stringify(tenant.metadata ?? {}),
        tenant.created_at,
        tenant.updated_at,
      ],
    );
  }

  for (const shop of shopRows) {
    const existing = await localClient.query(`SELECT id FROM shops WHERE id = $1 LIMIT 1`, [shop.id]);
    if (existing.rows[0]) {
      await localClient.query(
        `UPDATE shops
         SET name = $2, type = $3, gst_number = $4, phone = $5, address = $6::jsonb, settings = $7::jsonb,
             is_active = $8, updated_at = now()
         WHERE id = $1 AND tenant_id = $9`,
        [shop.id, shop.name, shop.type, shop.gst_number, shop.phone, JSON.stringify(shop.address ?? {}), JSON.stringify(shop.settings ?? {}), shop.is_active, tenant.id],
      );
    } else {
      await localClient.query(
        `INSERT INTO shops (id, tenant_id, name, type, gst_number, phone, address, settings, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)`,
        [shop.id, tenant.id, shop.name, shop.type, shop.gst_number, shop.phone, JSON.stringify(shop.address ?? {}), JSON.stringify(shop.settings ?? {}), shop.is_active, shop.created_at, shop.updated_at],
      );
    }
  }

  for (const profile of profileRows) {
    const existing = await localClient.query(`SELECT id FROM profiles WHERE id = $1 LIMIT 1`, [profile.id]);
    if (existing.rows[0]) {
      await localClient.query(
        `UPDATE profiles
         SET name = $2, description = $3, is_system = $4, permissions = $5::jsonb, updated_at = now()
         WHERE id = $1 AND tenant_id = $6`,
        [profile.id, profile.name, profile.description, profile.is_system, JSON.stringify(profile.permissions ?? {}), tenant.id],
      );
    } else {
      await localClient.query(
        `INSERT INTO profiles (id, tenant_id, name, description, is_system, permissions, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [profile.id, tenant.id, profile.name, profile.description, profile.is_system, JSON.stringify(profile.permissions ?? {}), profile.created_at, profile.updated_at],
      );
    }
  }

  for (const role of roleRows) {
    const existing = await localClient.query(`SELECT id FROM roles WHERE id = $1 LIMIT 1`, [role.id]);
    if (existing.rows[0]) {
      await localClient.query(
        `UPDATE roles
         SET name = $2, parent_role_id = $3, level = $4, updated_at = now()
         WHERE id = $1 AND tenant_id = $5`,
        [role.id, role.name, role.parent_role_id, role.level, tenant.id],
      );
    } else {
      await localClient.query(
        `INSERT INTO roles (id, tenant_id, name, parent_role_id, level, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [role.id, tenant.id, role.name, role.parent_role_id, role.level, role.created_at, role.updated_at],
      );
    }
  }

  const importedUsers = [];
  for (const user of userRows) {
    const localPassword = passwordForUser(user, passwordBase);
    const passwordHash = await bcrypt.hash(localPassword, 12);
    const existing = await localClient.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [user.id]);
    if (existing.rows[0]) {
      await localClient.query(
        `UPDATE users
         SET shop_id = $2, cognito_sub = NULL, email = $3, phone = $4, name = $5, password_hash = $6,
             profile_id = $7, role_id = $8, is_active = $9, is_platform_admin = $10, refresh_token_hash = NULL, updated_at = now()
         WHERE id = $1 AND tenant_id = $11`,
        [user.id, user.shop_id, user.email, user.phone, user.name, passwordHash, user.profile_id, user.role_id, user.is_active, user.is_platform_admin, tenant.id],
      );
    } else {
      await localClient.query(
        `INSERT INTO users (id, tenant_id, shop_id, cognito_sub, email, phone, name, password_hash, profile_id, role_id,
                            is_active, is_platform_admin, last_login, refresh_token_hash, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, NULL, NULL, $12, $13)`,
        [user.id, tenant.id, user.shop_id, user.email, user.phone, user.name, passwordHash, user.profile_id, user.role_id, user.is_active, user.is_platform_admin, user.created_at, user.updated_at],
      );
    }
    importedUsers.push({ tenantSlug: tenant.slug, email: user.email, password: localPassword, name: user.name });
  }

  for (const sequence of billSequenceRows) {
    const existing = await localClient.query(
      `SELECT tenant_id FROM bill_sequences WHERE tenant_id = $1 AND shop_id = $2 LIMIT 1`,
      [sequence.tenant_id, sequence.shop_id],
    );
    if (existing.rows[0]) {
      await localClient.query(
        `UPDATE bill_sequences
         SET prefix = $3, last_number = $4, current_period = $5
         WHERE tenant_id = $1 AND shop_id = $2`,
        [sequence.tenant_id, sequence.shop_id, sequence.prefix, sequence.last_number, sequence.current_period ?? null],
      );
    } else {
      await localClient.query(
        `INSERT INTO bill_sequences (tenant_id, shop_id, prefix, last_number, current_period)
         VALUES ($1, $2, $3, $4, $5)`,
        [sequence.tenant_id, sequence.shop_id, sequence.prefix, sequence.last_number, sequence.current_period ?? null],
      );
    }
  }

  return importedUsers;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDbUrl = resolveProdDbUrl(args);
  const localDbUrl = args['local-db-url'] || process.env.DATABASE_URL || 'postgresql://shoposphere:shoposphere@localhost:5432/shoposphere';
  const tenantSlug = args['tenant-slug'] || null;
  const passwordBase = args.password || process.env.LOCAL_SYNC_PASSWORD_BASE || 'Local1234!';

  const sourceClient = new Client({ connectionString: sourceDbUrl, connectionTimeoutMillis: 5000 });
  const localClient = new Client({ connectionString: localDbUrl, connectionTimeoutMillis: 5000 });
  await sourceClient.connect();
  await localClient.connect();

  try {
    const tenants = await queryRows(
      sourceClient,
      `SELECT id, name, slug, plan, status, settings, metadata, created_at, updated_at
       FROM tenants
       WHERE ($1::text IS NULL OR slug = $1)
       ORDER BY created_at ASC`,
      [tenantSlug],
    );

    if (tenants.length === 0) {
      throw new Error(tenantSlug ? `No production tenant found for slug "${tenantSlug}"` : 'No production tenants found');
    }

    const allImportedUsers = [];
    for (const tenant of tenants) {
      const [shopRows, profileRows, roleRows, userRows, billSequenceRows] = await Promise.all([
        queryRows(sourceClient, `SELECT * FROM shops WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenant.id]),
        queryRows(sourceClient, `SELECT * FROM profiles WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenant.id]),
        queryRows(sourceClient, `SELECT * FROM roles WHERE tenant_id = $1 ORDER BY level ASC, created_at ASC`, [tenant.id]),
        queryRows(sourceClient, `SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenant.id]),
        queryRows(sourceClient, `SELECT * FROM bill_sequences WHERE tenant_id = $1`, [tenant.id]),
      ]);

      await localClient.query('BEGIN');
      try {
        const importedUsers = await syncTenant(
          localClient,
          tenant,
          shopRows,
          profileRows,
          roleRows,
          userRows,
          billSequenceRows,
          passwordBase,
        );
        await localClient.query('COMMIT');
        allImportedUsers.push(...importedUsers);
      } catch (error) {
        await localClient.query('ROLLBACK');
        throw error;
      }
    }

    console.log('');
    console.log('Production metadata synced to local.');
    console.log(`Source DB : ${sourceDbUrl.replace(/:(.*?)@/, ':***@')}`);
    console.log(`Local DB  : ${localDbUrl.replace(/:(.*?)@/, ':***@')}`);
    console.log('');
    console.log('Local login reset summary:');
    for (const user of allImportedUsers) {
      console.log(`- [${user.tenantSlug}] ${user.email} / ${user.password}`);
    }
    console.log('');
    console.log('Notes:');
    console.log('- Only tenant/shop/user/settings metadata was synced.');
    console.log('- Passwords were replaced with local-only passwords.');
    console.log('- No orders, inventory, customers, payments, or other business data were copied.');
  } finally {
    await sourceClient.end();
    await localClient.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
