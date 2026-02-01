
import React, { useState, useEffect } from 'react';
import { getQueueSize } from '../../services/offlineService';

export const NetworkStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    // Check queue size periodically to update UI
    const checkQueue = () => {
        setPendingCount(getQueueSize());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const interval = setInterval(checkQueue, 2000);
    checkQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`${isOnline ? 'bg-orange-500' : 'bg-red-600'} text-white text-center py-2 px-4 text-xs sm:text-sm font-medium fixed top-0 left-0 right-0 z-50 shadow-lg flex justify-center items-center h-12 transition-colors duration-300`}>
      <div className="flex items-center">
          {!isOnline && <i className="fas fa-wifi-slash ml-2 text-lg animate-pulse"></i>}
          {isOnline && <i className="fas fa-sync ml-2 text-lg animate-spin"></i>}
          
          <span>
              {!isOnline 
                ? `حالت آفلاین فعال است. (${pendingCount} تغییر در صف)` 
                : `اتصال برقرار شد. در حال همگام‌سازی ${pendingCount} تغییر...`
              }
          </span>
      </div>
    </div>
  );
};
