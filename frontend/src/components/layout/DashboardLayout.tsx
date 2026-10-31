import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  Globe
} from 'lucide-react';
import { User } from '../../types';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const userJson = localStorage.getItem('brightloop_user');
  const user: User | null = userJson ? JSON.parse(userJson) : null;

  const handleLogout = () => {
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
    navigate('/login');
  };

  const navItems = [
    { label: 'Overview', to: '/', icon: Layers, roles: ['ADMIN', 'STAFF'] },
    { label: 'Subscriptions', to: '/subscriptions', icon: CreditCard, roles: ['ADMIN', 'STAFF'] },
    { label: 'Catalog & Plans', to: '/catalog', icon: Package, roles: ['ADMIN', 'STAFF'] },
    { label: 'Invoices', to: '/invoices', icon: FileText, roles: ['ADMIN', 'STAFF'] },
    { label: 'Payments', to: '/payments', icon: Receipt, roles: ['ADMIN', 'STAFF'] },
    { label: 'Taxes & Discounts', to: '/tax-discount', icon: Percent, roles: ['ADMIN', 'STAFF'] },
    { label: 'Users', to: '/users', icon: Users, roles: ['ADMIN'] },
    { label: 'Reports', to: '/reports', icon: BarChart3, roles: ['ADMIN', 'STAFF'] },
    { label: 'Customer Portal', to: '/portal', icon: Globe, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
            BL
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">Brightloop</h1>
            <p className="text-xs text-slate-400">Subscription Engine</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !user || item.roles.includes(user.role))
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-blue-400 font-semibold">{user?.role || 'GUEST'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Environment</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Active Monorepo
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-500">
              Signed in as <strong className="text-slate-700">{user?.email || 'admin@brightloop.com'}</strong>
            </span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
