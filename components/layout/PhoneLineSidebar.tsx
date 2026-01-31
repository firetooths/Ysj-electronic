import React from 'react';
import { NavLink } from 'react-router-dom';
import { RouteIcon, NodeIcon, SettingsIcon, WrenchIcon, LogIcon, TagIcon, DashboardIcon, ListIcon, BulkImportIcon } from '../ui/Icons';

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

export const PhoneLineSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white p-4 h-full shadow-md overflow-y-auto custom-scrollbar sticky top-[72px] hidden md:block">
      <nav className="space-y-2">
        <NavItem to="/phone-lines" end={true} icon={<DashboardIcon className="ml-3 text-indigo-500 fa-lg" />} label="داشبورد" />
        <NavItem to="/phone-lines/list" icon={<ListIcon className="ml-3 text-indigo-500 fa-lg" />} label="لیست خطوط" />
        <NavItem to="/phone-lines/bulk-import" icon={<BulkImportIcon className="ml-3 text-indigo-500 fa-lg" />} label="ورود گروهی" />
        <NavItem to="/phone-lines/nodes" icon={<NodeIcon className="ml-3 text-indigo-500 fa-lg" />} label="مدیریت گره‌ها" />
        <NavItem to="/phone-lines/tags" icon={<TagIcon className="ml-3 text-indigo-500 fa-lg" />} label="مدیریت تگ‌ها" />
        <NavItem to="/phone-lines/faults" icon={<WrenchIcon className="ml-3 text-indigo-500 fa-lg" />} label="اعلام خرابی" />
        <NavItem to="/phone-lines/logs" icon={<LogIcon className="ml-3 text-indigo-500 fa-lg" />} label="تاریخچه کلی" />
        <NavItem to="/phone-lines/settings" icon={<SettingsIcon className="ml-3 text-indigo-500 fa-lg" />} label="تنظیمات" />
      </nav>
    </aside>
  );
};