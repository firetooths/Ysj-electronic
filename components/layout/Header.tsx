
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext';
import { db } from '../../db';
import { FaultStatus, CNSFaultStatus, ShiftRequestStatus } from '../../types';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const [taskCount, setTaskCount] = useState(0);
  const [shiftCount, setShiftCount] = useState(0);
  const [faultCount, setFaultCount] = useState(0);

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  // NATIVE OFFLINE STRATEGY: Get counts from local Dexie DB
  // This is lightning fast and works 100% offline without fetch errors
  useEffect(() => {
      const fetchLocalCounts = async () => {
          if (!user) return;
          
          try {
              const currentUserName = user.full_name || user.username;
              
              // 1. Tasks
              const tasks = await db.tasks.where('status').equals('در حال انجام').toArray();
              const myTasks = tasks.filter(t => !t.assigned_to || t.assigned_to.includes(currentUserName));
              setTaskCount(myTasks.length);

              // 2. Shifts
              const shifts = await db.shift_requests.toArray();
              const actionableShifts = shifts.filter(req => 
                  (req.status === ShiftRequestStatus.PENDING_PROVIDER && req.provider_id === user.id) ||
                  (req.status === ShiftRequestStatus.PENDING_SUPERVISOR && req.supervisor_id === user.id)
              );
              setShiftCount(actionableShifts.length);

              // 3. Faults (Phone & CNS)
              const phoneFaults = await db.phone_line_faults.where('status').equals(FaultStatus.REPORTED).count();
              const cnsFaults = await db.cns_fault_reports.toArray();
              const openCNS = cnsFaults.filter(f => f.status !== CNSFaultStatus.CLOSED).length;
              
              // 4. Due Schedules (Local logic)
              // For simplicity offline, we just count pending schedules recorded in local DB
              const schedules = await db.cns_maintenance_schedules.toArray();
              // Filter logic for "due" items could be added here if needed

              setFaultCount(phoneFaults + openCNS);
          } catch (err) {
              console.warn("Local Header Counts Error:", err);
          }
      };

      fetchLocalCounts();
      const interval = setInterval(fetchLocalCounts, 30000);
      return () => clearInterval(interval);
  }, [user, location.pathname]);

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
      if (keywordsToSkip.includes(lastSegment)) segments.pop();
    }
    const parentPath = '/' + segments.join('/');
    const returnSearch = location.state?.returnSearch || '';
    navigate(parentPath + returnSearch, { replace: true });
  };

  return (
    <header className="bg-gradient-to-r from-indigo-700 to-indigo-500 text-white shadow-lg z-10 sticky top-0 safe-top-padding">
      <div className="container mx-auto flex items-center justify-between p-3 sm:p-4 gap-2">
        <div className="flex items-center space-x-2 space-x-reverse flex-1 min-w-0">
          {!isHomePage && (
            <button 
              onClick={handleBack}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0"
            >
              <i className="fas fa-arrow-right fa-lg"></i>
            </button>
          )}
          <Link to="/" className="text-white hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0">
            <HomeIcon className="fa-lg" />
          </Link>
          <h1 className="text-sm sm:text-xl font-bold leading-tight truncate">{title}</h1>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <div className="relative">
                <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="relative p-2 rounded-full hover:bg-white/20 transition-colors text-white">
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
                            <div className="px-4 py-2 text-xs font-bold text-gray-500 border-b mb-1">اعلان‌های سیستم</div>
                            <Link to="/tasks/list?assigned=me&status=pending" className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-100" onClick={() => setShowNotifMenu(false)}>
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center ml-3"><i className="fas fa-tasks"></i></div>
                                    <span className="text-sm font-medium">تسک‌های من</span>
                                </div>
                                {taskCount > 0 ? <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{taskCount}</span> : <span className="text-gray-400 text-xs"><i className="fas fa-check"></i></span>}
                            </Link>
                            <Link to="/shifts" className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors" onClick={() => setShowNotifMenu(false)}>
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center ml-3"><i className="fas fa-user-clock"></i></div>
                                    <span className="text-sm font-medium">مدیریت شیفت</span>
                                </div>
                                {shiftCount > 0 ? <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{shiftCount}</span> : <span className="text-gray-400 text-xs"><i className="fas fa-check"></i></span>}
                            </Link>
                        </div>
                    </>
                )}
            </div>

            <Link to="/open-processes" className="relative p-2 rounded-full hover:bg-white/20 transition-colors text-white">
                <i className="fas fa-exclamation-triangle fa-lg"></i>
                {faultCount > 0 && (
                    <span className="absolute top-1 right-1 bg-yellow-500 text-indigo-900 text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-indigo-700">
                        {faultCount > 99 ? '99+' : faultCount}
                    </span>
                )}
            </Link>

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
                            <div className="px-4 py-2 text-xs text-indigo-600 font-bold border-b mb-1 truncate">{user?.full_name || user?.username}</div>
                            <Link to="/profile" className="flex items-center px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors" onClick={() => setShowUserMenu(false)}><i className="fas fa-user-circle ml-3 text-indigo-400"></i> پروفایل کاربری</Link>
                            {user?.role?.name === 'Admin' && (
                                <>
                                    <Link to="/admin/users" className="flex items-center px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors" onClick={() => setShowUserMenu(false)}><i className="fas fa-users ml-3 text-indigo-400"></i> مدیریت کاربران</Link>
                                    <Link to="/settings" className="flex items-center px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors" onClick={() => setShowUserMenu(false)}><i className="fas fa-cog ml-3 text-indigo-400"></i> تنظیمات سیستم</Link>
                                </>
                            )}
                            <div className="border-t my-1"></div>
                            <button onClick={handleLogout} className="flex items-center w-full text-right px-4 py-2.5 text-sm text-red-600 hover:bg-red-100 transition-colors"><i className="fas fa-sign-out-alt ml-3"></i> خروج از حساب</button>
                        </div>
                    </>
                )}
            </div>
        </div>
      </div>
    </header>
  );
};
