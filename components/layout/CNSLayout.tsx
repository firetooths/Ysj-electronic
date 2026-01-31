
import React, { useEffect, useState } from 'react';
import { Header } from './Header';
import { CNSSidebar } from './CNSSidebar';
import { NavLink, Outlet } from 'react-router-dom';
import { DashboardIcon, ListIcon, AddIcon, CnsFaultIcon } from '../ui/Icons';

export const CNSLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const NavItem: React.FC<{ to: string, icon: React.ReactNode, label: string, end?: boolean }> = ({ to, icon, label, end }) => (
    <NavLink
      to={to}
      end={end}
      onClick={toggleMobileMenu}
      className={({ isActive }) =>
        `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
        ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}`
      }
    >
      {icon}
      <span className="flex-1 whitespace-nowrap">{label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="مدیریت خرابی CNS" />
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label="منوی ناوبری"
      >
        {isMobileMenuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden" onClick={toggleMobileMenu}></div>
      )}
      <aside className={`fixed inset-y-0 right-0 w-64 bg-white p-4 shadow-xl z-40 transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <nav className="space-y-2">
            <NavItem to="/cns" end={true} icon={<DashboardIcon className="ml-3 text-indigo-500 fa-lg" />} label="داشبورد CNS" />
            <NavItem to="/cns/faults" icon={<ListIcon className="ml-3 text-indigo-500 fa-lg" />} label="لیست خرابی‌ها" />
            <NavItem to="/cns/new-fault" icon={<AddIcon className="ml-3 text-indigo-500 fa-lg" />} label="ثبت خرابی جدید" />
            <NavItem to="/cns/equipment" icon={<CnsFaultIcon className="ml-3 text-indigo-500 fa-lg" />} label="مدیریت تجهیزات" />
        </nav>
      </aside>

      <div className="flex flex-1 overflow-hidden">
        <CNSSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
