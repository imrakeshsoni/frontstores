// ── Component ─────────────────────────────────────────────────────────────────

export default function SyncPage() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Data Sync</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Keep your devices in sync.</p>
      </div>

      {/* Cloud Sync */}
      <div style={{
        background: '#fff', border: '1.5px solid var(--border)',
        borderRadius: 16, padding: 20, marginBottom: 16,
        boxShadow: '0 2px 8px rgba(124,58,237,.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>☁️</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Cloud Sync</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#7c3aed', borderRadius: 999, padding: '2px 8px' }}>PAID</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Sync across any network, anywhere</div>
          </div>
        </div>

        <div style={{ marginTop: 16, background: 'rgba(124,58,237,.06)', border: '1.5px solid rgba(124,58,237,.2)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>☁️</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#7c3aed', marginBottom: 8 }}>Premium Feature</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Cloud Sync lets you access your data from any device, anywhere.
            <br />Request access from Settings, and we'll approve it for your account.
          </div>
          <a
            href="https://frontstores.com/#contact"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#7c3aed', color: '#fff', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            💬 Contact Support
          </a>
        </div>
      </div>

      {/* How it works */}
      <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>How Sync Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['📲', 'Your data stays on your device. Nothing is sent to any server without your permission.'],
            ['🔁', 'Sync merges changes from all your devices. The most recently updated record wins.'],
            ['☁️', 'Cloud Sync (paid): works from anywhere, any network, any time — once approved for your account.'],
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
