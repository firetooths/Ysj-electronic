
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { syncFullDatabase, getLastSyncTime, exportLocalDataToJson } from '../../services/offlineService';
import { getSavedFonts, addFont, removeFont, setAppFont, getAppFontName, setPdfFont, getPdfFont } from '../../utils/fontManager';
import { CustomFont } from '../../types';

export const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'general' | 'fonts' | 'offline'>('general');
    
    // Offline State
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Font State
    const [fonts, setFonts] = useState<CustomFont[]>([]);
    const [appFont, setAppFontState] = useState('');
    const [pdfFont, setPdfFontState] = useState('');
    const [newFontName, setNewFontName] = useState('');
    const [fontFile, setFontFile] = useState<File | null>(null);
    const [isLoadingFonts, setIsLoadingFonts] = useState(false);

    useEffect(() => {
        setLastSyncTime(getLastSyncTime());
        loadFonts();
    }, []);

    const loadFonts = async () => {
        setIsLoadingFonts(true);
        try {
            const f = await getSavedFonts();
            setFonts(f);
            const currentAppFont = await getAppFontName();
            setAppFontState(currentAppFont);
            const currentPdfFont = await getPdfFont();
            setPdfFontState(currentPdfFont?.id || '');
        } catch(e) {
            console.error(e);
        } finally {
            setIsLoadingFonts(false);
        }
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        await syncFullDatabase();
        setLastSyncTime(getLastSyncTime());
        setIsSyncing(false);
    };

    const handleAddFont = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newFontName || !fontFile) return;
        setIsLoadingFonts(true);
        try {
            await addFont(newFontName, fontFile);
            setNewFontName('');
            setFontFile(null);
            await loadFonts();
            alert('فونت اضافه شد');
        } catch(e: any) {
            alert(e.message);
        } finally {
            setIsLoadingFonts(false);
        }
    };

    const handleRemoveFont = async (id: string) => {
        if(!confirm('آیا از حذف این فونت اطمینان دارید؟')) return;
        setIsLoadingFonts(true);
        try {
            await removeFont(id);
            await loadFonts();
        } catch(e) {
            console.error(e);
        } finally {
            setIsLoadingFonts(false);
        }
    };

    const handleAppFontChange = async (val: string) => {
        await setAppFont(val);
        setAppFontState(val);
    };

    const handlePdfFontChange = async (val: string) => {
        await setPdfFont(val);
        setPdfFontState(val);
    };

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">تنظیمات سیستم</h2>
            
            <div className="flex border-b mb-6">
                <button 
                    className={`px-4 py-2 font-medium ${activeTab === 'general' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('general')}
                >
                    عمومی
                </button>
                <button 
                    className={`px-4 py-2 font-medium ${activeTab === 'fonts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('fonts')}
                >
                    فونت‌ها
                </button>
                <button 
                    className={`px-4 py-2 font-medium ${activeTab === 'offline' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('offline')}
                >
                    آفلاین و همگام‌سازی
                </button>
            </div>

            {activeTab === 'general' && (
                <div className="p-4">
                    <p className="text-gray-500">تنظیمات عمومی سیستم (در حال توسعه)</p>
                </div>
            )}

            {activeTab === 'fonts' && (
                <div className="space-y-6">
                    {isLoadingFonts && <Spinner />}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-50 p-4 rounded border">
                            <h4 className="font-bold mb-4">انتخاب فونت</h4>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">فونت برنامه (App Font)</label>
                                <select 
                                    className="w-full p-2 border rounded"
                                    value={appFont}
                                    onChange={(e) => handleAppFontChange(e.target.value)}
                                >
                                    <option value="System Default">پیش‌فرض سیستم</option>
                                    {fonts.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">فونت خروجی PDF</label>
                                <select 
                                    className="w-full p-2 border rounded"
                                    value={pdfFont}
                                    onChange={(e) => handlePdfFontChange(e.target.value)}
                                >
                                    <option value="">پیش‌فرض (Vazirmatn)</option>
                                    {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded border">
                            <h4 className="font-bold mb-4">افزودن فونت جدید (.ttf)</h4>
                            <form onSubmit={handleAddFont} className="space-y-3">
                                <input 
                                    type="text" 
                                    placeholder="نام نمایشی فونت" 
                                    className="w-full p-2 border rounded"
                                    value={newFontName}
                                    onChange={e => setNewFontName(e.target.value)}
                                />
                                <input 
                                    type="file" 
                                    accept=".ttf"
                                    className="w-full"
                                    onChange={e => setFontFile(e.target.files?.[0] || null)}
                                />
                                <Button type="submit" variant="primary" disabled={isLoadingFonts}>افزودن</Button>
                            </form>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold mb-2">فونت‌های نصب شده</h4>
                        <ul className="space-y-2">
                            {fonts.map(f => (
                                <li key={f.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                                    <span>{f.name}</span>
                                    <Button size="sm" variant="danger" onClick={() => handleRemoveFont(f.id)}>حذف</Button>
                                </li>
                            ))}
                            {fonts.length === 0 && <p className="text-gray-500">هیچ فونت سفارشی نصب نشده است.</p>}
                        </ul>
                    </div>
                </div>
            )}

            {activeTab === 'offline' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm bg-gray-50">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">مدیریت نسخه آفلاین</h3>
                        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                            این بخش به شما امکان می‌دهد تا نسخه محلی دیتابیس را مدیریت کنید. تمام اطلاعات برنامه در زمان اتصال به اینترنت دانلود شده و برای استفاده در زمان قطعی ذخیره می‌شود.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Sync Status Box */}
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-gray-700">وضعیت همگام‌سازی</h4>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${navigator.onLine ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {navigator.onLine ? 'آنلاین' : 'آفلاین'}
                                    </div>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-500">آخرین دریافت اطلاعات:</span>
                                        <span className="font-mono dir-ltr text-indigo-700">{lastSyncTime ? new Date(lastSyncTime).toLocaleString('fa-IR') : '---'}</span>
                                    </div>
                                    <div className="pt-2">
                                        <Button 
                                            variant="primary" 
                                            onClick={handleManualSync} 
                                            loading={isSyncing}
                                            disabled={isSyncing || !navigator.onLine}
                                            fullWidth
                                        >
                                            <i className="fas fa-sync ml-2"></i> همگام‌سازی دستی (دانلود کامل)
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Backup Box */}
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                                <h4 className="font-bold text-gray-700 mb-4">پشتیبان‌گیری محلی</h4>
                                <p className="text-xs text-gray-500 mb-4">
                                    می‌توانید از اطلاعات ذخیره شده در حافظه مرورگر/دستگاه یک فایل خروجی (JSON) تهیه کنید. این فایل شامل تمام داده‌های آفلاین فعلی است.
                                </p>
                                <Button 
                                    variant="secondary" 
                                    onClick={exportLocalDataToJson} 
                                    fullWidth
                                >
                                    <i className="fas fa-file-download ml-2"></i> دریافت بکاپ از اطلاعات آفلاین
                                </Button>
                            </div>
                        </div>
                        
                        <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded text-xs border border-blue-100">
                            <i className="fas fa-info-circle ml-1"></i>
                            نکته: سیستم به صورت خودکار در هنگام ورود به برنامه و سپس در پس‌زمینه تلاش می‌کند اطلاعات را به‌روز نگه دارد.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
