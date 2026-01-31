import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPhoneLineStats, getSetting, getPhoneLineCountByTags } from '../../supabaseService';
import { PhoneLineDashboardCard } from '../../types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { ListIcon, NodeIcon, SettingsIcon, PhoneIcon, WrenchIcon } from '../ui/Icons';
import { useSupabaseContext } from '../../SupabaseContext';
import { SETTINGS_KEYS } from '../../constants';

export const PhoneLineDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading: isContextLoading } = useSupabaseContext();

  const [stats, setStats] = useState({ totalLines: 0, activeFaults: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [customCards, setCustomCards] = useState<PhoneLineDashboardCard[]>([]);
  const [customCardCounts, setCustomCardCounts] = useState<{ [key: string]: number }>({});
  const [isLoadingCustomCards, setIsLoadingCustomCards] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const fetchedStats = await getPhoneLineStats();
      setStats(fetchedStats);
    } catch (err: any) {
      setStatsError(`خطا در بارگذاری آمار: ${err.message}`);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  const fetchCustomCards = useCallback(async () => {
    setIsLoadingCustomCards(true);
    try {
      const cardsJson = await getSetting(SETTINGS_KEYS.PHONE_LINE_DASHBOARD_CARDS);
      const cards: PhoneLineDashboardCard[] = cardsJson ? JSON.parse(cardsJson) : [];
      setCustomCards(cards);

      const countPromises = cards.map(card => getPhoneLineCountByTags(card.tagIds));
      const counts = await Promise.all(countPromises);
      
      const countsMap: { [key: string]: number } = {};
      cards.forEach((card, index) => {
        countsMap[card.id] = counts[index];
      });
      setCustomCardCounts(countsMap);

    } catch (e: any) {
      console.error("Failed to load custom dashboard cards:", e.message);
    } finally {
      setIsLoadingCustomCards(false);
    }
  }, []);

  useEffect(() => {
    if (!isContextLoading) {
      fetchStats();
      fetchCustomCards();
    }
  }, [fetchStats, fetchCustomCards, isContextLoading]);

  if (isContextLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }
  
  const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; color: string; linkTo: string }> = ({
    title,
    value,
    icon,
    color,
    linkTo,
  }) => (
    <Link to={linkTo} className={`bg-white rounded-lg shadow-md p-6 flex items-center space-x-4 space-x-reverse ${color} hover:shadow-lg transition-shadow duration-200`}>
      <div className={`p-3 rounded-full ${color.replace('text', 'bg').replace('-600', '-100')}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-700">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </Link>
  );

  const CustomStatCard: React.FC<{ card: PhoneLineDashboardCard, count: number }> = ({ card, count }) => {
    // Note: Linking to a pre-filtered list can be added later if needed.
    // For now, it just links to the main list.
    return (
        <Link to="/phone-lines/list" className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-lg transition-shadow duration-200 border-l-4 border-gray-500">
            <div>
                <h3 className="text-lg font-medium text-gray-700">{card.name}</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{count}</p>
            </div>
            <div className="mt-2 text-sm text-gray-500">
                <p>تگ‌ها: {card.tagNames.join(', ')}</p>
            </div>
        </Link>
    );
};

  const ActionCard: React.FC<{ title: string; description: string; onClick: () => void; icon: React.ReactNode }> = ({
    title,
    description,
    onClick,
    icon,
  }) => (
    <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow duration-200">
      <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <Button variant="primary" onClick={onClick}>
        شروع کنید
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-right">داشبورد مدیریت خطوط تلفن</h2>

      {/* Key Statistics */}
      {isLoadingStats ? <div className="flex justify-center"><Spinner /></div> : statsError ? (
         <div className="text-red-600 p-4 bg-red-100 rounded-lg mb-8">{statsError}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard title="تعداد کل خطوط" value={stats.totalLines} icon={<PhoneIcon className="fa-2x" />} color="text-indigo-600" linkTo="/phone-lines/list" />
            <StatCard title="خرابی‌های فعال" value={stats.activeFaults} icon={<WrenchIcon className="fa-2x" />} color="text-red-600" linkTo="/phone-lines/faults" />
        </div>
      )}

      {/* Custom Cards */}
      {(customCards.length > 0 || isLoadingCustomCards) && (
        <>
            <h3 className="text-2xl font-bold text-gray-800 mb-6 mt-10 border-t pt-6">کارت‌های سفارشی</h3>
            {isLoadingCustomCards ? <div className="flex justify-center"><Spinner /></div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-10">
                    {customCards.map(card => (
                        <CustomStatCard key={card.id} card={card} count={customCardCounts[card.id] ?? 0} />
                    ))}
                </div>
            )}
        </>
      )}

      {/* Quick Actions / Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ActionCard
          title="لیست خطوط"
          description="جستجو، ویرایش، حذف و مشاهده تمام خطوط تلفن ثبت شده."
          onClick={() => navigate('/phone-lines/list')}
          icon={<ListIcon className="fa-3x" />}
        />
        <ActionCard
          title="مدیریت گره‌ها"
          description="ایجاد و ویرایش گره‌های شبکه مانند MDF، اسلات و پریز."
          onClick={() => navigate('/phone-lines/nodes')}
          icon={<NodeIcon className="fa-3x" />}
        />
        <ActionCard
          title="تنظیمات"
          description="تنظیمات مربوط به رنگ زوج سیم‌ها و کارت‌های داشبورد."
          onClick={() => navigate('/phone-lines/settings')}
          icon={<SettingsIcon className="fa-3x" />}
        />
      </div>
    </div>
  );
};