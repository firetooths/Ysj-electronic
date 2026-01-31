
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getContactStats } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { AddIcon, ListIcon } from '../ui/Icons';
import { useSupabaseContext } from '../../SupabaseContext';

const StatCard: React.FC<{ title: string; value: number; icon: string; color: string; }> = ({ title, value, icon, color }) => (
  <div className={`bg-white rounded-lg shadow-md p-6 flex items-center space-x-4 space-x-reverse ${color} hover:shadow-lg transition-shadow duration-200`}>
    <div className={`p-3 rounded-full ${color.replace('text', 'bg').replace('-600', '-100')}`}>
      <i className={`${icon} fa-2x`}></i>
    </div>
    <div>
      <h3 className="text-lg font-medium text-gray-700">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  </div>
);

export const ContactDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading: isContextLoading } = useSupabaseContext();

  const [stats, setStats] = useState({ totalContacts: 0, totalGroups: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        if (isContextLoading) return;
        try {
            const data = await getContactStats();
            setStats(data);
        } catch (error) {
            console.error("Error fetching stats", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [isContextLoading]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-right">داشبورد مخاطبین</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="تعداد کل مخاطبین" value={stats.totalContacts} icon="fas fa-address-book" color="text-indigo-600" />
        <StatCard title="تعداد گروه‌ها" value={stats.totalGroups} icon="fas fa-users" color="text-green-600" />
      </div>

      <div className="flex space-x-4 space-x-reverse">
          <Button variant="primary" onClick={() => navigate('/contacts/list')}>
              <ListIcon className="ml-2" /> مشاهده لیست مخاطبین
          </Button>
          <Button variant="secondary" onClick={() => navigate('/contacts/new')}>
              <AddIcon className="ml-2" /> افزودن مخاطب جدید
          </Button>
      </div>
    </div>
  );
};