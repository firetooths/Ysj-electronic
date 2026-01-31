
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, createUser, updateUser, deleteUser, getRoles, resetUserPassword } from '../../services/authService';
import { User, Role } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, LogIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const UserManagement: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<Partial<User>>({});
    const [password, setPassword] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    
    // Password Reset State
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [userToReset, setUserToReset] = useState<User | null>(null);

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, rolesData] = await Promise.all([getUsers(), getRoles()]);
            setUsers(usersData);
            setRoles(rolesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenCreate = () => {
        setCurrentUser({ is_active: true });
        setPassword('');
        setIsEditMode(false);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setCurrentUser(user);
        setPassword(''); // Password not needed for simple update
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser.username || !currentUser.role_id) {
            alert('نام کاربری و نقش الزامی هستند.');
            return;
        }

        try {
            if (isEditMode && currentUser.id) {
                await updateUser(currentUser.id, currentUser);
            } else {
                if (!password) {
                    alert('برای کاربر جدید رمز عبور الزامی است.');
                    return;
                }
                await createUser(currentUser, password);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            alert(`خطا: ${err.message}`);
        }
    };

    const handleDelete = async () => {
        if (userToDelete) {
            await deleteUser(userToDelete.id);
            setIsDeleteOpen(false);
            loadData();
        }
    };

    const handleResetPassword = async () => {
        if (userToReset && newPassword) {
            try {
                await resetUserPassword(userToReset.id, newPassword);
                alert('رمز عبور با موفقیت تغییر یافت.');
                setIsResetModalOpen(false);
                setNewPassword('');
                setUserToReset(null);
            } catch (err: any) {
                alert(`خطا: ${err.message}`);
            }
        }
    };

    const getLastOnlineText = (dateStr: string | null) => {
        if (!dateStr) return '---';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'آنلاین';
        if (diffMins < 60) return `${diffMins} دقیقه پیش`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ساعت پیش`;
        return date.toLocaleDateString('fa-IR');
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت کاربران</h2>
                <Button variant="primary" onClick={handleOpenCreate}>
                    <AddIcon className="ml-2" /> کاربر جدید
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام کاربری</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام کامل</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">نقش</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">وضعیت</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">آخرین فعالیت</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-700">{user.username}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{user.full_name || '---'}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-xs">
                                        {user.role?.name || 'بدون نقش'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                    {user.is_active ? 
                                        <span className="text-green-600 text-xs font-bold">فعال</span> : 
                                        <span className="text-red-600 text-xs font-bold">غیرفعال</span>
                                    }
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500" dir="ltr">
                                    {getLastOnlineText(user.last_online)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <div className="flex justify-center space-x-2 space-x-reverse">
                                        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/users/${user.id}/activity`)} title="مشاهده فعالیت‌ها">
                                            <LogIcon className="text-blue-600" />
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(user)}><EditIcon /></Button>
                                        <Button size="sm" variant="warning" onClick={() => { setUserToReset(user); setIsResetModalOpen(true); }} title="تغییر رمز">
                                            <i className="fas fa-key"></i>
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => { setUserToDelete(user); setIsDeleteOpen(true); }}><DeleteIcon /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditMode ? 'ویرایش کاربر' : 'کاربر جدید'}>
                <form onSubmit={handleSave} className="space-y-4 p-4">
                    <Input label="نام کاربری *" value={currentUser.username || ''} onChange={e => setCurrentUser({...currentUser, username: e.target.value})} disabled={isEditMode} required />
                    <Input label="نام کامل" value={currentUser.full_name || ''} onChange={e => setCurrentUser({...currentUser, full_name: e.target.value})} />
                    <Input label="شماره تماس" value={currentUser.phone_number || ''} onChange={e => setCurrentUser({...currentUser, phone_number: e.target.value})} />
                    
                    <Select 
                        label="نقش کاربری *"
                        value={currentUser.role_id || ''}
                        onChange={e => setCurrentUser({...currentUser, role_id: e.target.value})}
                        options={roles.map(r => ({ value: r.id, label: r.name }))}
                    />

                    {!isEditMode && (
                        <Input label="رمز عبور *" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    )}

                    <div className="flex items-center mt-4">
                        <input 
                            type="checkbox" 
                            checked={currentUser.is_active || false} 
                            onChange={e => setCurrentUser({...currentUser, is_active: e.target.checked})} 
                            className="h-4 w-4 text-indigo-600 rounded ml-2"
                        />
                        <label className="text-sm text-gray-700">حساب کاربری فعال باشد</label>
                    </div>

                    <div className="flex justify-end pt-4 border-t mt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="ml-2">لغو</Button>
                        <Button type="submit" variant="primary">ذخیره</Button>
                    </div>
                </form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title={`تغییر رمز عبور: ${userToReset?.username}`}>
                <div className="p-4 space-y-4">
                    <Input label="رمز عبور جدید" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                    <div className="flex justify-end pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsResetModalOpen(false)} className="ml-2">لغو</Button>
                        <Button variant="warning" onClick={handleResetPassword} disabled={!newPassword}>تغییر رمز</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog 
                isOpen={isDeleteOpen} 
                onClose={() => setIsDeleteOpen(false)} 
                onConfirm={handleDelete} 
                title="حذف کاربر"
                message={`آیا از حذف کاربر ${userToDelete?.username} اطمینان دارید؟`}
                confirmText="حذف"
            />
        </div>
    );
};
