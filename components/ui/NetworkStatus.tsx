
import React, { useState, useEffect } from 'react';
import { getQueueSize } from '../../services/offlineService';

export const NetworkStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
        setIsOnline(navigator.onLine);
        setPendingCount(getQueueSize());
    };

    // 1. Event Listeners
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    // 2. Polling interval (Backup for Android WebViews where events might lag)
    const interval = setInterval(updateStatus, 2000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`${isOnline ? 'bg-orange-500' : 'bg-red-600'} text-white text-center py-2 px-4 text-xs sm:text-sm font-medium fixed top-0 left-0 right-0 z-50 shadow-lg flex justify-center items-center h-12 transition-colors duration-300`}>
      <div className="flex items-center" dir="rtl">
          {!isOnline && <i className="fas fa-wifi-slash ml-2 text-lg animate-pulse"></i>}
          {isOnline && <i className="fas fa-sync ml-2 text-lg animate-spin"></i>}
          
          <span>
              {!isOnline 
                ? `عدم دسترسی به اینترنت (حالت آفلاین - ${pendingCount} تغییر در صف)` 
                : `اتصال برقرار شد. در حال ارسال ${pendingCount} تغییر به سرور...`
              }
          </span>
      </div>
    </div>
  );
};
