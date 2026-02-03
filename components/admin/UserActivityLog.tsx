
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserById } from '../../services/authService';
import { getUserActivityLogs, UserActivityItem } from '../../services/adminService';
import { User } from '../../types';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { LogIcon } from '../ui/Icons';

export const UserActivityLog: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [user, setUser] = useState<User | null>(null);
    const [activities, setActivities] = useState<UserActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                // 1. Get User Info
                const userData = await getUserById(id);
                if (!userData) {
                    setError('کاربر یافت نشد.');
                    return;
                }
                setUser(userData);

                // 2. Get Logs
                const logs = await getUserActivityLogs(userData.username, userData.full_name);
                setActivities(logs);

            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const getModuleColor = (type: string) => {
        switch (type) {
            case 'ASSET': return 'bg-blue-100 text-blue-800';
            case 'PHONE': return 'bg-indigo-100 text-indigo-800';
            case 'CNS_FAULT': return 'bg-orange-100 text-orange-800';
            case 'MAINTENANCE': return 'bg-green-100 text-green-800';
            case 'TASK': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getModuleIcon = (type: string) => {
        switch (type) {
            case 'ASSET': return 'fa-box';
            case 'PHONE': return 'fa-phone';
            case 'CNS_FAULT': return 'fa-satellite-dish';
            case 'MAINTENANCE': return 'fa-tools';
            case 'TASK': return 'fa-tasks';
            default: return 'fa-info-circle';
        }
    };

    if (isLoading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;

    if (error) {
        return (
            <div className="container mx-auto p-6">
                <div className="bg-red-50 border-r-4 border-red-500 p-4 text-red-700">
                    <p>{error}</p>
                    <Button variant="secondary" onClick={() => navigate('/admin/users')} className="mt-2">بازگشت به لیست کاربران</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        <LogIcon className="ml-2 text-indigo-600" />
                        فعالیت‌های اخیر کاربر
                    </h2>
                    {user && (
                        <p className="text-gray-600 mt-1 text-sm">
                            کاربر: <span className="font-bold">{user.full_name || user.username}</span> ({user.username})
                        </p>
                    )}
                </div>
                <Button variant="secondary" onClick={() => navigate('/admin/users')}>
                    <i className="fas fa-arrow-right ml-2"></i> بازگشت
                </Button>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                {activities.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                        هیچ فعالیتی برای این کاربر در ۱۰۰ رکورد اخیر سیستم یافت نشد.
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ماژول</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاریخ و زمان</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شرح فعالیت</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {activities.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModuleColor(log.type)}`}>
                                            <i className={`fas ${getModuleIcon(log.type)} ml-1.5`}></i>
                                            {log.moduleName}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dir-ltr text-right">
                                        {new Date(log.date).toLocaleString('fa-IR')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-800 leading-relaxed">
                                        {log.description}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
            <div className="mt-4 text-xs text-gray-400 text-center">
                نمایش حداکثر ۱۰۰ فعالیت اخیر ثبت شده در سیستم
            </div>
        </div>
    );
};
