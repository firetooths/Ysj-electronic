
import React, { useState, useEffect } from 'react';

export const NetworkStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium fixed bottom-0 left-0 right-0 z-50 animate-pulse shadow-lg flex justify-center items-center">
      <i className="fas fa-wifi-slash ml-2"></i>
      <span>شما آفلاین هستید. دسترسی به سرور قطع می‌باشد و اطلاعات نمایش داده شده ممکن است به‌روز نباشند.</span>
    </div>
  );
};
