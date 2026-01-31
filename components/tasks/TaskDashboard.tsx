
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTasks } from '../../services/taskService';
import { TaskStatus } from '../../types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { AddIcon, ListIcon, CheckIcon, WarningIcon } from '../ui/Icons';

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; onClick?: () => void }> = ({ title, value, icon, color, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-lg shadow-md p-6 flex items-center space-x-4 space-x-reverse ${color} hover:shadow-lg transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
  >
    <div className={`p-3 rounded-full ${color.replace('text', 'bg').replace('-600', '-100')}`}>
      {icon}
    </div>
    <div>
      <h3 className="text-lg font-medium text-gray-700">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  </div>
);

export const TaskDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, done: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const tasks = await getTasks();
            const pending = tasks.filter(t => t.status === TaskStatus.PENDING).length;
            const done = tasks.filter(t => t.status === TaskStatus.DONE).length;
            setStats({ pending, done });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
  }
  
  if (error) {
      return <div className="p-6 text-red-600 bg-red-50 rounded">{error}</div>
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-right">داشبورد تسک‌ها و پیگیری</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        <StatCard 
            title="در حال انجام" 
            value={stats.pending} 
            icon={<WarningIcon className="fa-2x" />} 
            color="text-orange-600" 
            onClick={() => navigate('/tasks/list?status=pending')}
        />
        <StatCard 
            title="انجام شده" 
            value={stats.done} 
            icon={<CheckIcon className="fa-2x" />} 
            color="text-green-600" 
            onClick={() => navigate('/tasks/list?status=done')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white p-6 rounded-lg shadow flex flex-col items-center text-center">
             <h3 className="text-lg font-bold mb-4">عملیات سریع</h3>
             <Button variant="primary" fullWidth className="mb-3" onClick={() => navigate('/tasks/new')}>
                 <AddIcon className="ml-2" /> افزودن تسک جدید
             </Button>
             <Button variant="secondary" fullWidth onClick={() => navigate('/tasks/list')}>
                 <ListIcon className="ml-2" /> مشاهده لیست همه تسک‌ها
             </Button>
         </div>
         <div className="bg-white p-6 rounded-lg shadow flex flex-col items-center text-center justify-center text-gray-600">
             <i className="fas fa-clipboard-check fa-3x mb-3 text-indigo-300"></i>
             <p>با استفاده از این سامانه، وظایف را تعریف، پیگیری و مدیریت کنید.</p>
         </div>
      </div>
    </div>
  );
};
