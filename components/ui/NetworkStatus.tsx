
import React, { useState, useEffect } from 'react';
import { getSupabaseSafe } from '../../services/client';
import { pullAllData, pushOfflineChanges } from '../../services/offlineSync';

export const NetworkStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbConnected, setDbConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check DB Connection
  const checkDbConnection = async () => {
    if (!navigator.onLine) {
        setDbConnected(false);
        return;
    }
    try {
        const client = getSupabaseSafe();
        const { error } = await client.from('app_settings').select('key').limit(1).maybeSingle();
        if (error) throw error;
        setDbConnected(true);
        
        // If we just reconnected, try to sync
        if (!dbConnected) {
            handleSync();
        }
    } catch (e) {
        console.error("DB Connection Check Failed:", e);
        setDbConnected(false);
    }
  };

  const handleSync = async () => {
      if (isSyncing || !navigator.onLine) return;
      setIsSyncing(true);
      try {
          await pushOfflineChanges();
          await pullAllData();
          setDbConnected(true);
      } catch(e) {
          console.error("Sync failed", e);
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
    const handleOnline = () => {
        setIsOnline(true);
        checkDbConnection();
    };
    const handleOffline = () => {
        setIsOnline(false);
        setDbConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkDbConnection();

    // Periodic check every 30 seconds
    const interval = setInterval(checkDbConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
        {/* Red Dot / Status Indicator in Top-Center or Corner */}
        <div className={`fixed top-0 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ${(!isOnline || !dbConnected) ? 'translate-y-0' : '-translate-y-10'}`}>
             <div className="bg-red-600 text-white text-xs font-bold px-4 py-1 rounded-b-lg shadow-md flex items-center gap-2">
                 <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                 <span>قطع ارتباط با سرور (حالت آفلاین)</span>
             </div>
        </div>

        {/* Sync Indicator (Blue Dot/Spin) */}
        {isSyncing && (
             <div className="fixed top-0 right-4 z-50 mt-1">
                 <div className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-b shadow opacity-80 flex items-center gap-1">
                     <i className="fas fa-sync fa-spin"></i> همگام‌سازی...
                 </div>
             </div>
        )}
    </>
  );
};
