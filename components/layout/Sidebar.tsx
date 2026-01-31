
import React from 'react';
import { NavLink } from 'react-router-dom';
import { AssetIcon, BulkImportIcon, CategoryIcon, DashboardIcon, LocationIcon, SettingsIcon, TransferredListIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, end = false }) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
        ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
        `
      }
    >
      {icon}
      <span className="flex-1 whitespace-nowrap">{label}</span>
    </NavLink>
  );
};

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.name === 'Admin';

  return (
    <aside className="w-64 bg-white p-4 h-full shadow-md overflow-y-auto custom-scrollbar sticky top-[72px] hidden md:block">
      <nav className="space-y-2">
        <NavItem to="/asset-management" end={true} icon={<DashboardIcon className="ml-3 text-indigo-500 fa-lg" />} label="داشبورد اموال" />
        <NavItem to="/asset-management/assets" icon={<AssetIcon className="ml-3 text-indigo-500 fa-lg" />} label="مدیریت تجهیزات" />
        <NavItem to="/asset-management/categories" icon={<CategoryIcon className="ml-3 text-indigo-500 fa-lg" />} label="دسته بندی‌ها" />
        <NavItem to="/asset-management/locations" icon={<LocationIcon className="ml-3 text-indigo-500 fa-lg" />} label="محل قرارگیری" />
        <NavItem to="/asset-management/statuses" icon={<i className="fas fa-toggle-on ml-3 text-indigo-500 fa-lg"></i>} label="مدیریت وضعیت‌ها" />
        <NavItem to="/asset-management/transferred-assets" icon={<TransferredListIcon className="ml-3 text-indigo-500 fa-lg" />} label="اموال منتقل شده" />
        <NavItem to="/asset-management/bulk-import" icon={<BulkImportIcon className="ml-3 text-indigo-500 fa-lg" />} label="ورود گروهی" />
        <NavItem to="/asset-management/settings" icon={<SettingsIcon className="ml-3 text-indigo-500 fa-lg" />} label="تنظیمات اموال" />
      </nav>
    </aside>
  );
};
