
import React, { useState, useEffect } from 'react';
import { getRoles, createRole, updateRole, deleteRole } from '../../services/authService';
import { Role } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const AVAILABLE_PERMISSIONS = [
    { key: 'manage_users', label: 'مدیریت کاربران' },
    { key: 'manage_roles', label: 'مدیریت نقش‌ها' },
    { key: 'manage_assets', label: 'مدیریت اموال' },
    { key: 'manage_phones', label: 'مدیریت خطوط تلفن' },
    { key: 'manage_cns', label: 'مدیریت CNS' },
    { key: 'manage_tasks', label: 'مدیریت تسک‌ها' },
    { key: 'view_reports', label: 'مشاهده گزارشات' },
    { key: 'manage_settings', label: 'تنظیمات سیستم' },
];

export const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRole, setCurrentRole] = useState<Partial<Role>>({});
    const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getRoles();
            setRoles(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleOpenCreate = () => {
        setCurrentRole({});
        setSelectedPerms([]);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (role: Role) => {
        setCurrentRole(role);
        setSelectedPerms(role.permissions || []);
        setIsModalOpen(true);
    };

    const handlePermChange = (permKey: string) => {
        if (selectedPerms.includes(permKey)) {
            setSelectedPerms(selectedPerms.filter(p => p !== permKey));
        } else {
            setSelectedPerms([...selectedPerms, permKey]);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentRole.name) return alert('نام نقش الزامی است');

        try {
            if (currentRole.id) {
                await updateRole(currentRole.id, currentRole.name, selectedPerms);
            } else {
                await createRole(currentRole.name, selectedPerms);
            }
            setIsModalOpen(false);
            loadData();
        } catch (e: any) { alert(e.message); }
    };

    const handleDelete = async () => {
        if (roleToDelete) {
            try {
                await deleteRole(roleToDelete.id);
                setIsDeleteOpen(false);
                loadData();
            } catch (e: any) { alert(e.message); }
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت نقش‌ها و دسترسی‌ها</h2>
                <Button variant="primary" onClick={handleOpenCreate}>
                    <AddIcon className="ml-2" /> نقش جدید
                </Button>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {roles.map(role => (
                    <div key={role.id} className="border rounded-lg p-4 bg-gray-50 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                            <h3 className="text-lg font-bold text-gray-800">{role.name}</h3>
                            <div className="flex space-x-1 space-x-reverse">
                                <button onClick={() => handleOpenEdit(role)} className="text-blue-600 hover:text-blue-800 p-1"><EditIcon /></button>
                                <button onClick={() => { setRoleToDelete(role); setIsDeleteOpen(true); }} className="text-red-600 hover:text-red-800 p-1"><DeleteIcon /></button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {role.permissions?.map(perm => {
                                const label = AVAILABLE_PERMISSIONS.find(p => p.key === perm)?.label || perm;
                                return <span key={perm} className="px-2 py-0.5 bg-white border rounded text-xs text-gray-600">{label}</span>;
                            })}
                            {(!role.permissions || role.permissions.length === 0) && <span className="text-xs text-gray-400">بدون دسترسی</span>}
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentRole.id ? 'ویرایش نقش' : 'نقش جدید'}>
                <form onSubmit={handleSave} className="p-4 space-y-4">
                    <Input label="نام نقش" value={currentRole.name || ''} onChange={e => setCurrentRole({...currentRole, name: e.target.value})} required />
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">دسترسی‌ها</label>
                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded border max-h-60 overflow-y-auto">
                            {AVAILABLE_PERMISSIONS.map(perm => (
                                <label key={perm.key} className="flex items-center space-x-2 space-x-reverse cursor-pointer hover:bg-gray-100 p-1 rounded">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                        checked={selectedPerms.includes(perm.key)}
                                        onChange={() => handlePermChange(perm.key)}
                                    />
                                    <span className="text-sm text-gray-700">{perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="ml-2">لغو</Button>
                        <Button type="submit" variant="primary">ذخیره</Button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog 
                isOpen={isDeleteOpen} 
                onClose={() => setIsDeleteOpen(false)} 
                onConfirm={handleDelete} 
                title="حذف نقش"
                message={`آیا از حذف نقش ${roleToDelete?.name} اطمینان دارید؟ این عمل ممکن است دسترسی برخی کاربران را مختل کند.`}
                confirmText="حذف"
            />
        </div>
    );
};
