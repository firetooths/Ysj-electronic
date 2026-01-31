
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTaskById, getTaskLogs, updateTaskStatus, addTaskLog } from '../../services/taskService';
import { Task, TaskStatus, TaskLog } from '../../types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { CheckIcon, WarningIcon, EditIcon } from '../ui/Icons';
import { TextArea, Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../AuthContext';
import { handleAdminActionNotification } from '../../services/notificationService';

export const TaskDetails: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [task, setTask] = useState<Task | null>(null);
    const [logs, setLogs] = useState<TaskLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // New Log
    const [newLogDesc, setNewLogDesc] = useState('');
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);

    // Confirmation State
    const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const currentUserName = user?.full_name || user?.username || 'کاربر ناشناس';

    const loadData = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const t = await getTaskById(id);
            const l = await getTaskLogs(id);
            setTask(t);
            setLogs(l);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleStatusChangeClick = (newStatus: TaskStatus) => {
        setPendingStatus(newStatus);
        setIsStatusConfirmOpen(true);
    };

    const confirmStatusChange = async () => {
        if (!task || !pendingStatus) return;
        setIsUpdatingStatus(true);
        try {
            await updateTaskStatus(task.id, pendingStatus, currentUserName);
            
            // Notify Admins
            const appUrl = window.location.origin + window.location.pathname;
            const link = `${appUrl}#/tasks/${task.id}`;
            await handleAdminActionNotification(
                'task',
                `تغییر وضعیت به ${pendingStatus} توسط ${currentUserName}`,
                currentUserName,
                {
                    title: task.title,
                    link: link
                }
            );

            loadData();
            setIsStatusConfirmOpen(false);
            setPendingStatus(null);
        } catch (e) {
            alert('خطا در تغییر وضعیت');
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleAddLog = async () => {
        if (!newLogDesc.trim() || !task) return;
        setIsSubmittingLog(true);
        try {
            await addTaskLog(task.id, newLogDesc, currentUserName);
            
            // Notify Admins
            const appUrl = window.location.origin + window.location.pathname;
            const link = `${appUrl}#/tasks/${task.id}`;
            await handleAdminActionNotification(
                'task',
                newLogDesc,
                currentUserName,
                {
                    title: task.title,
                    link: link
                }
            );

            setNewLogDesc('');
            loadData();
        } catch (e) {
            alert('خطا در ثبت پیگیری');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (!task) return <div className="text-center p-10">تسک یافت نشد.</div>;

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h2>
                    <span className={`px-3 py-1 rounded text-sm ${task.status === TaskStatus.DONE ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                        {task.status}
                    </span>
                    <span className="mr-2 text-gray-500 text-sm">اولویت: {task.priority}</span>
                </div>
                <div className="flex space-x-2 space-x-reverse">
                    {task.status === TaskStatus.PENDING ? (
                        <Button variant="success" onClick={() => handleStatusChangeClick(TaskStatus.DONE)}>
                            <CheckIcon className="ml-2" /> انجام شد
                        </Button>
                    ) : (
                        <Button variant="warning" onClick={() => handleStatusChangeClick(TaskStatus.PENDING)}>
                            <WarningIcon className="ml-2" /> بازگشت به در حال انجام
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => navigate(`/tasks/edit/${task.id}`)}>
                        <EditIcon className="ml-2" /> ویرایش
                    </Button>
                    <Button variant="ghost" onClick={() => navigate('/tasks/list')}>بازگشت</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-gray-50 p-4 rounded border">
                        <h4 className="font-bold mb-2 text-gray-700">توضیحات</h4>
                        <p className="whitespace-pre-wrap text-gray-800">{task.description || '---'}</p>
                    </div>
                    
                    {(task.image_urls?.length > 0 || task.audio_url) && (
                        <div className="bg-gray-50 p-4 rounded border">
                            <h4 className="font-bold mb-3 text-gray-700">پیوست‌ها</h4>
                            {task.audio_url && (
                                <div className="mb-4">
                                    <audio controls src={task.audio_url} className="w-full h-8" />
                                </div>
                            )}
                            {task.image_urls?.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {task.image_urls.map((url, idx) => (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} className="h-24 rounded border object-cover" alt="attach" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Logs Section */}
                    <div>
                        <h4 className="font-bold mb-4 text-gray-800 border-b pb-2">روند پیگیری</h4>
                        <div className="space-y-4 mb-6">
                            {logs.map(log => (
                                <div key={log.id} className="bg-white border p-3 rounded shadow-sm">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{log.action_user}</span>
                                        <span>{new Date(log.created_at).toLocaleString('fa-IR')}</span>
                                    </div>
                                    <p className="text-gray-800">{log.action_description}</p>
                                </div>
                            ))}
                            {logs.length === 0 && <p className="text-gray-500">هنوز پیگیری ثبت نشده است.</p>}
                        </div>

                        {/* Add Log Form */}
                        <div className="bg-gray-100 p-4 rounded">
                            <h5 className="font-bold mb-2 text-sm">ثبت پیگیری جدید</h5>
                            <div className="space-y-2">
                                <div className="text-xs text-gray-500 mb-1">ثبت کننده: <span className="font-bold">{currentUserName}</span></div>
                                <TextArea placeholder="توضیحات اقدامات انجام شده..." value={newLogDesc} onChange={e => setNewLogDesc(e.target.value)} rows={2} className="bg-white" />
                                <Button size="sm" variant="primary" onClick={handleAddLog} disabled={isSubmittingLog}>ثبت</Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-1 bg-gray-50 p-4 rounded border h-fit">
                    <h4 className="font-bold mb-3 text-gray-700">اطلاعات تکمیلی</h4>
                    <ul className="text-sm space-y-3">
                        <li>
                            <strong>مسئول انجام:</strong>
                            <div className="mt-1">
                                {task.assigned_to ? (
                                    <div className="flex flex-wrap gap-1">
                                        {task.assigned_to.split('، ').map((u, i) => (
                                            <span key={i} className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs border border-indigo-200">{u}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-gray-500 italic">همه کاربران (عمومی)</span>
                                )}
                            </div>
                        </li>
                        <li><strong>تاریخ ایجاد:</strong> {new Date(task.created_at).toLocaleDateString('fa-IR')}</li>
                        {task.completed_at && (
                            <li><strong>تاریخ اتمام:</strong> {new Date(task.completed_at).toLocaleDateString('fa-IR')}</li>
                        )}
                    </ul>
                </div>
            </div>

            <ConfirmDialog
                isOpen={isStatusConfirmOpen}
                onClose={() => setIsStatusConfirmOpen(false)}
                onConfirm={confirmStatusChange}
                title="تغییر وضعیت تسک"
                message={`آیا از تغییر وضعیت تسک به "${pendingStatus === TaskStatus.DONE ? 'انجام شده' : 'در حال انجام'}" اطمینان دارید؟`}
                confirmText="بله، تغییر بده"
                confirmButtonVariant={pendingStatus === TaskStatus.DONE ? 'success' : 'warning'}
                isConfirming={isUpdatingStatus}
            />
        </div>
    );
};
