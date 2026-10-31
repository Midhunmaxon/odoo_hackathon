import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Layers,
  Users,
  Package,
  CreditCard,
  FileText,
  Receipt,
  Percent,
  BarChart3,
  LogOut,
  User as UserIcon,
  Globe,
  ShieldAlert,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { User, UserRole } from '../../types';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  exact?: boolean;
}

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userJson = localStorage.getItem('brightloop_user');
  const user: User | null = userJson ? JSON.parse(userJson) : null;
  const role: UserRole = user?.role || 'CUSTOMER';

  const handleLogout = () => {
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
    navigate('/login');
  };

  // Sidebar navigation configuration strictly dependent on user role
  const allNavItems: NavItem[] = [
    // Staff & Admin
    { label: 'Overview', to: '/', icon: Layers, roles: ['ADMIN', 'STAFF'], exact: true },
    { label: 'Subscriptions', to: '/subscriptions', icon: CreditCard, roles: ['ADMIN', 'STAFF'] },
    { label: 'Catalog & Plans', to: '/catalog', icon: Package, roles: ['ADMIN', 'STAFF'] },
    { label: 'Invoices', to: '/invoices', icon: FileText, roles: ['ADMIN', 'STAFF'] },
    { label: 'Payments', to: '/payments', icon: Receipt, roles: ['ADMIN', 'STAFF'] },
    { label: 'Taxes & Discounts', to: '/tax-discount', icon: Percent, roles: ['ADMIN', 'STAFF'] },
    
    // Admin only
    { label: 'Staff Management', to: '/staff', icon: ShieldAlert, roles: ['ADMIN'] },
    { label: 'Users & RBAC', to: '/users', icon: Users, roles: ['ADMIN'] },
    { label: 'Reports & MRR', to: '/reports', icon: BarChart3, roles: ['ADMIN', 'STAFF'] },

    // Customer Portal Items
    // Customer sees ONLY "My Subscriptions" and "My Invoices"
    {
      label: role === 'CUSTOMER' ? 'My Subscriptions' : 'Customer Portal',
      to: '/portal',
      icon: role === 'CUSTOMER' ? CreditCard : Globe,
      roles: ['ADMIN', 'STAFF', 'CUSTOMER'],
    },
    {
      label: 'My Invoices',
      to: '/portal/invoices',
      icon: Receipt,
      roles: ['CUSTOMER'],
    },
  ];

  // Filter items matching current user's role
  const visibleNavItems = allNavItems.filter((item) => item.roles.includes(role));

  const roleBadgeStyles: Record<UserRole, { bg: string; text: string }> = {
    ADMIN: { bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', text: 'Administrator' },
    STAFF: { bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40', text: 'Operations Staff' },
    CUSTOMER: { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', text: 'Customer Portal' },
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-white shadow-lg shadow-blue-500/20">
              BL
            </div>
            <div>
              <h1 className="font-extrabold text-base text-white tracking-tight leading-tight">
                Brightloop
              </h1>
              <p className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase">
                Subscription Engine
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile Card & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
                <span
                  className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border ${
                    roleBadgeStyles[role]?.bg || 'text-slate-400'
                  }`}
                >
                  {roleBadgeStyles[role]?.text || role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log out of system"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Access Tier:</span>
              <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                {role}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <span className="text-slate-500 hidden md:inline">
              Signed in as <strong className="text-slate-800">{user?.email}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Routed Content View */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
