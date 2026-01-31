
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneLineFault, CNSFaultReport, MaintenanceSchedule, FaultStatus, CNSFaultStatus, Task, TaskStatus } from '../types';
import { getAllFaults } from '../services/faultService';
import { getCNSFaultReports } from '../services/cnsService';
import { getMaintenanceSchedules, isScheduleDue, calculateNextDueDate } from '../services/cnsMaintenanceService';
import { getTasks } from '../services/taskService';
import { Spinner } from './ui/Spinner';
import { Button } from './ui/Button';
import { WrenchIcon, CnsFaultIcon, WarningIcon, CheckIcon, ListIcon } from './ui/Icons';

export const OpenProcessesPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    
    const [phoneFaults, setPhoneFaults] = useState<PhoneLineFault[]>([]);
    const [cnsFaults, setCNSFaults] = useState<CNSFaultReport[]>([]);
    const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceSchedule[]>([]);
    const [openTasks, setOpenTasks] = useState<Task[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Phone Faults
                const allPhoneFaults = await getAllFaults();
                setPhoneFaults(allPhoneFaults.filter(f => f.status === FaultStatus.REPORTED));

                // 2. CNS Faults
                const allCNSFaults = await getCNSFaultReports('ALL');
                setCNSFaults(allCNSFaults.filter(f => f.status !== CNSFaultStatus.CLOSED));

                // 3. Maintenance Alerts
                const allSchedules = await getMaintenanceSchedules();
                setMaintenanceAlerts(allSchedules.filter(s => isScheduleDue(s)));

                // 4. Open Tasks
                const tasks = await getTasks('', 'PENDING');
                setOpenTasks(tasks);

            } catch (err) {
                console.error("Error loading open processes", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    if (isLoading) return <div className="flex justify-center p-10"><Spinner className="w-12 h-12" /></div>;

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4 flex items-center">
                <ListIcon className="ml-3 text-indigo-600" />
                کارتابل جامع (خرابی‌ها، هشدارها و تسک‌ها)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                
                {/* Phone Faults Column */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 h-fit">
                    <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                        <h3 className="font-bold text-red-800 flex items-center text-sm">
                            <i className="fas fa-phone-slash ml-2"></i> خرابی تلفن
                        </h3>
                        <span className="bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-bold">{phoneFaults.length}</span>
                    </div>
                    <div className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {phoneFaults.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">هیچ خرابی تلفنی باز نیست.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {phoneFaults.map(fault => (
                                    <li key={fault.id} className="p-3 hover:bg-gray-50 cursor-pointer border-l-4 border-transparent hover:border-red-500 transition-all" onClick={() => navigate('/phone-lines/faults')}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-mono font-bold text-indigo-700 text-sm">{fault.phone_line?.phone_number}</span>
                                            <span className="text-[10px] text-gray-500">{new Date(fault.reported_at).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                        <p className="text-xs font-bold text-gray-800 whitespace-normal leading-snug line-clamp-2">{fault.fault_type}</p>
                                        <p className="text-[10px] text-gray-600 mt-1 truncate">{fault.description || 'بدون توضیحات'}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* CNS Faults Column */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 h-fit">
                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
                        <h3 className="font-bold text-orange-800 flex items-center text-sm">
                            <CnsFaultIcon className="ml-2" /> خرابی CNS
                        </h3>
                        <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">{cnsFaults.length}</span>
                    </div>
                    <div className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                         {cnsFaults.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">هیچ خرابی CNS باز نیست.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {cnsFaults.map(fault => (
                                    <li key={fault.id} className="p-3 hover:bg-gray-50 cursor-pointer border-l-4 border-transparent hover:border-orange-500 transition-all" onClick={() => navigate(`/cns/faults/${fault.id}`)}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-gray-800 text-xs ml-1 leading-tight whitespace-normal line-clamp-2" title={fault.equipment?.name_cns}>{fault.equipment?.name_cns}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${fault.priority_level === 'حیاتی' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{fault.priority_level}</span>
                                        </div>
                                        <p className="text-xs text-indigo-600 mb-1 whitespace-normal leading-snug line-clamp-2" title={fault.fault_type}>{fault.fault_type}</p>
                                        <div className="flex justify-between items-center text-[10px] text-gray-500">
                                            <span>{fault.status}</span>
                                            <span>{new Date(fault.start_time).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Maintenance Alerts Column */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 h-fit">
                    <div className="bg-yellow-50 p-4 border-b border-yellow-100 flex justify-between items-center">
                        <h3 className="font-bold text-yellow-800 flex items-center text-sm">
                            <i className="fas fa-calendar-check ml-2"></i> سرویس و نگهداری
                        </h3>
                        <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">{maintenanceAlerts.length}</span>
                    </div>
                    <div className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                         {maintenanceAlerts.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">هیچ هشدار سرویسی وجود ندارد.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {maintenanceAlerts.map(schedule => {
                                    const nextDue = calculateNextDueDate(schedule);
                                    const today = new Date();
                                    today.setHours(0,0,0,0);
                                    const dueDate = new Date(nextDue);
                                    dueDate.setHours(0,0,0,0);
                                    const diffTime = dueDate.getTime() - today.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    const isOverdue = diffDays < 0;

                                    return (
                                        <li key={schedule.id} className="p-3 hover:bg-gray-50 cursor-pointer border-l-4 border-transparent hover:border-yellow-500 transition-all" onClick={() => navigate(`/maintenance/details/${schedule.id}`)}>
                                            <h4 className="font-bold text-gray-800 mb-1 text-xs whitespace-normal leading-tight line-clamp-2" title={schedule.title}>{schedule.title}</h4>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-[10px] text-gray-500">{schedule.recurrence_type}</span>
                                                {isOverdue ? (
                                                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">{Math.abs(diffDays)} روز گذشته</span>
                                                ) : (
                                                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{diffDays} روز مانده</span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Open Tasks Column */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 h-fit">
                    <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
                        <h3 className="font-bold text-indigo-800 flex items-center text-sm">
                            <i className="fas fa-tasks ml-2"></i> تسک‌های باز
                        </h3>
                        <span className="bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">{openTasks.length}</span>
                    </div>
                    <div className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                         {openTasks.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">هیچ تسک بازی وجود ندارد.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {openTasks.map(task => (
                                    <li key={task.id} className="p-3 hover:bg-gray-50 cursor-pointer border-l-4 border-transparent hover:border-indigo-500 transition-all" onClick={() => navigate(`/tasks/${task.id}`)}>
                                        <h4 className="font-bold text-gray-800 mb-1 text-xs whitespace-normal leading-relaxed line-clamp-2" title={task.title}>{task.title}</h4>
                                        <p className="text-[10px] text-gray-600 line-clamp-1 mb-2">{task.description || 'بدون توضیحات'}</p>
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${task.priority === 'بالا' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                اولویت: {task.priority}
                                            </span>
                                            <span className="text-[10px] text-gray-400">{new Date(task.created_at).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                        {task.assigned_to && (
                                            <div className="mt-1 pt-1 border-t border-gray-50 text-[10px] text-indigo-600 truncate">
                                                مسئول: {task.assigned_to}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
