
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { updateUser, resetUserPassword } from '../../services/authService';
import { getTelegramConfig } from '../../services/telegramService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';

export const UserProfile: React.FC = () => {
    const { user, refreshUser } = useAuth();
    
    // Info State
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [isSavingInfo, setIsSavingInfo] = useState(false);
    const [infoError, setInfoError] = useState<string | null>(null);
    const [infoSuccess, setInfoSuccess] = useState<string | null>(null);

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPass, setIsSavingPass] = useState(false);
    const [passError, setPassError] = useState<string | null>(null);
    const [passSuccess, setPassSuccess] = useState<string | null>(null);

    // Telegram Bot Info
    const [botUsername, setBotUsername] = useState('');

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '');
            setPhoneNumber(user.phone_number || '');
            setTelegramChatId(user.telegram_chat_id || '');
        }
        
        // Fetch bot info to display link
        const fetchBotInfo = async () => {
            try {
                const config = await getTelegramConfig();
                setBotUsername(config.botUsername);
            } catch (e) { console.error(e); }
        };
        fetchBotInfo();
    }, [user]);

    const handleUpdateInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        setIsSavingInfo(true);
        setInfoError(null);
        setInfoSuccess(null);

        try {
            await updateUser(user.id, { 
                full_name: fullName, 
                phone_number: phoneNumber,
                telegram_chat_id: telegramChatId.trim() || null
            });
            await refreshUser();
            setInfoSuccess('اطلاعات کاربری با موفقیت به‌روزرسانی شد.');
        } catch (err: any) {
            setInfoError(err.message || 'خطا در ویرایش اطلاعات');
        } finally {
            setIsSavingInfo(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (newPassword.length < 6) {
            setPassError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPassError('تکرار رمز عبور مطابقت ندارد.');
            return;
        }

        setIsSavingPass(true);
        setPassError(null);
        setPassSuccess(null);

        try {
            await resetUserPassword(user.id, newPassword);
            setPassSuccess('رمز عبور با موفقیت تغییر یافت.');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setPassError(err.message || 'خطا در تغییر رمز عبور');
        } finally {
            setIsSavingPass(false);
        }
    };

    if (!user) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">پروفایل کاربری</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Personal Information */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <i className="fas fa-user-edit ml-2 text-indigo-500"></i> ویرایش مشخصات
                    </h3>
                    
                    {infoSuccess && <div className="bg-green-100 text-green-800 p-3 rounded mb-4 text-sm">{infoSuccess}</div>}
                    {infoError && <div className="bg-red-100 text-red-800 p-3 rounded mb-4 text-sm">{infoError}</div>}

                    <form onSubmit={handleUpdateInfo} className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded border">
                            <label className="block text-sm font-bold text-gray-500 mb-1">نام کاربری (غیرقابل تغییر)</label>
                            <div className="text-gray-800 dir-ltr text-left font-mono">{user.username}</div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded border">
                            <label className="block text-sm font-bold text-gray-500 mb-1">نقش کاربری</label>
                            <div className="text-gray-800">{user.role?.name}</div>
                        </div>

                        <Input 
                            label="نام و نام خانوادگی" 
                            value={fullName} 
                            onChange={e => setFullName(e.target.value)} 
                        />
                        
                        <Input 
                            label="شماره تماس" 
                            value={phoneNumber} 
                            onChange={e => setPhoneNumber(e.target.value)} 
                            dir="ltr"
                        />
                        
                        {/* Telegram Section */}
                        <div className="border-t pt-4 mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">شناسه چت تلگرام (Telegram Chat ID)</label>
                            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-2">
                                <p className="mb-1">برای دریافت پیام‌های سیستم در تلگرام:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    {botUsername && (
                                        <li>ابتدا ربات <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="font-bold underline" dir="ltr">@{botUsername}</a> را استارت کنید.</li>
                                    )}
                                    <li>سپس ربات <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="font-bold underline" dir="ltr">@userinfobot</a> را استارت کنید تا شناسه عددی شما (Id) را نمایش دهد.</li>
                                    <li>آن عدد را در کادر زیر وارد کنید.</li>
                                </ol>
                            </div>
                            <Input 
                                value={telegramChatId}
                                onChange={e => setTelegramChatId(e.target.value)}
                                dir="ltr"
                                placeholder="مثال: 123456789"
                            />
                        </div>

                        <div className="pt-4 text-left">
                            <Button type="submit" variant="primary" loading={isSavingInfo} disabled={isSavingInfo}>
                                ذخیره تغییرات
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Change Password */}
                <div className="bg-white p-6 rounded-lg shadow-lg h-fit">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <i className="fas fa-key ml-2 text-yellow-500"></i> تغییر رمز عبور
                    </h3>

                    {passSuccess && <div className="bg-green-100 text-green-800 p-3 rounded mb-4 text-sm">{passSuccess}</div>}
                    {passError && <div className="bg-red-100 text-red-800 p-3 rounded mb-4 text-sm">{passError}</div>}

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <Input 
                            label="رمز عبور جدید" 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            required
                            placeholder="حداقل ۶ کاراکتر"
                        />
                        
                        <Input 
                            label="تکرار رمز عبور جدید" 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            required
                        />

                        <div className="pt-4 text-left">
                            <Button type="submit" variant="warning" loading={isSavingPass} disabled={isSavingPass}>
                                تغییر رمز
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
