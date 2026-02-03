
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCNSFaultReports, getCNSEquipments } from '../../services/cnsService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { AddIcon, ListIcon, CnsFaultIcon, CheckIcon, WarningIcon } from '../ui/Icons';
import { CNSFaultStatus } from '../../types';

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

export const CNSDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ active: 0, closed: 0, totalEquipment: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const faults = await getCNSFaultReports('ALL');
            const equipments = await getCNSEquipments();
            
            const active = faults.filter(f => f.status !== CNSFaultStatus.CLOSED).length;
            const closed = faults.filter(f => f.status === CNSFaultStatus.CLOSED).length;
            
            setStats({ active, closed, totalEquipment: equipments.length });
        } catch (error) {
            console.error("Error fetching CNS stats", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-right">داشبورد مدیریت خرابی CNS</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <StatCard 
            title="خرابی‌های فعال" 
            value={stats.active} 
            icon={<WarningIcon className="fa-2x" />} 
            color="text-red-600" 
            onClick={() => navigate('/cns/faults?status=active')}
        />
        <StatCard 
            title="خرابی‌های رفع شده" 
            value={stats.closed} 
            icon={<CheckIcon className="fa-2x" />} 
            color="text-green-600" 
            onClick={() => navigate('/cns/faults?status=closed')}
        />
        <StatCard 
            title="تجهیزات ثبت شده" 
            value={stats.totalEquipment} 
            icon={<CnsFaultIcon className="fa-2x" />} 
            color="text-indigo-600" 
            onClick={() => navigate('/cns/equipment')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-lg shadow flex flex-col items-center text-center">
             <h3 className="text-lg font-bold mb-4">عملیات سریع</h3>
             <Button variant="primary" fullWidth className="mb-3" onClick={() => navigate('/cns/new-fault')}>
                 <AddIcon className="ml-2" /> ثبت خرابی جدید
             </Button>
             <Button variant="secondary" fullWidth onClick={() => navigate('/cns/faults')}>
                 <ListIcon className="ml-2" /> مشاهده لیست خرابی‌ها
             </Button>
         </div>
         <div className="bg-white p-6 rounded-lg shadow flex flex-col items-center text-center">
             <h3 className="text-lg font-bold mb-4">مدیریت تجهیزات</h3>
             <p className="text-gray-600 text-sm mb-4">تعریف و ویرایش لیست تجهیزات CNS و لینک به اموال</p>
             <Button variant="outline" fullWidth onClick={() => navigate('/cns/equipment')}>
                 مدیریت تجهیزات
             </Button>
         </div>
      </div>
    </div>
  );
};
