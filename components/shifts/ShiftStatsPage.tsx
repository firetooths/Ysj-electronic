
import React, { useState, useEffect, useMemo } from 'react';
import { getAllApprovedShiftRequests } from '../../services/shiftService';
import { getUsers } from '../../services/authService';
import { ShiftRequest, ShiftRequestType, User } from '../../types';
import { Spinner } from '../ui/Spinner';
import { toJalali, JALALI_MONTH_NAMES, formatGregorianToJalali } from '../../utils/dateUtils';
import { BarChartIcon, CloseIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal'; // Import Modal
import { Button } from '../ui/Button';

// --- Helper Components ---

interface StatCardProps {
    title: string;
    value: number;
    icon: string;
    color: string;
    subText?: string;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subText, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white rounded-xl shadow p-5 flex items-center justify-between border-b-4 ${color} transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:bg-gray-50' : ''}`}
    >
        <div>
            <p className="text-gray-500 text-xs font-bold mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
            {subText && <p className="text-[10px] text-gray-400 mt-1">{subText}</p>}
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-sm ${color.replace('border-', 'bg-')}`}>
            <i className={`fas ${icon}`}></i>
        </div>
    </div>
);

const SimpleBarChart: React.FC<{ data: number[], labels: string[], title: string, colorClass: string }> = ({ data, labels, title, colorClass }) => {
    const max = Math.max(...data, 1);
    return (
        <div className="bg-white p-4 rounded-xl shadow border border-gray-100 h-full">
            <h4 className="font-bold text-gray-700 mb-6 text-sm border-b pb-2">{title}</h4>
            <div className="flex items-end justify-between h-48 gap-1 sm:gap-2 px-2">
                {data.map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none whitespace-nowrap z-10">
                            {labels[idx]}: {val}
                        </div>
                        
                        <div className="w-full h-full flex items-end justify-center">
                             <div 
                                className={`w-full max-w-[20px] rounded-t-sm transition-all duration-700 relative ${colorClass} group-hover:brightness-90`} 
                                style={{ height: `${(val / max) * 100}%`, minHeight: val > 0 ? '4px' : '0' }}
                            >
                            </div>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 mt-2 rotate-45 sm:rotate-0 origin-top-left sm:origin-center w-full text-center truncate">
                            {labels[idx]}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface GroupedBarChartProps {
    title: string;
    labels: string[];
    data1: number[]; // Supply (Green)
    data2: number[]; // Demand (Red/Indigo)
    label1: string;
    label2: string;
    color1: string;
    color2: string;
}

const GroupedBarChart: React.FC<GroupedBarChartProps> = ({ title, labels, data1, data2, label1, label2, color1, color2 }) => {
    const max = Math.max(...data1, ...data2, 1);

    return (
        <div className="bg-white p-4 rounded-xl shadow border border-gray-100 h-full">
            <div className="flex flex-wrap justify-between items-center mb-6 border-b pb-2">
                <h4 className="font-bold text-gray-700 text-sm">{title}</h4>
                <div className="flex gap-3 text-[10px] sm:text-xs">
                    <div className="flex items-center">
                        <span className={`w-3 h-3 rounded-full ${color1} mr-1`}></span>
                        <span>{label1}</span>
                    </div>
                    <div className="flex items-center">
                        <span className={`w-3 h-3 rounded-full ${color2} mr-1`}></span>
                        <span>{label2}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-end justify-between h-48 gap-1 sm:gap-2 px-1">
                {labels.map((label, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group">
                        <div className="flex items-end justify-center w-full h-full gap-[1px] sm:gap-1">
                            {/* Bar 1: Supply */}
                            <div className="relative w-1/2 flex items-end justify-center h-full group/bar1">
                                <div className="absolute -top-8 opacity-0 group-hover/bar1:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none z-20">
                                    {data1[idx]}
                                </div>
                                <div 
                                    className={`w-full max-w-[12px] rounded-t-sm transition-all duration-700 ${color1} hover:opacity-80`} 
                                    style={{ height: `${(data1[idx] / max) * 100}%`, minHeight: data1[idx] > 0 ? '4px' : '0' }}
                                ></div>
                            </div>

                            {/* Bar 2: Demand */}
                            <div className="relative w-1/2 flex items-end justify-center h-full group/bar2">
                                <div className="absolute -top-8 opacity-0 group-hover/bar2:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none z-20">
                                    {data2[idx]}
                                </div>
                                <div 
                                    className={`w-full max-w-[12px] rounded-t-sm transition-all duration-700 ${color2} hover:opacity-80`} 
                                    style={{ height: `${(data2[idx] / max) * 100}%`, minHeight: data2[idx] > 0 ? '4px' : '0' }}
                                ></div>
                            </div>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 mt-2 rotate-45 sm:rotate-0 origin-top-left sm:origin-center w-full text-center truncate">
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Types for Detail Modal
type StatDetailType = 'LEAVES' | 'SUPPLY' | 'DEMAND' | 'INVITATIONS' | null;

export const ShiftStatsPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role?.name === 'Admin';

    const [requests, setRequests] = useState<ShiftRequest[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        const now = new Date();
        const [jy] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        return jy;
    });

    const [activeDetailType, setActiveDetailType] = useState<StatDetailType>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const reqs = await getAllApprovedShiftRequests();
                setRequests(reqs);

                if (isAdmin) {
                    const allUsers = await getUsers();
                    setUsers(allUsers);
                    if (currentUser) setSelectedUserId(currentUser.id);
                } else if (currentUser) {
                    setSelectedUserId(currentUser.id);
                }
            } catch (e) {
                console.error("Error fetching stats data:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isAdmin, currentUser]);

    // --- Processing Data (Core Logic) ---
    const stats = useMemo(() => {
        if (!selectedUserId) return null;

        const monthlyData = {
            leaves: new Array(12).fill(0),
            exchangesReq: new Array(12).fill(0),
            exchangesProv: new Array(12).fill(0),
            invitations: new Array(12).fill(0),
        };

        const interactionMap: Record<string, { iCovered: number, theyCovered: number }> = {};

        let totalLeaves = 0;
        let totalSickLeaves = 0;
        let totalExchangesRequested = 0;
        let totalShiftsCovered = 0; 
        let totalInvitations = 0;

        requests.forEach(req => {
            const isRequester = req.requester_id === selectedUserId;
            const isProvider = req.provider_id === selectedUserId;
            
            if (!isRequester && !isProvider) return;

            req.dates.forEach(dateStr => {
                const d = new Date(dateStr);
                const [jy, jm] = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());

                if (jy === selectedYear) {
                    const monthIndex = jm - 1;

                    if (req.request_type === ShiftRequestType.LEAVE || req.request_type === ShiftRequestType.SICK_LEAVE) {
                        if (isRequester) {
                            monthlyData.leaves[monthIndex]++;
                            if (req.request_type === ShiftRequestType.LEAVE) totalLeaves++;
                            else totalSickLeaves++;
                        }
                    } 
                    else if (req.request_type === ShiftRequestType.EXCHANGE) {
                        if (isRequester) {
                            monthlyData.exchangesReq[monthIndex]++;
                            totalExchangesRequested++;
                            
                            const providerName = req.provider?.full_name || req.provider?.username || 'نامشخص';
                            if (!interactionMap[providerName]) interactionMap[providerName] = { iCovered: 0, theyCovered: 0 };
                            interactionMap[providerName].theyCovered++;
                        }
                        if (isProvider) {
                            monthlyData.exchangesProv[monthIndex]++;
                            totalShiftsCovered++;

                            const requesterName = req.requester?.full_name || req.requester?.username || 'نامشخص';
                            if (!interactionMap[requesterName]) interactionMap[requesterName] = { iCovered: 0, theyCovered: 0 };
                            interactionMap[requesterName].iCovered++;
                        }
                    } 
                    else if (req.request_type === ShiftRequestType.INVITATION) {
                        if (isRequester) {
                            monthlyData.invitations[monthIndex]++;
                            totalInvitations++;
                        }
                    }
                }
            });
        });

        const interactionTable = Object.entries(interactionMap).map(([name, counts]) => ({
            name,
            ...counts
        })).sort((a, b) => (b.iCovered + b.theyCovered) - (a.iCovered + a.theyCovered));

        return { 
            monthlyData, 
            totalLeaves, 
            totalSickLeaves, 
            totalExchangesRequested, 
            totalShiftsCovered, 
            totalInvitations, 
            interactionTable 
        };
    }, [requests, selectedYear, selectedUserId]);

    // --- Filter Requests for Modal ---
    const detailList = useMemo(() => {
        if (!activeDetailType || !selectedUserId) return [];

        return requests.filter(req => {
            // Check if ANY date in request matches selected year
            const hasDateInYear = req.dates.some(dateStr => {
                const d = new Date(dateStr);
                const [jy] = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                return jy === selectedYear;
            });
            if (!hasDateInYear) return false;

            const isRequester = req.requester_id === selectedUserId;
            const isProvider = req.provider_id === selectedUserId;

            switch (activeDetailType) {
                case 'LEAVES':
                    return isRequester && (req.request_type === ShiftRequestType.LEAVE || req.request_type === ShiftRequestType.SICK_LEAVE);
                case 'SUPPLY':
                    return isProvider && req.request_type === ShiftRequestType.EXCHANGE;
                case 'DEMAND':
                    return isRequester && req.request_type === ShiftRequestType.EXCHANGE;
                case 'INVITATIONS':
                    return isRequester && req.request_type === ShiftRequestType.INVITATION;
                default:
                    return false;
            }
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [requests, selectedYear, selectedUserId, activeDetailType]);

    const getModalTitle = () => {
        switch (activeDetailType) {
            case 'LEAVES': return 'جزئیات مرخصی‌ها';
            case 'SUPPLY': return 'جزئیات شیفت‌های پوشش داده شده (Supply)';
            case 'DEMAND': return 'جزئیات درخواست‌های تعویض (Demand)';
            case 'INVITATIONS': return 'جزئیات دعوت به کارها';
            default: return '';
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    const selectedUserObj = users.find(u => u.id === selectedUserId);

    return (
        <div className="container mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
            
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex items-center">
                    <BarChartIcon className="ml-2 text-indigo-600 fa-2x" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">آمار و عملکرد شیفت</h2>
                        {isAdmin && (
                            <p className="text-xs text-gray-500">مشاهده آمار برای: <span className="font-bold text-indigo-700">{selectedUserObj?.full_name || selectedUserObj?.username || 'خودم'}</span></p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    {isAdmin && (
                        <div className="w-full sm:w-64">
                            <Select
                                options={users.map(u => ({ value: u.id, label: u.full_name || u.username }))}
                                value={selectedUserId}
                                onChange={e => setSelectedUserId(e.target.value)}
                                fullWidth
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-center bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                        <button onClick={() => setSelectedYear(selectedYear - 1)} className="px-3 py-1 hover:bg-white rounded shadow-sm transition-all text-gray-600"><i className="fas fa-chevron-right"></i></button>
                        <span className="font-bold px-4 text-indigo-700 select-none">{selectedYear}</span>
                        <button onClick={() => setSelectedYear(selectedYear + 1)} className="px-3 py-1 hover:bg-white rounded shadow-sm transition-all text-gray-600"><i className="fas fa-chevron-left"></i></button>
                    </div>
                </div>
            </div>

            {stats ? (
                <>
                    {/* KPI Cards - Clickable */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard 
                            title="مرخصی‌های گرفته شده" 
                            value={stats.totalLeaves + stats.totalSickLeaves} 
                            icon="fa-calendar-minus" 
                            color="border-yellow-500" 
                            subText={`روزانه: ${stats.totalLeaves} | استعلاجی: ${stats.totalSickLeaves}`}
                            onClick={() => setActiveDetailType('LEAVES')}
                        />
                        <StatCard 
                            title="شیفت‌های پوشش داده شده (Supply)" 
                            value={stats.totalShiftsCovered} 
                            icon="fa-user-shield" 
                            color="border-green-500"
                            subText="تعداد روزهایی که جای دیگران بودید"
                            onClick={() => setActiveDetailType('SUPPLY')}
                        />
                        <StatCard 
                            title="درخواست‌های تعویض (Demand)" 
                            value={stats.totalExchangesRequested} 
                            icon="fa-exchange-alt" 
                            color="border-indigo-500"
                            subText="تعداد روزهایی که دیگران جای شما بودند"
                            onClick={() => setActiveDetailType('DEMAND')}
                        />
                        <StatCard 
                            title="دعوت به کار" 
                            value={stats.totalInvitations} 
                            icon="fa-briefcase" 
                            color="border-blue-500" 
                            onClick={() => setActiveDetailType('INVITATIONS')}
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 h-80">
                        <GroupedBarChart 
                            title="روند تعویض شیفت (تامین و درخواست)" 
                            data1={stats.monthlyData.exchangesProv}
                            data2={stats.monthlyData.exchangesReq}
                            label1="تامین (Supply)"
                            label2="درخواست (Demand)"
                            color1="bg-green-500" 
                            color2="bg-red-500"
                            labels={JALALI_MONTH_NAMES} 
                        />
                        <SimpleBarChart 
                            title="روند استفاده از مرخصی (روزانه + استعلاجی)" 
                            data={stats.monthlyData.leaves} 
                            labels={JALALI_MONTH_NAMES} 
                            colorClass="bg-yellow-500" 
                        />
                    </div>

                    {/* Interaction Table */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="font-bold text-gray-800">تراز تعاملات شیفت با همکاران</h3>
                            <p className="text-xs text-gray-500 mt-1">این جدول نشان می‌دهد شما با هر همکار چقدر تعویض شیفت داشته‌اید.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام همکار</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase text-green-700">من جای او بودم (Supply)</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase text-red-700">او جای من بود (Demand)</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">تراز نهایی</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {stats.interactionTable.map((row, idx) => {
                                        const balance = row.iCovered - row.theyCovered;
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{row.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-green-600 font-bold bg-green-50">{row.iCovered}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-red-600 font-bold bg-red-50">{row.theyCovered}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${balance > 0 ? 'bg-green-100 text-green-800' : balance < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                                                        {balance > 0 ? `+${balance} (طلبکار)` : balance < 0 ? `${balance} (بدهکار)` : 'بی‌حساب'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {stats.interactionTable.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">در این سال هیچ تعامل ثبت شده‌ای با سایر همکاران نداشته‌اید.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-10 text-gray-500">کاربری انتخاب نشده است.</div>
            )}

            {/* Detail Modal */}
            <Modal isOpen={!!activeDetailType} onClose={() => setActiveDetailType(null)} title={getModalTitle()} className="sm:max-w-2xl">
                <div className="p-2 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {detailList.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">موردی یافت نشد.</p>
                    ) : (
                        detailList.map((req) => (
                            <div key={req.id} className="bg-white p-4 border rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-bold
                                            ${req.request_type === ShiftRequestType.EXCHANGE ? 'bg-indigo-100 text-indigo-700' : 
                                              req.request_type === ShiftRequestType.LEAVE ? 'bg-yellow-100 text-yellow-700' : 
                                              req.request_type === ShiftRequestType.SICK_LEAVE ? 'bg-red-100 text-red-700' : 
                                              'bg-blue-100 text-blue-700'}`}>
                                            {req.request_type}
                                        </span>
                                        <span className="text-xs text-gray-400">{formatGregorianToJalali(req.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-gray-800 font-medium">
                                        تاریخ‌ها: {req.dates.map(d => formatGregorianToJalali(d)).join('، ')}
                                    </p>
                                    
                                    {/* Contextual Info based on type */}
                                    <p className="text-xs text-gray-500 mt-1">
                                        {req.request_type === ShiftRequestType.EXCHANGE ? (
                                            activeDetailType === 'DEMAND' ? 
                                            `طرف مقابل (پوشش دهنده): ${req.provider?.full_name || req.provider?.username || 'ناشناس'}` :
                                            `درخواست دهنده: ${req.requester?.full_name || req.requester?.username || 'ناشناس'}`
                                        ) : (
                                            `تایید کننده: ${req.supervisor?.full_name || req.supervisor?.username || 'ناشناس'}`
                                        )}
                                    </p>
                                    {req.description && <p className="text-xs text-gray-600 mt-1 italic border-r-2 border-gray-300 pr-2 mr-1">{req.description}</p>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t flex justify-end">
                    <Button variant="secondary" onClick={() => setActiveDetailType(null)}>بستن</Button>
                </div>
            </Modal>
        </div>
    );
};
