
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MaintenanceSchedule, CNSMaintenanceLog } from '../../../types';
import { getMaintenanceScheduleById, getMaintenanceLogs, deleteMaintenanceSchedule, calculateNextDueDate } from '../../../services/cnsMaintenanceService';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { EditIcon, DeleteIcon, CheckIcon, InfoIcon } from '../../ui/Icons';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { TaskExecutionModal } from './TaskExecutionModal';

export const ScheduleDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [logs, setLogs] = useState<CNSMaintenanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);

  useEffect(() => {
      loadData();
  }, [id]);

  const loadData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
          const data = await getMaintenanceScheduleById(id);
          if (data) {
              setSchedule(data);
              const logData = await getMaintenanceLogs(id);
              setLogs(logData);
          }
      } catch (err) {
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDelete = async () => {
      if (!schedule) return;
      try {
          await deleteMaintenanceSchedule(schedule.id);
          navigate('/maintenance/list');
      } catch (err) {
          alert('خطا در حذف');
      }
  };

  const handleTaskComplete = () => {
      setIsExecutionModalOpen(false);
      loadData(); // Refresh data to show new log and updated dates
  };

  if (isLoading) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (!schedule) return <div className="text-center p-10">برنامه یافت نشد.</div>;

  const nextDue = calculateNextDueDate(schedule);

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{schedule.title}</h2>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                    بازه تکرار: {schedule.recurrence_type}
                </span>
            </div>
            <div className="flex space-x-2 space-x-reverse">
                <Button variant="success" onClick={() => setIsExecutionModalOpen(true)}>
                    <CheckIcon className="ml-2" /> ثبت انجام کار
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/maintenance/edit/${schedule.id}`)}>
                    <EditIcon className="ml-2" /> ویرایش
                </Button>
                <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <DeleteIcon className="ml-2" /> حذف
                </Button>
            </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <div className="bg-blue-50 p-4 rounded border border-blue-100">
                 <span className="block text-sm text-gray-600 mb-1">تاریخ شروع</span>
                 <span className="text-lg font-bold text-gray-800">{new Date(schedule.start_date).toLocaleDateString('fa-IR')}</span>
             </div>
             <div className="bg-indigo-50 p-4 rounded border border-indigo-100">
                 <span className="block text-sm text-gray-600 mb-1">سررسید بعدی</span>
                 <span className="text-lg font-bold text-indigo-700">{nextDue.toLocaleDateString('fa-IR')}</span>
             </div>
             <div className="bg-green-50 p-4 rounded border border-green-100">
                 <span className="block text-sm text-gray-600 mb-1">آخرین انجام</span>
                 <span className="text-lg font-bold text-green-700">
                     {schedule.last_performed_at ? new Date(schedule.last_performed_at).toLocaleDateString('fa-IR') : 'انجام نشده'}
                 </span>
             </div>
        </div>

        {/* Description Section */}
        <div className="mb-8 p-4 bg-gray-50 rounded border">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                <InfoIcon className="ml-2 text-gray-500" /> توضیحات و دستورالعمل‌ها
            </h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {schedule.description || 'توضیحاتی ثبت نشده است.'}
            </div>
        </div>

        {/* History Section */}
        <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">تاریخچه انجام کار</h3>
            {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">هنوز سابقه‌ای برای این فعالیت ثبت نشده است.</p>
            ) : (
                <div className="space-y-4">
                    {logs.map(log => (
                        <div key={log.id} className="bg-white border p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row justify-between text-sm mb-2">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-gray-800">توسط: {log.performer}</span>
                                    <span className="text-gray-500">{new Date(log.performed_at).toLocaleString('fa-IR')}</span>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded text-gray-700 text-sm mb-3 border border-gray-100">
                                {log.notes || 'بدون توضیحات'}
                            </div>
                            <div className="flex gap-4 flex-wrap">
                                {log.audio_url && (
                                    <audio controls src={log.audio_url} className="h-8 w-64" />
                                )}
                                {log.image_url && (
                                    <a href={log.image_url} target="_blank" rel="noreferrer" className="block h-16 w-16 border rounded overflow-hidden hover:opacity-80 transition-opacity">
                                        <img src={log.image_url} className="w-full h-full object-cover" alt="proof" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <ConfirmDialog 
            isOpen={isDeleteConfirmOpen}
            onClose={() => setIsDeleteConfirmOpen(false)}
            onConfirm={handleDelete}
            title="حذف برنامه"
            message="آیا از حذف این برنامه نگهداری اطمینان دارید؟"
            confirmText="حذف"
        />

        {isExecutionModalOpen && schedule && (
            <TaskExecutionModal
                isOpen={isExecutionModalOpen}
                onClose={() => setIsExecutionModalOpen(false)}
                schedule={schedule}
                onSuccess={handleTaskComplete}
            />
        )}
    </div>
  );
};
