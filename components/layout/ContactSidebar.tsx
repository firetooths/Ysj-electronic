
import React from 'react';
import { NavLink } from 'react-router-dom';
import { DashboardIcon, ListIcon, AddIcon, BulkImportIcon } from '../ui/Icons';

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

export const ContactSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white p-4 h-full shadow-md overflow-y-auto custom-scrollbar sticky top-[72px] hidden md:block">
      <nav className="space-y-2">
        <NavItem to="/contacts" end={true} icon={<DashboardIcon className="ml-3 text-indigo-500 fa-lg" />} label="داشبورد" />
        <NavItem to="/contacts/list" icon={<ListIcon className="ml-3 text-indigo-500 fa-lg" />} label="لیست مخاطبین" />
        <NavItem to="/contacts/new" icon={<AddIcon className="ml-3 text-indigo-500 fa-lg" />} label="افزودن مخاطب" />
        <NavItem to="/contacts/groups" icon={<i className="fas fa-users ml-3 text-indigo-500 fa-lg"></i>} label="مدیریت گروه‌ها" />
        <NavItem to="/contacts/bulk-import" icon={<BulkImportIcon className="ml-3 text-indigo-500 fa-lg" />} label="ورود گروهی" />
      </nav>
    </aside>
  );
};