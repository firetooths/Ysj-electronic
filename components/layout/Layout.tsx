
import React, { useEffect, useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NavLink, Outlet } from 'react-router-dom';
import { AddIcon, AssetIcon, BulkImportIcon, CategoryIcon, DashboardIcon, LocationIcon, SettingsIcon, TransferredListIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext'; // Import Auth

export const Layout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth(); // Get user to possibly show info in header

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  useEffect(() => {
    // Close mobile menu if resized to desktop view
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="مدیریت اموال" />
      {/* Mobile Menu Button */}
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

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden" onClick={toggleMobileMenu}></div>
      )}
      <aside className={`fixed inset-y-0 right-0 w-64 bg-white p-4 shadow-xl z-40 transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <nav className="space-y-2">
          <NavLink
            to="/asset-management"
            end={true}
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <DashboardIcon className="ml-3 text-indigo-500 fa-lg" />
            <span className="flex-1 whitespace-nowrap">داشبورد اموال</span>
          </NavLink>
          <NavLink
            to="/asset-management/assets"
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <AssetIcon className="ml-3 text-indigo-500 fa-lg" />
            <span className="flex-1 whitespace-nowrap">مدیریت تجهیزات</span>
          </NavLink>
          <NavLink
            to="/asset-management/categories"
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <CategoryIcon className="ml-3 text-indigo-500 fa-lg" />
            <span className="flex-1 whitespace-nowrap">دسته بندی‌ها</span>
          </NavLink>
          <NavLink
            to="/asset-management/locations"
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <LocationIcon className="ml-3 text-indigo-500 fa-lg" />
            <span className="flex-1 whitespace-nowrap">محل قرارگیری</span>
          </NavLink>
          <NavLink
            to="/asset-management/statuses"
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <i className="fas fa-toggle-on ml-3 text-indigo-500 fa-lg"></i>
            <span className="flex-1 whitespace-nowrap">مدیریت وضعیت‌ها</span>
          </NavLink>
          <NavLink
            to="/asset-management/transferred-assets"
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <TransferredListIcon className="ml-3 text-indigo-500 fa-lg" />
            <span className="flex-1 whitespace-nowrap">اموال منتقل شده</span>
          </NavLink>
          <NavLink
            to="/asset-management/bulk-import"
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <BulkImportIcon className="ml-3 text-indigo-500 fa-lg" />
            <span className="flex-1 whitespace-nowrap">ورود گروهی</span>
          </NavLink>
          <NavLink
            to="/asset-management/settings"
            onClick={toggleMobileMenu}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors duration-200 text-gray-700
              ${isActive ? 'bg-indigo-100 text-indigo-700 font-semibold shadow-sm' : 'hover:bg-gray-200 hover:text-gray-900'}
              `
            }
          >
            <SettingsIcon className="ml-3 text-indigo-500 fa-lg" />
            <span className="flex-1 whitespace-nowrap">تنظیمات اموال</span>
          </NavLink>
        </nav>
      </aside>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
