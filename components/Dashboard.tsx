
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAssetStatusCounts, getSetting, getAssetCountByFilter } from '../supabaseService';
import { Asset, CustomDashboardCard, AssetStatusItem } from '../types';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { AddIcon, AssetIcon, CategoryIcon, LocationIcon, CheckIcon, WarningIcon, TransferredListIcon, PhoneIcon, SettingsIcon, CnsFaultIcon } from './ui/Icons';
import { useSupabaseContext } from '../SupabaseContext';
import { SETTINGS_KEYS, DASHBOARD_MODULES_INFO } from '../constants';
import { useAuth } from '../AuthContext';
import { Header } from './layout/Header';

// =================================================================
// Main Dashboard (New Entry Point for the whole app)
// =================================================================
const ModuleCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }> = ({ title, description, icon, onClick, disabled = false, className = '' }) => (
  <div 
    className={`bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 flex flex-col items-center text-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    onClick={!disabled ? onClick : undefined}
  >
    <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full mb-4">
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

export const MainDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role?.name === 'Admin';
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);

  useEffect(() => {
      const loadOrder = async () => {
          setLoadingOrder(true);
          try {
              const savedOrder = await getSetting(SETTINGS_KEYS.DASHBOARD_ORDER);
              if (savedOrder) {
                  setModuleOrder(JSON.parse(savedOrder));
              } else {
                  // Default order if not set
                  setModuleOrder(DASHBOARD_MODULES_INFO.map(m => m.id));
              }
          } catch (e) {
              console.error("Failed to load dashboard order", e);
              setModuleOrder(DASHBOARD_MODULES_INFO.map(m => m.id));
          } finally {
              setLoadingOrder(false);
          }
      };
      loadOrder();
  }, []);

  // Define logic for each module
  const renderModule = (id: string) => {
      switch (id) {
          case 'open_processes':
              return (
                <ModuleCard 
                    key={id}
                    title="همه خرابی‌ها و تسک‌های باز"
                    description="مشاهده یکپارچه کلیه خرابی‌ها، هشدارهای نگهداری و تسک‌های باز در یک نگاه."
                    icon={<i className="fas fa-clipboard-list fa-3x"></i>}
                    onClick={() => navigate('/open-processes')}
                    className="border-2 border-indigo-200 bg-indigo-50"
                />
              );
          case 'shifts':
              return (
                <ModuleCard 
                    key={id}
                    title="تامین و تعویض شیفت"
                    description="مدیریت درخواست‌های مرخصی، تعویض شیفت و تامین نیرو توسط پرسنل."
                    icon={<i className="fas fa-calendar-alt fa-3x"></i>}
                    onClick={() => navigate('/shifts')}
                    className="border-2 border-blue-100 bg-blue-50/30"
                />
              );
          case 'assets':
              return (
                <ModuleCard 
                    key={id}
                    title="مدیریت اموال"
                    description="ردیابی و مدیریت کامل تجهیزات و دارایی‌ها."
                    icon={<AssetIcon className="fa-3x" />}
                    onClick={() => navigate('/asset-management')}
                />
              );
          case 'phone_lines':
              return (
                <ModuleCard 
                    key={id}
                    title="مدیریت خطوط تلفن"
                    description="مدیریت و تخصیص خطوط تلفن داخلی و شهری."
                    icon={<PhoneIcon className="fa-3x" />}
                    onClick={() => navigate('/phone-lines')}
                />
              );
          case 'contacts':
              return (
                <ModuleCard 
                    key={id}
                    title="مدیریت مخاطبین"
                    description="دفترچه تلفن و اطلاعات تماس همکاران و شرکت‌ها."
                    icon={<i className="fas fa-address-book fa-3x"></i>}
                    onClick={() => navigate('/contacts')}
                />
              );
          case 'cns':
              return (
                <ModuleCard 
                    key={id}
                    title="اعلام خرابی تجهیزات CNS"
                    description="ثبت و پیگیری خرابی‌های تجهیزات حیاتی ناوبری و ارتباطی."
                    icon={<CnsFaultIcon className="fa-3x" />}
                    onClick={() => navigate('/cns')}
                />
              );
          case 'maintenance':
              return (
                <ModuleCard 
                    key={id}
                    title="سرویس و نگهداری (PM)"
                    description="برنامه‌ریزی و پیگیری سرویس‌های دوره‌ای تجهیزات."
                    icon={<i className="fas fa-calendar-check fa-3x"></i>}
                    onClick={() => navigate('/maintenance')}
                />
              );
          case 'tasks':
              return (
                <ModuleCard 
                    key={id}
                    title="تسک‌ها و پیگیری"
                    description="تعریف وظایف، پیگیری انجام کارها و مدیریت تسک‌های روزانه."
                    icon={<i className="fas fa-tasks fa-3x"></i>}
                    onClick={() => navigate('/tasks')}
                />
              );
          case 'admin_users':
              return isAdmin ? (
                <ModuleCard 
                    key={id}
                    title="مدیریت کاربران"
                    description="ایجاد، ویرایش و مدیریت دسترسی کاربران سیستم."
                    icon={<i className="fas fa-users fa-3x"></i>}
                    onClick={() => navigate('/admin/users')}
                />
              ) : null;
          case 'admin_roles':
              return isAdmin ? (
                <ModuleCard 
                    key={id}
                    title="مدیریت نقش‌ها"
                    description="تعریف نقش‌های کاربری و سطوح دسترسی."
                    icon={<i className="fas fa-user-shield fa-3x"></i>}
                    onClick={() => navigate('/admin/roles')}
                />
              ) : null;
          case 'admin_sms':
              return isAdmin ? (
                <ModuleCard 
                    key={id}
                    title="مدیریت پیامک"
                    description="ارسال پیامک آزاد، مشاهده لاگ‌ها و وضعیت ارسال‌ها."
                    icon={<i className="fas fa-comment-sms fa-3x"></i>}
                    onClick={() => navigate('/tools/sms-test')}
                    className="border border-gray-200 bg-gray-50"
                />
              ) : null;
          default:
              return null;
      }
  };

  // Combine saved order with any new modules that might not be in the saved list yet
  const allModuleIds = DASHBOARD_MODULES_INFO.map(m => m.id);
  const finalOrder = [...new Set([...moduleOrder, ...allModuleIds])].filter(id => allModuleIds.includes(id));

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="سامانه جامع فرودگاه یاسوج" />
      <main className="container mx-auto p-6 md:p-10 relative min-h-[calc(100vh-80px)]">
        <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">انتخاب سامانه</h2>
        
        {loadingOrder ? (
            <div className="flex justify-center p-10"><Spinner /></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {finalOrder.map(id => renderModule(id))}
            </div>
        )}

        {/* Floating Action Button (FAB) */}
        <div className="fixed bottom-6 left-6 flex flex-col items-end space-y-4 z-50">
             {/* Menu Items */}
             <div className={`flex flex-col items-end space-y-3 transition-all duration-300 origin-bottom ${isFabOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-10 pointer-events-none'}`}>
                
                <button onClick={() => navigate('/tasks/new')} className="group flex items-center">
                    <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg mr-3 shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ثبت تسک جدید</span>
                    <div className="w-12 h-12 rounded-full bg-white text-indigo-600 shadow-lg flex items-center justify-center hover:bg-gray-50 border border-indigo-100 transition-transform hover:scale-105">
                        <i className="fas fa-tasks fa-lg"></i>
                    </div>
                </button>

                <button onClick={() => navigate('/cns/new-fault')} className="group flex items-center">
                     <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg mr-3 shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ثبت خرابی CNS</span>
                    <div className="w-12 h-12 rounded-full bg-white text-indigo-600 shadow-lg flex items-center justify-center hover:bg-gray-50 border border-indigo-100 transition-transform hover:scale-105">
                        <CnsFaultIcon className="fa-lg" />
                    </div>
                </button>

                <button onClick={() => navigate('/phone-lines/faults?action=new')} className="group flex items-center">
                     <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg mr-3 shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ثبت خرابی تلفن</span>
                    <div className="w-12 h-12 rounded-full bg-white text-indigo-600 shadow-lg flex items-center justify-center hover:bg-gray-50 border border-indigo-100 transition-transform hover:scale-105">
                        <PhoneIcon className="fa-lg" />
                    </div>
                </button>
             </div>

             {/* Toggle Button */}
             <button 
                onClick={() => setIsFabOpen(!isFabOpen)}
                className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl transition-all duration-300 ${isFabOpen ? 'bg-red-500 rotate-45' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-110'}`}
                title="دسترسی سریع"
             >
                 <AddIcon className="fa-lg" />
             </button>
        </div>

      </main>
    </div>
  );
};

// ... (بقیه فایل Dashboard.tsx بدون تغییر باقی می‌ماند)
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { categories, locations, assetStatuses, isLoading: isContextLoading } = useSupabaseContext();

  const [totalAssets, setTotalAssets] = useState(0);
  const [verifiedAssets, setVerifiedAssets] = useState(0); 
  const [externalAssets, setExternalAssets] = useState(0); // New State for External
  const [statusCounts, setStatusCounts] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customCards, setCustomCards] = useState<CustomDashboardCard[]>([]);
  const [customCardCounts, setCustomCardCounts] = useState<{ [key: string]: number }>({});
  const [isLoadingCustomCards, setIsLoadingCustomCards] = useState(true);


  const fetchAssetStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass all current status names to ensure we fetch counts for them
      const statusNames = assetStatuses.map(s => s.name);
      const counts = await getAssetStatusCounts(statusNames);
      setTotalAssets(counts.total);
      setVerifiedAssets(counts.verified);
      setExternalAssets(counts.external);
      setStatusCounts(counts);
    } catch (err: any) {
      setError(`خطا در بارگذاری آمار تجهیزات: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [assetStatuses]);

  const fetchCustomCards = useCallback(async () => {
    setIsLoadingCustomCards(true);
    try {
        const cardsJson = await getSetting(SETTINGS_KEYS.DASHBOARD_CARDS);
        const cards: CustomDashboardCard[] = cardsJson ? JSON.parse(cardsJson) : [];
        setCustomCards(cards);

        const countPromises = cards.map(card =>
            getAssetCountByFilter(card.filterType, card.filterValue, card.statusFilter)
        );
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
    if (!isContextLoading && assetStatuses.length > 0) {
      fetchAssetStats();
      fetchCustomCards();
    }
  }, [fetchAssetStats, fetchCustomCards, isContextLoading, assetStatuses]);

  if (isLoading || isContextLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 bg-red-100 rounded-lg">
        <p className="font-semibold">خطا:</p>
        <p>{error}</p>
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

  const CustomStatCard: React.FC<{ card: CustomDashboardCard, count: number }> = ({ card, count }) => {
    const params: { [key: string]: string } = {};
    if (card.filterType === 'category') {
        params.category = card.filterValue;
    } else {
        params.location = card.filterValue;
    }
    if (card.statusFilter !== 'all') {
        params.status = card.statusFilter;
    }
    const searchString = new URLSearchParams(params).toString();

    return (
        <Link to={`/asset-management/assets?${searchString}`} className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-lg transition-shadow duration-200 border-l-4 border-gray-500">
            <div>
                <h3 className="text-lg font-medium text-gray-700">{card.name}</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{count}</p>
            </div>
            <div className="mt-2 text-sm text-gray-500">
                <p>{card.filterType === 'category' ? 'دسته' : 'محل'}: {card.filterValueName}</p>
                <p>وضعیت: {card.statusFilter === 'all' ? 'همه' : card.statusFilter}</p>
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
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-right">داشبورد مدیریت اموال</h2>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 mb-10">
        <StatCard title="تعداد کل تجهیزات" value={totalAssets} icon={<AssetIcon className="fa-2x" />} color="text-indigo-600" linkTo="/asset-management/assets" />
        <StatCard title="اموال تایید شده" value={verifiedAssets} icon={<i className="fas fa-clipboard-check fa-2x"></i>} color="text-teal-600" linkTo="/asset-management/assets?verified=true" />
        <StatCard title="اموال خارج (تهران)" value={externalAssets} icon={<i className="fas fa-city fa-2x"></i>} color="text-purple-600" linkTo="/asset-management/assets?external=true" />
        
        {/* Dynamic Status Cards from Context */}
        {assetStatuses.map(status => {
            // Mapping known status icons or defaults
            let icon = <CheckIcon className="fa-2x" />;
            let color = "text-gray-600";
            
            if (status.name === 'در حال استفاده') { icon = <CheckIcon className="fa-2x" />; color = "text-green-600"; }
            else if (status.name === 'نیاز به تعمیر') { icon = <WarningIcon className="fa-2x" />; color = "text-yellow-600"; }
            else if (status.name === 'در انبار') { icon = <LocationIcon className="fa-2x" />; color = "text-blue-600"; }
            else if (status.name === 'منتقل شده') { icon = <TransferredListIcon className="fa-2x" />; color = "text-purple-600"; }

            return (
                <StatCard 
                    key={status.id}
                    title={status.name} 
                    value={statusCounts[status.name] || 0} 
                    icon={icon} 
                    color={color} 
                    linkTo={status.name === 'منتقل شده' ? "/asset-management/transferred-assets" : `/asset-management/assets?status=${encodeURIComponent(status.name)}`} 
                />
            );
        })}
      </div>

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
          title="مدیریت تجهیزات"
          description="مشاهده، ویرایش و حذف تجهیزات موجود یا افزودن تجهیزات جدید."
          onClick={() => navigate('/asset-management/assets')}
          icon={<AssetIcon className="fa-3x" />}
        />
        <ActionCard
          title="دسته بندی‌ها"
          description="مدیریت دسته بندی‌های تجهیزات برای سازماندهی بهتر."
          onClick={() => navigate('/asset-management/categories')}
          icon={<CategoryIcon className="fa-3x" />}
        />
        <ActionCard
          title="محل قرارگیری"
          description="مدیریت مکان‌های نگهداری تجهیزات و ردیابی جابجایی آن‌ها."
          onClick={() => navigate('/asset-management/locations')}
          icon={<LocationIcon className="fa-3x" />}
        />
      </div>
    </div>
  );
};
