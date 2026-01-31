
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTasks, updateTaskStatus, deleteTask } from '../../services/taskService';
import { Task, TaskStatus } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AddIcon, CheckIcon, DetailsIcon, DeleteIcon } from '../ui/Icons';
import { Select } from '../ui/Select';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../AuthContext';

export const TaskList: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');
    const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
    
    // Sorting State
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Confirmation State
    const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
    const [taskToMarkDone, setTaskToMarkDone] = useState<Task | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete State
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const isAdmin = user?.role?.name === 'Admin';

    useEffect(() => {
        const paramStatus = searchParams.get('status');
        const paramAssigned = searchParams.get('assigned');

        if (paramStatus === 'pending') setStatusFilter('PENDING');
        else if (paramStatus === 'done') setStatusFilter('DONE');
        
        if (paramAssigned === 'me') {
            setShowOnlyMyTasks(true);
            if (!paramStatus) setStatusFilter('PENDING');
        }
    }, [searchParams]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
             loadData();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, statusFilter, showOnlyMyTasks, sortBy, sortOrder]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const assignedToUser = showOnlyMyTasks && user ? (user.full_name || user.username) : null;
            const data = await getTasks(searchTerm, statusFilter, assignedToUser, sortBy, sortOrder);
            setTasks(data);
            setCurrentPage(1); // Reset to first page on filter change
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkDoneClick = (e: React.MouseEvent, task: Task) => {
        e.stopPropagation();
        setTaskToMarkDone(task);
        setConfirmDoneOpen(true);
    };

    const confirmMarkDone = async () => {
        if (!taskToMarkDone) return;
        setIsUpdating(true);
        try {
            const actionUser = user?.full_name || user?.username || 'کاربر ناشناس';
            await updateTaskStatus(taskToMarkDone.id, TaskStatus.DONE, actionUser);
            loadData();
            setConfirmDoneOpen(false);
            setTaskToMarkDone(null);
        } catch (err) {
            alert('خطا در بروزرسانی وضعیت');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, task: Task) => {
        e.stopPropagation();
        setTaskToDelete(task);
        setConfirmDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!taskToDelete) return;
        setIsDeleting(true);
        try {
            await deleteTask(taskToDelete.id);
            loadData();
            setConfirmDeleteOpen(false);
            setTaskToDelete(null);
        } catch (err: any) {
            alert(`خطا در حذف تسک: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const getPriorityColor = (p: string) => {
        switch(p) {
            case 'بالا': return 'text-red-600 bg-red-100';
            case 'متوسط': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };
    
    const toggleMyTasks = () => {
        setShowOnlyMyTasks(!showOnlyMyTasks);
        const newParams = new URLSearchParams(searchParams);
        if (!showOnlyMyTasks) newParams.set('assigned', 'me');
        else newParams.delete('assigned');
        setSearchParams(newParams);
    };

    // Client-side pagination logic
    const totalItems = tasks.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTasks = tasks.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">لیست تسک‌ها</h2>
                <Button variant="primary" onClick={() => navigate('/tasks/new')}>
                    <AddIcon className="ml-2" /> تسک جدید
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 items-center">
                <div className="md:col-span-3">
                    <Input 
                        placeholder="جستجو در عنوان و توضیحات..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        fullWidth
                    />
                </div>
                <div className="md:col-span-2">
                     <Select 
                        options={[
                            {value: 'ALL', label: 'همه وضعیت‌ها'},
                            {value: 'PENDING', label: 'در حال انجام'},
                            {value: 'DONE', label: 'انجام شده'},
                        ]}
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        fullWidth
                    />
                </div>
                <div className="md:col-span-2">
                     <Select 
                        options={[
                            {value: 'created_at', label: 'تاریخ ثبت'},
                            {value: 'priority', label: 'اولویت'},
                            {value: 'status', label: 'وضعیت'},
                            {value: 'title', label: 'عنوان'},
                        ]}
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        fullWidth
                    />
                </div>
                 <div className="md:col-span-2">
                    <Button 
                        variant="secondary" 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        fullWidth
                        className="justify-center h-[42px]"
                    >
                        {sortOrder === 'asc' ? <i className="fas fa-sort-amount-up ml-2"></i> : <i className="fas fa-sort-amount-down ml-2"></i>}
                        {sortOrder === 'asc' ? 'صعودی' : 'نزولی'}
                    </Button>
                </div>
                <div className="md:col-span-3 flex items-center">
                    <label className="flex items-center cursor-pointer p-2 border rounded-lg hover:bg-gray-50 bg-white shadow-sm w-full h-[42px]">
                        <input 
                            type="checkbox" 
                            checked={showOnlyMyTasks} 
                            onChange={toggleMyTasks}
                            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded ml-2"
                        />
                        <span className="text-sm font-medium text-gray-700">فقط تسک‌های من</span>
                    </label>
                </div>
            </div>

            {isLoading ? <div className="flex justify-center p-10"><Spinner /></div> : error ? <div className="text-red-500 text-center">{error}</div> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[55%]">عنوان</th>
                                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[13%]">مسئول</th>
                                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[8%]">اولویت</th>
                                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[9%]">وضعیت</th>
                                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[9%]">تاریخ</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-[6%]">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedTasks.map(task => (
                                <tr key={task.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/tasks/${task.id}`)}>
                                    <td className="px-4 py-3">
                                        <div className="text-xs font-bold text-gray-900 whitespace-normal leading-relaxed line-clamp-2" title={task.title}>
                                            {task.title}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3 text-sm text-gray-600">
                                        {task.assigned_to ? (
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {task.assigned_to.split('، ').map((u, i) => (
                                                    <span key={i} className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap truncate max-w-full ${user && (user.full_name === u || user.username === u) ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>{u}</span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 italic text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded whitespace-nowrap">همه</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-[10px] ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-[10px] ${task.status === TaskStatus.DONE ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                            {task.status}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3 whitespace-nowrap text-gray-500 text-[10px] font-mono">
                                        {new Date(task.created_at).toLocaleDateString('fa-IR')}
                                    </td>
                                    <td className="px-2 py-3 whitespace-nowrap text-center">
                                        <div className="flex justify-center space-x-1 space-x-reverse">
                                            {task.status !== TaskStatus.DONE && (
                                                <Button variant="success" size="sm" onClick={(e) => handleMarkDoneClick(e, task)} title="انجام شد" className="px-2 h-7">
                                                    <CheckIcon className="w-3 h-3" />
                                                </Button>
                                            )}
                                            {isAdmin && (
                                                <Button variant="danger" size="sm" onClick={(e) => handleDeleteClick(e, task)} title="حذف" className="px-2 h-7">
                                                    <DeleteIcon className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {tasks.length === 0 && (
                                <tr><td colSpan={6} className="text-center p-6 text-gray-500">تسک یافت نشد.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center mb-2 sm:mb-0">
                        <span className="text-sm text-gray-600 ml-2">تعداد در صفحه:</span>
                        <select 
                            className="border border-gray-300 rounded-md text-sm p-1"
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                            disabled={currentPage === 1}
                        >
                            قبلی
                        </Button>
                        <span className="text-sm text-gray-700">
                            صفحه {currentPage} از {totalPages || 1} (کل: {totalItems})
                        </span>
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                            disabled={currentPage === totalPages}
                        >
                            بعدی
                        </Button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmDoneOpen}
                onClose={() => setConfirmDoneOpen(false)}
                onConfirm={confirmMarkDone}
                title="اتمام تسک"
                message={`آیا اطمینان دارید که تسک "${taskToMarkDone?.title}" به اتمام رسیده است؟`}
                confirmText="بله، انجام شد"
                confirmButtonVariant="success"
                isConfirming={isUpdating}
            />

            <ConfirmDialog
                isOpen={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="حذف تسک"
                message={`آیا از حذف تسک "${taskToDelete?.title}" اطمینان دارید؟ این عملیات قابل بازگشت نیست.`}
                confirmText="حذف"
                isConfirming={isDeleting}
            />
        </div>
    );
};
