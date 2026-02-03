
import React, { useState } from 'react';
import { useSupabaseContext } from '../../SupabaseContext';
import { AssetStatusItem } from '../../types';
import { createAssetStatus, updateAssetStatus, deleteAssetStatus } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, InfoIcon } from '../ui/Icons';

export const StatusManagement: React.FC = () => {
    const { assetStatuses, refreshAssetStatuses, isLoading: isContextLoading } = useSupabaseContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<AssetStatusItem | null>(null);
    const [statusName, setStatusName] = useState('');
    const [statusColor, setStatusColor] = useState('bg-gray-100 text-gray-700');
    const [isSaving, setIsSaving] = useState(false);
    
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [statusToDelete, setStatusToDelete] = useState<AssetStatusItem | null>(null);

    const handleOpenCreate = () => {
        setCurrentStatus(null);
        setStatusName('');
        setStatusColor('bg-gray-100 text-gray-700');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (status: AssetStatusItem) => {
        setCurrentStatus(status);
        setStatusName(status.name);
        setStatusColor(status.color || 'bg-gray-100 text-gray-700');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!statusName.trim()) return;
        setIsSaving(true);
        try {
            if (currentStatus) {
                await updateAssetStatus(currentStatus.id, { name: statusName, color: statusColor });
                alert('وضعیت با موفقیت ویرایش شد.');
            } else {
                await createAssetStatus(statusName, statusColor);
                alert('وضعیت جدید ایجاد شد.');
            }
            await refreshAssetStatuses();
            setIsModalOpen(false);
        } catch (err: any) {
            alert(`خطا در ذخیره وضعیت: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!statusToDelete) return;
        try {
            await deleteAssetStatus(statusToDelete.id);
            await refreshAssetStatuses();
            setDeleteConfirmOpen(false);
            alert('وضعیت حذف شد.');
        } catch (err: any) {
            alert(`خطا در حذف وضعیت: ${err.message}`);
        }
    };

    if (isContextLoading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
             <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت وضعیت‌های اموال</h2>
                <Button variant="primary" onClick={handleOpenCreate}><AddIcon className="ml-2" /> افزودن وضعیت جدید</Button>
            </div>

            <div className="space-y-3">
                {assetStatuses.length === 0 ? (
                     <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <InfoIcon className="fa-lg ml-3 text-blue-500" />
                        <span>هیچ وضعیتی تعریف نشده است.</span>
                    </div>
                ) : (
                    assetStatuses.map(status => (
                         <div key={status.id} className="bg-gray-50 p-3 rounded-lg shadow-sm border flex items-center justify-between hover:shadow-md transition-shadow">
                             <div className="flex items-center">
                                 <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                     {status.name}
                                 </span>
                                 {status.is_system && (
                                     <span className="text-[10px] text-gray-400 mr-2">(سیستمی - غیرقابل حذف)</span>
                                 )}
                             </div>
                             <div className="flex space-x-2 space-x-reverse">
                                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(status)} title="ویرایش"><EditIcon /></Button>
                                {!status.is_system && (
                                    <Button variant="danger" size="sm" onClick={() => { setStatusToDelete(status); setDeleteConfirmOpen(true); }} title="حذف"><DeleteIcon /></Button>
                                )}
                             </div>
                         </div>
                    ))
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentStatus ? 'ویرایش وضعیت' : 'افزودن وضعیت'}>
                 <form onSubmit={handleSave} className="p-4 space-y-4">
                    <Input label="نام وضعیت" value={statusName} onChange={e => setStatusName(e.target.value)} required />
                    <Input 
                        label="کلاس CSS رنگ (Tailwind)" 
                        value={statusColor} 
                        onChange={e => setStatusColor(e.target.value)} 
                        placeholder="مثال: bg-green-100 text-green-700"
                    />
                    <div className="p-3 bg-gray-100 rounded text-center">
                        <p className="text-xs text-gray-500 mb-2">پیش‌نمایش:</p>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
                            {statusName || 'نام وضعیت'}
                        </span>
                    </div>
                    <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t">
                        <Button type="submit" variant="primary" loading={isSaving}>ذخیره</Button>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>لغو</Button>
                    </div>
                 </form>
            </Modal>

            <ConfirmDialog 
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                title="حذف وضعیت"
                message={`آیا از حذف وضعیت "${statusToDelete?.name}" مطمئن هستید؟ تجهیزاتی که این وضعیت را دارند، وضعیتشان به صورت متنی باقی می‌ماند اما از لیست انتخاب‌ها حذف می‌شود.`}
                confirmText="حذف"
            />
        </div>
    );
};
