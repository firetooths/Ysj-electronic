
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaintenanceSchedule } from '../../../types';
import { getMaintenanceSchedules, deleteMaintenanceSchedule, calculateNextDueDate } from '../../../services/cnsMaintenanceService';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { AddIcon, EditIcon, DeleteIcon, DetailsIcon } from '../../ui/Icons';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

export const ScheduleList: React.FC = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
      loadData();
  }, []);

  const loadData = async () => {
      setIsLoading(true);
      try {
          const data = await getMaintenanceSchedules();
          setSchedules(data);
      } catch (err) {
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDelete = async () => {
      if (!deleteId) return;
      try {
          await deleteMaintenanceSchedule(deleteId);
          setDeleteId(null);
          loadData();
      } catch (err) {
          alert('خطا در حذف');
      }
  };

  const getDaysRemaining = (dueDate: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(dueDate);
      target.setHours(0, 0, 0, 0);
      
      const diffTime = target.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (isLoading) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-900">مدیریت برنامه‌های نگهداری</h2>
          <Button variant="primary" onClick={() => navigate('/maintenance/new')}>
              <AddIcon className="ml-2" /> افزودن برنامه
          </Button>
      </div>

      <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">عنوان فعالیت</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">بازه تکرار</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">آخرین انجام</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">سررسید بعدی</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">وضعیت زمانی</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">عملیات</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {schedules.map(item => {
                      const nextDue = calculateNextDueDate(item);
                      const daysRem = getDaysRemaining(nextDue);
                      let statusBadge = <span className="text-gray-500 text-xs">---</span>;
                      
                      if (daysRem < 0) {
                          statusBadge = <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">{Math.abs(daysRem)} روز گذشته</span>;
                      } else if (daysRem === 0) {
                           statusBadge = <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">امروز</span>;
                      } else if (daysRem <= item.warning_days) {
                           statusBadge = <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">{daysRem} روز مانده</span>;
                      } else {
                           statusBadge = <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{daysRem} روز مانده</span>;
                      }

                      return (
                        <tr 
                            key={item.id} 
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/maintenance/details/${item.id}`)}
                        >
                            <td className="px-4 py-3 font-medium">{item.title}</td>
                            <td className="px-4 py-3 text-sm">{item.recurrence_type}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                                {item.last_performed_at ? new Date(item.last_performed_at).toLocaleDateString('fa-IR') : '---'}
                            </td>
                            <td className="px-4 py-3 text-indigo-600 font-semibold text-sm">
                                {nextDue.toLocaleDateString('fa-IR')}
                            </td>
                             <td className="px-4 py-3 text-center">
                                {statusBadge}
                            </td>
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-center space-x-1 space-x-reverse">
                                    <Button variant="ghost" size="sm" onClick={() => navigate(`/maintenance/edit/${item.id}`)} title="ویرایش">
                                        <EditIcon />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)} title="حذف">
                                        <DeleteIcon className="text-red-600" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                      );
                  })}
                  {schedules.length === 0 && <tr><td colSpan={6} className="text-center p-6 text-gray-500">موردی یافت نشد.</td></tr>}
              </tbody>
          </table>
      </div>

      <ConfirmDialog 
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          title="حذف برنامه"
          message="آیا از حذف این برنامه نگهداری اطمینان دارید؟ تمامی سوابق آن نیز حذف خواهد شد."
          confirmText="حذف"
      />
    </div>
  );
};
