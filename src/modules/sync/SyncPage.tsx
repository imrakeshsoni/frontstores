import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getDb } from '../../lib/db'
import { useAppStore } from '../../app/store/app.store'

// ── Tables that participate in sync ──────────────────────────────────────────
const SYNC_TABLES = [
  'products', 'customers', 'orders', 'order_items',
  'inventory_adjustments', 'expenses', 'khata_entries', 'suppliers',
]

type SyncMode = 'idle' | 'wifi' | 'cloud'
type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'done' | 'error'

interface SyncRow {
  table: string
  id: string
  data: Record<string, unknown>
  updated_at: string
  deleted_at: string | null
}

interface LastSync {
  at: string
  rows: number
  mode: 'wifi' | 'cloud'
}

// ── WiFi Sync Engine ──────────────────────────────────────────────────────────

async function pullChangesFromDesktop(host: string, tenantId: string, since: string | null): Promise<SyncRow[]> {
  const params = new URLSearchParams({ tenant_id: tenantId })
  if (since) params.set('since', since)
  const res = await fetch(`http://${host}/sync/pull?${params}`)
  if (!res.ok) throw new Error('Pull failed: ' + res.status)
  const data = await res.json()
  return data.rows ?? []
}

async function applyPulledRows(rows: SyncRow[]) {
  if (!rows.length) return
  const db = await getDb()
  for (const row of rows) {
    const cols = Object.keys(row.data)
    if (!cols.length) continue
    const placeholders = cols.map(() => '?').join(', ')
    const updates = cols.map(c => `${c} = excluded.${c}`).join(', ')
    const vals = cols.map(c => (row.data as Record<string, unknown>)[c])
    await db.execute(
      `INSERT INTO ${row.table} (${cols.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updates}`,
      vals
    )
  }
}

async function collectLocalChanges(tenantId: string, since: string | null): Promise<SyncRow[]> {
  const db = await getDb()
  const rows: SyncRow[] = []
  for (const table of SYNC_TABLES) {
    try {
      const q = since
        ? `SELECT * FROM ${table} WHERE tenant_id = ? AND updated_at > ? LIMIT 500`
        : `SELECT * FROM ${table} WHERE tenant_id = ? LIMIT 500`
      const params = since ? [tenantId, since] : [tenantId]
      const result = await db.select<Record<string, unknown>[]>(q, params)
      for (const r of result) {
        rows.push({
          table,
          id: r.id as string,
          data: r,
          updated_at: r.updated_at as string,
          deleted_at: r.deleted_at as string | null,
        })
      }
    } catch {
      // table may not exist for this shop type — skip
    }
  }
  return rows
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SyncPage() {
  const config = useAppStore(s => s.config)
  const tenantId = config?.tenant_id ?? ''
  const [mode, setMode] = useState<SyncMode>('idle')
  const [desktopIp, setDesktopIp] = useState(() => localStorage.getItem('sync_desktop_ip') ?? '')
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [lastSync, setLastSync] = useState<LastSync | null>(() => {
    try { return JSON.parse(localStorage.getItem('last_sync') ?? 'null') } catch { return null }
  })
  const [serverAddr, setServerAddr] = useState<string | null>(null)
  const [isDesktop] = useState(() => !!(window as unknown as { __TAURI__?: unknown }).__TAURI__)

  // ── Start WiFi server (desktop side) ───────────────────────────────────────
  const startServer = useCallback(async () => {
    try {
      const addr = await invoke<string>('start_wifi_sync_server')
      setServerAddr(addr)
    } catch (e) {
      setStatusMsg('Could not start sync server: ' + String(e))
    }
  }, [])

  // ── WiFi sync (mobile side connects to desktop) ────────────────────────────
  const doWifiSync = useCallback(async () => {
    if (!desktopIp.trim() || !tenantId) return
    const host = desktopIp.trim()
    localStorage.setItem('sync_desktop_ip', host)

    setStatus('connecting')
    setStatusMsg('Connecting to desktop...')
    try {
      const ok = await invoke<boolean>('ping_sync_server', { host })
      if (!ok) throw new Error('Desktop not reachable. Make sure both devices are on the same WiFi and sync is enabled on desktop.')
    } catch (e) {
      setStatus('error')
      setStatusMsg(String(e))
      return
    }

    setStatus('syncing')
    setStatusMsg('Syncing...')
    try {
      const since = lastSync?.at ?? null

      // 1. Collect local changes and push to desktop
      setStatusMsg('Uploading local changes...')
      const localRows = await collectLocalChanges(tenantId, since)
      if (localRows.length) {
        await invoke('push_to_desktop', { host, rows: localRows })
      }

      // 2. Pull changes from desktop
      setStatusMsg('Downloading changes from desktop...')
      const pulledRows = await pullChangesFromDesktop(host, tenantId, since)
      await applyPulledRows(pulledRows)

      const record: LastSync = { at: new Date().toISOString(), rows: localRows.length + pulledRows.length, mode: 'wifi' }
      localStorage.setItem('last_sync', JSON.stringify(record))
      setLastSync(record)
      setStatus('done')
      setStatusMsg(`Sync complete — ${record.rows} rows exchanged`)
    } catch (e) {
      setStatus('error')
      setStatusMsg('Sync failed: ' + String(e))
    }
  }, [desktopIp, tenantId, lastSync])

  // ── Poll for rows pushed from mobile (desktop side) ────────────────────────
  useEffect(() => {
    if (!isDesktop || !serverAddr) return
    const interval = setInterval(async () => {
      try {
        const rows = await invoke<SyncRow[]>('drain_pushed_rows')
        if (rows.length) {
          await applyPulledRows(rows)
          setStatusMsg(`Received ${rows.length} rows from mobile`)
          const record: LastSync = { at: new Date().toISOString(), rows: rows.length, mode: 'wifi' }
          localStorage.setItem('last_sync', JSON.stringify(record))
          setLastSync(record)
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [isDesktop, serverAddr])

  const statusColor = status === 'done' ? '#059669' : status === 'error' ? '#f43f5e' : '#7c3aed'

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Data Sync</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Keep your desktop and phone in sync.</p>
      </div>

      {/* Last sync status */}
      {lastSync && (
        <div style={{ background: 'rgba(5,150,105,.08)', border: '1.5px solid rgba(5,150,105,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Last sync: {new Date(lastSync.at).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lastSync.rows} rows · {lastSync.mode === 'wifi' ? 'WiFi' : 'Cloud'}</div>
          </div>
        </div>
      )}

      {/* ── Option 1: WiFi Sync ─────────────────────────────────────────── */}
      <SyncCard
        icon="📶"
        title="WiFi Sync"
        subtitle="Free — works on same network"
        badge="FREE"
        badgeColor="#059669"
        active={mode === 'wifi'}
        onClick={() => setMode(m => m === 'wifi' ? 'idle' : 'wifi')}
      >
        {mode === 'wifi' && (
          <div style={{ marginTop: 16 }}>
            {/* Desktop side: start server */}
            {isDesktop && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  Step 1 — On this desktop, start sync server:
                </div>
                {serverAddr ? (
                  <div style={{ background: 'rgba(124,58,237,.08)', border: '1.5px solid rgba(124,58,237,.2)', borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Server running — enter this address on your phone:</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#7c3aed', letterSpacing: '0.04em' }}>{serverAddr}</div>
                  </div>
                ) : (
                  <button onClick={startServer} style={btnStyle('#7c3aed')}>
                    Start Sync Server
                  </button>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '16px 0 8px' }}>
                  Step 2 — On phone, enter desktop address and tap Sync:
                </div>
              </div>
            )}

            {/* Mobile side: enter IP and sync */}
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
              {isDesktop ? 'Desktop IP (shown on phone screen):' : 'Enter desktop IP address (shown on desktop sync screen):'}
            </div>
            <input
              type="text"
              value={desktopIp}
              onChange={e => setDesktopIp(e.target.value)}
              placeholder="e.g. 192.168.1.5:7788"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 15, fontFamily: 'monospace', marginBottom: 12, background: 'var(--surface2)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              onClick={doWifiSync}
              disabled={status === 'syncing' || status === 'connecting'}
              style={btnStyle('#059669')}
            >
              {status === 'connecting' ? '🔗 Connecting...' : status === 'syncing' ? '⟳ Syncing...' : '⟳ Sync Now'}
            </button>

            {statusMsg && (
              <div style={{ marginTop: 10, fontSize: 13, color: statusColor, fontWeight: 600 }}>{statusMsg}</div>
            )}
          </div>
        )}
      </SyncCard>

      {/* ── Option 2: Cloud Sync (Paid) ─────────────────────────────────── */}
      <SyncCard
        icon="☁️"
        title="Cloud Sync"
        subtitle="Sync across any network, anywhere"
        badge="PAID"
        badgeColor="#7c3aed"
        active={mode === 'cloud'}
        onClick={() => setMode(m => m === 'cloud' ? 'idle' : 'cloud')}
      >
        {mode === 'cloud' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ background: 'rgba(124,58,237,.06)', border: '1.5px solid rgba(124,58,237,.2)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>☁️</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#7c3aed', marginBottom: 8 }}>Premium Feature</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Cloud Sync lets you access your data from any device, anywhere — even without WiFi.
                <br />This is a paid add-on. Contact us to activate it for your account.
              </div>
              <a
                href="https://wa.me/919340419566?text=Hi%2C+I+want+to+activate+Cloud+Sync+for+FrontStores"
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25d366', color: '#fff', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
              >
                💬 Contact on WhatsApp
              </a>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                or email <a href="mailto:imrakeshsoni@gmail.com" style={{ color: '#7c3aed' }}>imrakeshsoni@gmail.com</a>
              </div>
            </div>
          </div>
        )}
      </SyncCard>

      {/* How it works */}
      <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>How Sync Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['📲', 'Your data stays on your device. Nothing is sent to any server without your permission.'],
            ['📶', 'WiFi Sync: both devices must be on the same WiFi network. No internet needed.'],
            ['🔁', 'Sync merges changes from both devices. The most recently updated record wins.'],
            ['☁️', 'Cloud Sync (paid): works from anywhere, any network, any time.'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SyncCard({ icon, title, subtitle, badge, badgeColor, active, onClick, children }: {
  icon: string; title: string; subtitle: string
  badge: string; badgeColor: string
  active: boolean; onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${active ? badgeColor : 'var(--border)'}`,
      borderRadius: 16, padding: 20, marginBottom: 16,
      boxShadow: active ? `0 4px 20px ${badgeColor}20` : '0 2px 8px rgba(124,58,237,.05)',
      transition: 'all .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={onClick}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: badgeColor, borderRadius: 999, padding: '2px 8px' }}>{badge}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--muted)', transform: active ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </div>
      {children}
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    width: '100%', background: color, color: '#fff', border: 'none',
    borderRadius: 12, padding: '13px 20px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  }
}
