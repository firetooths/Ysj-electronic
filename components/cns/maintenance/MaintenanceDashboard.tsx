
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaintenanceSchedule } from '../../../types';
import { getMaintenanceSchedules, calculateNextDueDate, isScheduleDue } from '../../../services/cnsMaintenanceService';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { AddIcon, ListIcon, WarningIcon, CheckIcon } from '../../ui/Icons';
import { TaskExecutionModal } from './TaskExecutionModal';

export const MaintenanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Task Execution Modal
  const [executionSchedule, setExecutionSchedule] = useState<MaintenanceSchedule | null>(null);

  const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
          const allSchedules = await getMaintenanceSchedules();
          setSchedules(allSchedules);
          
          // Filter for alerts
          const dueItems = allSchedules.filter(s => isScheduleDue(s));
          setAlerts(dueItems);
      } catch (e: any) {
          console.error(e);
          setError(e.message);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, []);

  const handleTaskComplete = () => {
      setExecutionSchedule(null);
      loadData(); // Refresh alerts
  };

  if (isLoading) return <div className="flex justify-center p-10"><Spinner /></div>;

  if (error) {
    return (
        <div className="container mx-auto p-8">
            <div className="bg-red-50 border-r-4 border-red-500 p-6 rounded shadow-md text-right">
                <div className="flex items-center mb-2">
                    <WarningIcon className="text-red-600 text-2xl ml-3" />
                    <h3 className="text-xl font-bold text-red-700">خطا در بارگذاری اطلاعات</h3>
                </div>
                <p className="text-gray-700 mb-4">{error}</p>
                <Button variant="secondary" onClick={loadData}>تلاش مجدد</Button>
            </div>
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-right">داشبورد سرویس و نگهداری</h2>

      {/* Quick Actions */}
      <div className="flex justify-end space-x-4 space-x-reverse mb-8">
          <Button variant="primary" onClick={() => navigate('/maintenance/list')}>
              <ListIcon className="ml-2" /> مدیریت برنامه زمان‌بندی
          </Button>
          <Button variant="secondary" onClick={() => navigate('/maintenance/new')}>
              <AddIcon className="ml-2" /> تعریف برنامه جدید
          </Button>
      </div>

      {/* Alerts Section */}
      <div className="bg-white p-6 rounded-lg shadow mb-8 border-t-4 border-orange-500">
          <div className="flex items-center mb-4">
              <WarningIcon className="text-orange-500 text-2xl ml-2" />
              <h3 className="text-xl font-bold text-gray-800">هشدارهای انجام کار</h3>
              <span className="mr-2 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                  {alerts.length} مورد
              </span>
          </div>

          {alerts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">هیچ فعالیت نگهداری در حال حاضر سررسید نشده است.</p>
          ) : (
              <div className="grid gap-4">
                  {alerts.map(schedule => {
                      const nextDue = calculateNextDueDate(schedule);
                      
                      // Calculate difference in days
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dueDate = new Date(nextDue);
                      dueDate.setHours(0, 0, 0, 0);
                      
                      const diffTime = dueDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      const isOverdue = diffDays < 0;
                      
                      let timeStatusText = '';
                      let timeStatusClass = '';
                      
                      if (diffDays < 0) {
                          timeStatusText = `${Math.abs(diffDays)} روز گذشته`;
                          timeStatusClass = 'text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-xs';
                      } else if (diffDays === 0) {
                          timeStatusText = 'سررسید امروز';
                          timeStatusClass = 'text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-xs font-bold';
                      } else {
                          timeStatusText = `${diffDays} روز باقی‌مانده`;
                          timeStatusClass = 'text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full text-xs';
                      }

                      return (
                          <div key={schedule.id} className={`border rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center transition-shadow hover:shadow-md ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                              <div className="mb-4 sm:mb-0 text-right w-full">
                                  <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-lg text-gray-900">{schedule.title}</h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            بازه تکرار: <span className="font-semibold">{schedule.recurrence_type}</span>
                                        </p>
                                    </div>
                                    <div className="text-left">
                                        <span className={timeStatusClass}>{timeStatusText}</span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-2">
                                      تاریخ سررسید: <span className="font-bold">{nextDue.toLocaleDateString('fa-IR')}</span>
                                  </p>
                              </div>
                              <div className="w-full sm:w-auto sm:mr-4 mt-4 sm:mt-0">
                                <Button 
                                    variant="success" 
                                    onClick={() => setExecutionSchedule(schedule)}
                                    className="w-full sm:w-auto"
                                >
                                    <CheckIcon className="ml-2" /> انجام شد
                                </Button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>
      
      {/* Stats / Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded shadow text-center">
              <span className="block text-gray-500 mb-1">کل برنامه‌ها</span>
              <span className="text-2xl font-bold">{schedules.length}</span>
          </div>
          <div className="bg-white p-4 rounded shadow text-center">
              <span className="block text-gray-500 mb-1">تعداد هشدار فعال</span>
              <span className="text-2xl font-bold text-orange-600">{alerts.length}</span>
          </div>
           <div className="bg-white p-4 rounded shadow text-center">
              <span className="block text-gray-500 mb-1">تاریخ امروز</span>
              <span className="text-2xl font-bold text-indigo-600">{new Date().toLocaleDateString('fa-IR')}</span>
          </div>
      </div>

      {/* Execution Modal */}
      {executionSchedule && (
          <TaskExecutionModal
              isOpen={!!executionSchedule}
              onClose={() => setExecutionSchedule(null)}
              schedule={executionSchedule}
              onSuccess={handleTaskComplete}
          />
      )}
    </div>
  );
};
