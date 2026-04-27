import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as archiver from 'archiver';
import { Response } from 'express';
import * as stream from 'stream';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip');

const BACKUP_VERSION = '1';

const TABLES = [
  'categories',
  'products',
  'inventory',
  'stock_movements',
  'customers',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'orders',
  'order_items',
  'payments',
  'bill_sequences',
] as const;

// Tables that must be empty before restore is allowed
const GUARD_TABLES = ['products', 'orders', 'customers', 'inventory'];

@Injectable()
export class BackupService {
  constructor(private readonly dataSource: DataSource) {}

  async exportZip(tenantId: string, shopId: string, res: Response): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `frontstores-backup-${date}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver.default('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    // Metadata file
    const meta = {
      version: BACKUP_VERSION,
      tenantId,
      shopId,
      exportedAt: new Date().toISOString(),
      tables: TABLES,
    };
    archive.append(JSON.stringify(meta, null, 2), { name: 'backup_info.json' });

    // Dump each table
    for (const table of TABLES) {
      const rows = await this.dataSource.query(
        `SELECT * FROM ${table} WHERE tenant_id = $1 ORDER BY created_at ASC NULLS LAST`,
        [tenantId],
      );
      archive.append(JSON.stringify(rows, null, 2), { name: `${table}.json` });
    }

    await archive.finalize();
  }

  async restoreZip(tenantId: string, shopId: string, buffer: Buffer): Promise<{ restored: Record<string, number> }> {
    // Parse ZIP
    let zip: typeof AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      throw new BadRequestException('Invalid ZIP file');
    }

    const readJson = (name: string): any[] | null => {
      const entry = zip.getEntry(name);
      if (!entry) return null;
      try { return JSON.parse(zip.readAsText(entry)); } catch { return null; }
    };

    const meta = readJson('backup_info.json');
    if (!meta || (meta as any).version !== BACKUP_VERSION) {
      throw new BadRequestException('Unrecognised backup format or version mismatch');
    }

    // Safety: reject if any guard table has existing records
    for (const table of GUARD_TABLES) {
      const [{ count }] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM ${table} WHERE tenant_id = $1`,
        [tenantId],
      );
      if (count > 0) {
        throw new BadRequestException(
          `Restore blocked: "${table}" already has ${count} record(s). Restore is only allowed into an empty account.`,
        );
      }
    }

    // Restore in FK-safe order
    const restored: Record<string, number> = {};

    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      for (const table of TABLES) {
        const rows = readJson(`${table}.json`);
        if (!rows || rows.length === 0) { restored[table] = 0; continue; }

        let count = 0;
        for (const row of rows) {
          // Force tenant_id to current tenant (safety)
          row.tenant_id = tenantId;

          const cols = Object.keys(row);
          const vals = cols.map((_, i) => `$${i + 1}`);
          const conflictCols = cols.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`);

          await manager.query(
            `INSERT INTO ${table} (${cols.join(', ')})
             VALUES (${vals.join(', ')})
             ON CONFLICT (id) DO UPDATE SET ${conflictCols.join(', ')}`,
            cols.map(c => row[c]),
          );
          count++;
        }
        restored[table] = count;
      }
    });

    return { restored };
  }
}
