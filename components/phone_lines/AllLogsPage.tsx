import React, { useState, useEffect, useCallback } from 'react';
import { PhoneLineLog } from '../../types';
import { getAllPhoneLineLogs } from '../../supabaseService';
import { useSupabaseContext } from '../../SupabaseContext';
import { Spinner } from '../ui/Spinner';
import { LogIcon } from '../ui/Icons';

export const AllLogsPage: React.FC = () => {
    const { isLoading: isContextLoading } = useSupabaseContext();
    const [logs, setLogs] = useState<PhoneLineLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAllPhoneLineLogs();
            setLogs(data);
        } catch (err: any) {
            setError(`خطا در بارگذاری تاریخچه کلی: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isContextLoading) {
            fetchLogs();
        }
    }, [isContextLoading, fetchLogs]);

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">تاریخچه کلی عملیات خطوط</h2>
            
            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

            <div className="overflow-x-auto custom-scrollbar rounded-lg shadow-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاریخ و زمان</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">کاربر</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره تلفن</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شرح عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    <LogIcon className="mx-auto text-4xl text-gray-400 mb-4" />
                                    هیچ لاگی برای نمایش وجود ندارد.
                                </td>
                            </tr>
                        ) : (
                            logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" dir="ltr">{new Date(log.changed_at).toLocaleString('fa-IR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700">{log.user_id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{log.phone_line?.phone_number || log.phone_line_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{log.change_description}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};