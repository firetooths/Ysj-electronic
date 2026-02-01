
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext';
import { getTasks } from '../../services/taskService';
import { getAllFaults } from '../../services/faultService';
import { getCNSFaultReports } from '../../services/cnsService';
import { getMaintenanceSchedules, isScheduleDue } from '../../services/cnsMaintenanceService';
import { getMyShiftRequests } from '../../services/shiftService'; 
import { FaultStatus, CNSFaultStatus, ShiftRequestStatus } from '../../types';
import { getSupabaseSafe } from '../../services/client';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  // Notification Counts
  const [taskCount, setTaskCount] = useState(0);
  const [shiftCount, setShiftCount] = useState(0); 
  const [faultCount, setFaultCount] = useState(0);

  // Connection Status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbConnected, setDbConnected] = useState(false);

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  // Connectivity Check (Every 30 seconds)
  useEffect(() => {
      const checkConnection = async () => {
          const online = navigator.onLine;
          setIsOnline(online);
          
          if (online) {
              try {
                  const client = getSupabaseSafe();
                  const { error } = await client.from('app_settings').select('key').limit(1).maybeSingle();
                  setDbConnected(!error);
              } catch (e) {
                  setDbConnected(false);
              }
          } else {
              setDbConnected(false);
          }
      };

      // Check immediately
      checkConnection();

      const interval = setInterval(checkConnection, 30000);
      window.addEventListener('online', checkConnection);
      window.addEventListener('offline', checkConnection);

      return () => {
          clearInterval(interval);
          window.removeEventListener('online', checkConnection);
          window.removeEventListener('offline', checkConnection);
      };
  }, []);

  useEffect(() => {
      const fetchCounts = async () => {
          if (!user || !dbConnected) return;
          
          try {
              const currentUserName = user.full_name || user.username;
              
              const tasksPromise = getTasks('', 'PENDING', currentUserName).catch(() => []);
              const phoneFaultsPromise = getAllFaults().catch(() => []);
              const cnsFaultsPromise = getCNSFaultReports('ALL').catch(() => []);
              const schedulesPromise = getMaintenanceSchedules().catch(() => []);
              const shiftsPromise = getMyShiftRequests(user.id).catch(() => []); 

              const [tasks, phoneFaults, cnsFaults, schedules, shifts] = await Promise.all([
                  tasksPromise, 
                  phoneFaultsPromise, 
                  cnsFaultsPromise, 
                  schedulesPromise,
                  shiftsPromise
              ]);

              setTaskCount(tasks.length);

              const actionableShifts = shifts.filter(req => 
                  (req.status === ShiftRequestStatus.PENDING_PROVIDER && req.provider_id === user.id) ||
                  (req.status === ShiftRequestStatus.PENDING_SUPERVISOR && req.supervisor_id === user.id)
              );
              setShiftCount(actionableShifts.length);

              const openPhoneFaults = phoneFaults.filter(f => f.status === FaultStatus.REPORTED).length;
              const openCNSFaults = cnsFaults.filter(f => f.status !== CNSFaultStatus.CLOSED).length;
              const dueSchedules = schedules.filter(s => isScheduleDue(s)).length;

              setFaultCount(openPhoneFaults + openCNSFaults + dueSchedules);
          } catch (err: any) {
              console.error("Error fetching notification counts:", err);
          }
      };

      fetchCounts();
      const interval = setInterval(fetchCounts, 60000);
      return () => clearInterval(interval);
  }, [user, location.pathname, dbConnected]);

  const isHomePage = location.pathname === '/';
  const totalNotifications = taskCount + shiftCount;

  const handleBack = () => {
    const path = location.pathname;
    if (path === '/') return;

    let segments = path.split('/').filter(Boolean);
    if (segments.length > 0) {
      segments.pop();
      const lastSegment = segments[segments.length - 1];
      const keywordsToSkip = ['edit', 'view', 'details', 'transfer', 'new'];
      if (keywordsToSkip.includes(lastSegment)) {
        segments.pop();
      }
    }

    const parentPath = '/' + segments.join('/');
    const returnSearch = location.state?.returnSearch || '';
    navigate(parentPath + returnSearch, { replace: true });
  };

  return (
    <header className="bg-gradient-to-r from-indigo-700 to-indigo-500 text-white shadow-lg p-3 sm:p-4 z-10 sticky top-0">
      <div className="container mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 space-x-reverse flex-1 min-w-0">
          {!isHomePage && (
            <button 
              onClick={handleBack}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0"
              title="بازگشت به سطح قبل"
            >
              <i className="fas fa-arrow-right fa-lg"></i>
            </button>
          )}
          
          <Link to="/" title="داشبورد اصلی" className="text-white hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0">
            <HomeIcon className="fa-lg" />
          </Link>

          <h1 className="text-sm sm:text-xl font-bold leading-tight truncate flex items-center">
            {title}
            {/* Connectivity Dot */}
            <span 
                className={`w-3 h-3 rounded-full mr-3 border-2 border-white shadow-sm ${dbConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`}
                title={dbConnected ? "آنلاین - متصل به سرور" : "آفلاین - قطع ارتباط"}
            ></span>
          </h1>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {/* Notification Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="relative p-2 rounded-full hover:bg-white/20 transition-colors text-white focus:outline-none"
                    title="اعلان‌ها"
                >
                    <i className="fas fa-bell fa-lg"></i>
                    {totalNotifications > 0 && (
                        <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-indigo-700 animate-pulse">
                            {totalNotifications > 99 ? '99+' : totalNotifications}
                        </span>
                    )}
                </button>

                {showNotifMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowNotifMenu(false)}></div>
                        <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl py-2 z-50 text-gray-800 border border-gray-100 animate-fade-in-down origin-top-left">
                            <div className="px-4 py-2 text-xs font-bold text-gray-500 border-b mb-1">
                                اعلان‌های سیستم
                            </div>
                            
                            <Link 
                                to="/tasks/list?assigned=me&status=pending" 
                                className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-100"
                                onClick={() => setShowNotifMenu(false)}
                            >
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center ml-3">
                                        <i className="fas fa-tasks"></i>
                                    </div>
                                    <span className="text-sm font-medium">تسک‌های من</span>
                                </div>
                                {taskCount > 0 ? (
                                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{taskCount}</span>
                                ) : (
                                    <span className="text-gray-400 text-xs"><i className="fas fa-check"></i></span>
                                )}
                            </Link>

                            <Link 
                                to="/shifts" 
                                className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors"
                                onClick={() => setShowNotifMenu(false)}
                            >
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center ml-3">
                                        <i className="fas fa-user-clock"></i>
                                    </div>
                                    <span className="text-sm font-medium">مدیریت شیفت</span>
                                </div>
                                {shiftCount > 0 ? (
                                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{shiftCount}</span>
                                ) : (
                                    <span className="text-gray-400 text-xs"><i className="fas fa-check"></i></span>
                                )}
                            </Link>

                            {totalNotifications === 0 && (
                                <div className="px-4 py-3 text-center text-xs text-gray-400">
                                    مورد جدیدی وجود ندارد
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Alert Icon */}
            <Link 
                to="/open-processes" 
                className="relative p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                title="فرآیندهای باز (خرابی‌ها و نت)"
            >
                <i className="fas fa-exclamation-triangle fa-lg"></i>
                {faultCount > 0 && (
                    <span className="absolute top-1 right-1 bg-yellow-500 text-indigo-900 text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-indigo-700">
                        {faultCount > 99 ? '99+' : faultCount}
                    </span>
                )}
            </Link>

            {/* User Menu */}
            <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center space-x-1.5 space-x-reverse hover:bg-white/20 p-1 sm:p-2 rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-indigo-300 rounded-full flex items-center justify-center text-indigo-900 font-bold text-sm shadow-inner">
                        {user?.full_name?.[0] || user?.username?.[0] || 'U'}
                    </div>
                    <i className="fas fa-chevron-down text-[10px] opacity-70"></i>
                </button>

                {showUserMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                        <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl py-2 z-50 text-gray-800 border border-gray-100 animate-fade-in-down">
                            <div className="px-4 py-2 text-xs text-indigo-600 font-bold border-b mb-1 truncate">
                                {user?.full_name || user?.username}
                            </div>
                            <Link to="/profile" className="flex items-center px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <i className="fas fa-user-circle ml-3 text-indigo-400"></i> پروفایل کاربری
                            </Link>
                            {user?.role?.name === 'Admin' && (
                                <>
                                    <Link to="/admin/users" className="flex items-center px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                        <i className="fas fa-users ml-3 text-indigo-400"></i> مدیریت کاربران
                                    </Link>
                                    <Link to="/admin/roles" className="flex items-center px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                        <i className="fas fa-user-shield ml-3 text-indigo-400"></i> مدیریت نقش‌ها
                                    </Link>
                                    <Link to="/settings" className="flex items-center px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                        <i className="fas fa-cog ml-3 text-indigo-400"></i> تنظیمات سیستم
                                    </Link>
                                </>
                            )}
                            <div className="border-t my-1"></div>
                            <button onClick={handleLogout} className="flex items-center w-full text-right px-4 py-2.5 text-sm text-red-600 hover:bg-red-100 transition-colors">
                                <i className="fas fa-sign-out-alt ml-3"></i> خروج از حساب
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
      </div>
    </header>
  );
};
