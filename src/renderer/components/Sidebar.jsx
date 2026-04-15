import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Truck, Package, Layers, FileText,
  Tag, ChevronRight, Settings, Archive, Wrench,
  Calendar, History, BookUser, Pencil
} from 'lucide-react'

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/events',      icon: Calendar,        label: 'Events' },
  { to: '/history',     icon: History,         label: 'History' },
  { to: '/address-book',icon: BookUser,        label: 'Address Book' },
  { to: '/trucks',      icon: Truck,           label: 'Truck Profiles' },
  { to: '/departments', icon: Tag,             label: 'Departments' },
  { to: '/items',       icon: Package,         label: 'Items' },
  { to: '/bulk-edit',   icon: Pencil,          label: 'Bulk Edit' },
  { to: '/planner',     icon: Layers,          label: 'Load Planner' },
  { to: '/repacks',     icon: Archive,         label: 'RePacks' },
  { to: '/repairs',     icon: Wrench,          label: 'Repairs' },
  { to: '/reports',     icon: FileText,        label: 'Reports' },
]

export default function Sidebar() {
  const location = useLocation()
  return (
    <aside className="w-56 bg-dark-800 border-r border-dark-600 flex flex-col select-none shrink-0">
      {/* Logo / App Name */}
      <div className="px-5 py-5 border-b border-dark-600 titlebar-drag">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
            <Truck size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">ProPOR</div>
            <div className="text-gray-500 text-xs">Production Point of Rental</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto titlebar-no-drag">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/25'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-dark-600'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {location.pathname.startsWith(to) && to !== '/dashboard' && (
              <ChevronRight size={12} className="text-brand-primary/60" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings link */}
      <div className="px-3 pb-2 titlebar-no-drag">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
              isActive
                ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/25'
                : 'text-gray-400 hover:text-gray-100 hover:bg-dark-600'
            }`
          }
        >
          <Settings size={16} className="shrink-0" />
          <span className="flex-1">Settings</span>
        </NavLink>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-dark-600 text-xs text-gray-600">
        v2.0.8
      </div>
    </aside>
  )
}
