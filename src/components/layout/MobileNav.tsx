import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Package, Users, Settings, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/app/store/app.store'

/**
 * Bottom navigation bar shown on mobile/Android.
 * Shows the 5 most important tabs for quick access.
 */
export function MobileNav() {
  const config = useAppStore(s => s.config)
  const tabs = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'POS' },
    { to: '/products', icon: Package, label: 'Products' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/sync', icon: RefreshCw, label: 'Sync' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  // Study app has different nav
  const studyTabs = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/products', icon: Package, label: 'Notes' },
    { to: '/sync', icon: RefreshCw, label: 'Sync' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  const activeTabs = config?.shop_type === 'study' ? studyTabs : tabs

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1.5px solid #e8e4f5',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 0 env(safe-area-inset-bottom, 8px)',
      zIndex: 100, boxShadow: '0 -4px 20px rgba(124,58,237,.08)',
    }}>
      {activeTabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '4px 12px', borderRadius: 12, textDecoration: 'none',
            color: isActive ? '#7c3aed' : '#8b8aad',
            background: isActive ? 'rgba(124,58,237,.08)' : 'transparent',
            transition: 'all .15s', minWidth: 52,
          })}
        >
          <Icon size={22} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
