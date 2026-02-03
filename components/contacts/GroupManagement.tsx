
import React, { useState, useEffect } from 'react';
import { useSupabaseContext } from '../../SupabaseContext';
import { ContactGroup } from '../../types';
import { createContactGroup, updateContactGroup, deleteContactGroup } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, InfoIcon } from '../ui/Icons';
import { Tag } from '../ui/Tag';

export const GroupManagement: React.FC = () => {
    const { contactGroups, refreshContactGroups, isLoading: isContextLoading } = useSupabaseContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentGroup, setCurrentGroup] = useState<ContactGroup | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupColor, setGroupColor] = useState('#6c757d');
    const [isSaving, setIsSaving] = useState(false);
    
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ContactGroup | null>(null);

    const handleOpenCreate = () => {
        setCurrentGroup(null);
        setGroupName('');
        setGroupColor('#6c757d');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (group: ContactGroup) => {
        setCurrentGroup(group);
        setGroupName(group.name);
        setGroupColor(group.color);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim()) return;
        setIsSaving(true);
        try {
            if (currentGroup) {
                await updateContactGroup(currentGroup.id, { name: groupName, color: groupColor });
            } else {
                await createContactGroup({ name: groupName, color: groupColor });
            }
            await refreshContactGroups();
            setIsModalOpen(false);
        } catch (err) {
            alert('خطا در ذخیره گروه');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!groupToDelete) return;
        try {
            await deleteContactGroup(groupToDelete.id);
            await refreshContactGroups();
            setDeleteConfirmOpen(false);
        } catch (err) {
            alert('خطا در حذف گروه');
        }
    };

    if (isContextLoading) return <Spinner />;

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
             <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت گروه‌های مخاطبین</h2>
                <Button variant="primary" onClick={handleOpenCreate}><AddIcon className="ml-2" /> افزودن گروه</Button>
            </div>

            <div className="space-y-3">
                {contactGroups.length === 0 ? (
                     <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <InfoIcon className="fa-lg ml-3 text-blue-500" />
                        <span>هیچ گروهی تعریف نشده است.</span>
                    </div>
                ) : (
                    contactGroups.map(group => (
                         <div key={group.id} className="bg-gray-50 p-3 rounded-lg shadow-sm border flex items-center justify-between hover:shadow-md transition-shadow">
                             <div className="flex items-center">
                                 <Tag name={group.name} color={group.color} />
                             </div>
                             <div className="flex space-x-2 space-x-reverse">
                                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(group)}><EditIcon /></Button>
                                <Button variant="danger" size="sm" onClick={() => { setGroupToDelete(group); setDeleteConfirmOpen(true); }}><DeleteIcon /></Button>
                             </div>
                         </div>
                    ))
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentGroup ? 'ویرایش گروه' : 'افزودن گروه'}>
                 <form onSubmit={handleSave} className="p-4 space-y-4">
                    <Input label="نام گروه" value={groupName} onChange={e => setGroupName(e.target.value)} required />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رنگ</label>
                        <input type="color" value={groupColor} onChange={e => setGroupColor(e.target.value)} className="h-10 w-20 rounded cursor-pointer" />
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
                title="حذف گروه"
                message={`آیا از حذف گروه "${groupToDelete?.name}" مطمئن هستید؟ مخاطبین این گروه حذف نمی‌شوند، فقط از این گروه خارج می‌شوند.`}
                confirmText="حذف"
            />
        </div>
    );
};