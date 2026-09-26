import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wrench, FileText, CreditCard, Receipt,
  Landmark, Package, ShoppingCart, Truck, BarChart3, ShieldCheck,
  Settings as SettingsIcon, Menu, ChevronDown,
} from 'lucide-react';
import { useSidebarState } from '../hooks/useSidebarState';

type NavItem = {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: '/',            label: 'Dashboard',        Icon: LayoutDashboard, end: true },
  { to: '/customers',   label: 'Customers',        Icon: Users },
  { to: '/jobs',        label: 'Jobs / Work Orders', Icon: Wrench },
  { to: '/invoices',    label: 'Invoices',         Icon: FileText },
  { to: '/payments',    label: 'Payments',         Icon: CreditCard },
  { to: '/expenses',    label: 'Expenses',         Icon: Receipt },
  { to: '/accounts',    label: 'Chart of Accounts', Icon: Landmark },
  { to: '/inventory',   label: 'Inventory',        Icon: Package },
  { to: '/purchasing',  label: 'Purchasing',       Icon: ShoppingCart },
  { to: '/suppliers',   label: 'Suppliers',        Icon: Truck },
  { to: '/reports',     label: 'Reports',          Icon: BarChart3 },
  { to: '/audit',       label: 'Audit Trail',      Icon: ShieldCheck },
  { to: '/settings',    label: 'Settings',         Icon: SettingsIcon },
];

export const SidebarRail: React.FC = () => {
  const { expanded, toggle } = useSidebarState();
  const { pathname } = useLocation();
  return (
    <aside className="bg-[var(--md-sys-color-surface)] border-r border-[var(--md-sys-color-outline-variant)] z-50 flex-col overflow-hidden" style={{ width: expanded ? 224 : 56, minWidth: expanded ? 224 : 56 }}>
      <nav className="flex flex-col gap-1 px-2 py-2">
        <button onClick={toggle} aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}>{expanded ? <ChevronDown size={18} /> : <Menu size={18} />}</button>
        {NAV.map(item => {
          const isActive = item.end ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <NavLink key={item.to} to={item.to} end={item.end} title={item.label} className={`flex gap-3 px-2 py-2 rounded-lg ${expanded ? '' : 'items-center justify-center'} ${isActive ? 'bg-[var(--md-sys-color-secondary-container)]' : ''}`}>
              <item.Icon size={20} strokeWidth={1.9} />
              {expanded && <span className="text-sm truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
