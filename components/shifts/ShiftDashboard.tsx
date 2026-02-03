
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { getShiftStats, getMyShiftRequests } from '../../services/shiftService';
import { ShiftRequest, ShiftRequestStatus, ShiftRequestType } from '../../types';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { FloatingShiftActions } from './FloatingShiftActions';
import { ShiftRequestCard } from './ShiftRequestCard';
import { SettingsIcon, BarChartIcon } from '../ui/Icons'; // Import Icon
import { useNavigate } from 'react-router-dom'; // Import navigate

export const ShiftDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [requests, setRequests] = useState<ShiftRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [s, r] = await Promise.all([
                getShiftStats(user.id),
                getMyShiftRequests(user.id)
            ]);
            setStats(s);
            setRequests(r);
        } catch (e) {
            console.error("Error loading shift data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [user]);

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    const pendingForMe = requests.filter(r => 
        (r.status === ShiftRequestStatus.PENDING_PROVIDER && r.provider_id === user?.id) ||
        (r.status === ShiftRequestStatus.PENDING_SUPERVISOR && r.supervisor_id === user?.id)
    );

    const isAdmin = user?.role?.name === 'Admin';

    return (
        <div className="container mx-auto p-4 md:p-6 bg-gray-50 min-h-screen relative">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-gray-900">مدیریت شیفت و مرخصی</h2>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/shifts/stats')}>
                        <BarChartIcon className="ml-2" /> آمار و اطلاعات
                    </Button>
                    {isAdmin && (
                        <Button variant="secondary" onClick={() => navigate('/shifts/settings')}>
                            <SettingsIcon className="ml-2" /> تنظیمات
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-xl shadow-md border-r-4 border-blue-500">
                    <h3 className="text-gray-500 text-sm mb-2">تامین‌های من (Approved)</h3>
                    <div className="flex justify-between items-end">
                        <span className="text-3xl font-bold text-blue-600">{stats?.month?.supply || 0}</span>
                        <span className="text-xs text-gray-400">در این ماه</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-r-4 border-indigo-500">
                    <h3 className="text-gray-500 text-sm mb-2">تعویض‌های من</h3>
                    <div className="flex justify-between items-end">
                        <span className="text-3xl font-bold text-indigo-600">{stats?.month?.exchange || 0}</span>
                        <span className="text-xs text-gray-400">در این ماه</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-r-4 border-green-500">
                    <h3 className="text-gray-500 text-sm mb-2">مرخصی‌های استفاده شده</h3>
                    <div className="flex justify-between items-end">
                        <span className="text-3xl font-bold text-green-600">{stats?.month?.leave || 0}</span>
                        <span className="text-xs text-gray-400">در این ماه</span>
                    </div>
                </div>
            </div>

            {/* Action Items */}
            {pendingForMe.length > 0 && (
                <div className="mb-10">
                    <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center">
                        <i className="fas fa-exclamation-circle ml-2"></i> مواردی که نیاز به تایید شما دارد
                    </h3>
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        {pendingForMe.map(req => (
                            <ShiftRequestCard key={req.id} request={req} isActionable onUpdate={loadData} />
                        ))}
                    </div>
                </div>
            )}

            {/* History Section */}
            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">تاریخچه درخواست‌های اخیر</h3>
                <div className="grid gap-4">
                    {requests.slice(0, 10).map(req => (
                        <ShiftRequestCard key={req.id} request={req} onUpdate={loadData} />
                    ))}
                </div>
            </div>

            <FloatingShiftActions onComplete={loadData} />
        </div>
    );
};
