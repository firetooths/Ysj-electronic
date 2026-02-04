
import React, { useState, useEffect, useRef } from 'react';
import { CustomDashboardCard, AssetStatus, NotificationDefaults } from '../../types';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Input, TextArea } from '../ui/Input';
import { AddIcon, DeleteIcon, SettingsIcon, CopyIcon, FileUploadIcon, WarningIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { getSetting, setSetting } from '../../supabaseService';
import { useSupabaseContext } from '../../SupabaseContext';
import { ASSET_STATUSES, SETTINGS_KEYS, DASHBOARD_MODULES_INFO, LATEST_SQL_UPDATE } from '../../constants';
import { useNavigate } from 'react-router-dom';
import { getNotificationDefaults, DEFAULT_NOTIFICATION_SETTINGS } from '../../services/notificationService';
import { createBackup, restoreBackup, getLastSyncDate } from '../../services/offlineSync';
import { ManualSyncModal } from './ManualSyncModal';

interface SmsConfig {
    baseUrl: string;
    apiKey: string;
    fromNumber: string;
}

interface TelegramConfig {
    botToken: string;
    botUsername: string;
    isEnabled: boolean;
}

// --- AssetSettingsPage (Keep existing) ---
export const AssetSettingsPage: React.FC = () => {
  const { categories, locations, isLoading: isContextLoading } = useSupabaseContext();
  const [customCards, setCustomCards] = useState<CustomDashboardCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardFilterType, setNewCardFilterType] = useState<'category' | 'location'>('category');
  const [newCardFilterValue, setNewCardFilterValue] = useState('');
  const [newCardStatusFilter, setNewCardStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CustomDashboardCard | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const cardsJson = await getSetting(SETTINGS_KEYS.DASHBOARD_CARDS);
        setCustomCards(cardsJson ? JSON.parse(cardsJson) : []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (!isContextLoading) {
        loadSettings();
    }
  }, [isContextLoading]);

  const handleAddCard = async () => {
     if (!newCardName.trim()) { setModalError('نام کارت الزامی است.'); return; }
    if (!newCardFilterValue) { setModalError('لطفا مقدار فیلتر (دسته/محل) را انتخاب کنید.'); return; }
    setIsSaving(true);
    try {
        const filterItemName = newCardFilterType === 'category' ? categories.find(c => c.id === newCardFilterValue)?.name : locations.find(l => l.id === newCardFilterValue)?.name;
        const newCard: CustomDashboardCard = { id: Date.now().toString(), name: newCardName, filterType: newCardFilterType, filterValue: newCardFilterValue, filterValueName: filterItemName || 'نامشخص', statusFilter: newCardStatusFilter };
        const updatedCards = [...customCards, newCard];
        await setSetting(SETTINGS_KEYS.DASHBOARD_CARDS, JSON.stringify(updatedCards));
        setCustomCards(updatedCards);
        setIsModalOpen(false);
        setNewCardName(''); setNewCardFilterType('category'); setNewCardFilterValue(''); setNewCardStatusFilter('all'); setModalError(null);
    } catch(e: any) { setModalError(e.message); } finally { setIsSaving(false); }
  };

  const handleDeleteCard = async () => {
      if (!cardToDelete) return; setIsSaving(true);
      try { const updatedCards = customCards.filter(c => c.id !== cardToDelete.id); await setSetting(SETTINGS_KEYS.DASHBOARD_CARDS, JSON.stringify(updatedCards)); setCustomCards(updatedCards); setIsDeleteConfirmOpen(false); setCardToDelete(null); } catch (e: any) { setError(e.message); } finally { setIsSaving(false); }
  };

  if (isLoading || isContextLoading) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
      <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center"><SettingsIcon className="ml-2" /> تنظیمات داشبورد اموال</h2>
              <Button variant="primary" onClick={() => setIsModalOpen(true)}><AddIcon className="ml-2" /> کارت جدید</Button>
          </div>
          {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customCards.map(card => (
                  <div key={card.id} className="border rounded-lg p-4 bg-gray-50 relative">
                      <h3 className="font-bold text-lg mb-2">{card.name}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                          <p>فیلتر: {card.filterType === 'category' ? 'دسته‌بندی' : 'محل'}</p>
                          <p>مقدار: {card.filterValueName}</p>
                          <p>وضعیت: {card.statusFilter === 'all' ? 'همه' : card.statusFilter}</p>
                      </div>
                      <button onClick={() => { setCardToDelete(card); setIsDeleteConfirmOpen(true); }} className="absolute top-4 left-4 text-red-500 hover:text-red-700"><DeleteIcon /></button>
                  </div>
              ))}
              {customCards.length === 0 && <p className="text-gray-500 col-span-3 text-center py-8">هیچ کارت سفارشی تعریف نشده است.</p>}
          </div>
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="افزودن کارت داشبورد">
              <div className="p-4 space-y-4">
                  {modalError && <div className="p-2 text-sm text-red-700 bg-red-100 rounded">{modalError}</div>}
                  <Input label="نام کارت" value={newCardName} onChange={e => setNewCardName(e.target.value)} required />
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">نوع فیلتر</label><div className="flex gap-4"><label className="flex items-center"><input type="radio" checked={newCardFilterType === 'category'} onChange={() => setNewCardFilterType('category')} className="ml-2" />دسته‌بندی</label><label className="flex items-center"><input type="radio" checked={newCardFilterType === 'location'} onChange={() => setNewCardFilterType('location')} className="ml-2" />محل قرارگیری</label></div></div>
                  <Select label={newCardFilterType === 'category' ? 'انتخاب دسته' : 'انتخاب محل'} value={newCardFilterValue} onChange={e => setNewCardFilterValue(e.target.value)} options={[{ value: '', label: 'انتخاب کنید...', disabled: true }, ...(newCardFilterType === 'category' ? categories.map(c => ({ value: c.id, label: c.name })) : locations.map(l => ({ value: l.id, label: l.name })))]} />
                  <Select label="فیلتر وضعیت" value={newCardStatusFilter} onChange={e => setNewCardStatusFilter(e.target.value as any)} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, ...ASSET_STATUSES.map(s => ({ value: s, label: s }))]} />
                  <div className="flex justify-end pt-4 border-t"><Button variant="secondary" onClick={() => setIsModalOpen(false)} className="ml-2">لغو</Button><Button variant="primary" onClick={handleAddCard} loading={isSaving} disabled={isSaving}>ذخیره</Button></div>
              </div>
          </Modal>
          <ConfirmDialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDeleteCard} title="حذف کارت" message={`آیا از حذف کارت "${cardToDelete?.name}" مطمئن هستید؟`} confirmText="حذف" isConfirming={isSaving} />
      </div>
  );
};

// --- GlobalSettings ---
export const GlobalSettings: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'sms' | 'telegram' | 'notifications' | 'dashboard' | 'sql' | 'backup'>('sms');

  const [smsConfig, setSmsConfig] = useState<SmsConfig>({ baseUrl: "https://edge.ippanel.com/v1", apiKey: "", fromNumber: "+983000505" });
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({ botToken: "", botUsername: "", isEnabled: false });
  const [notifyDefaults, setNotifyDefaults] = useState<NotificationDefaults>(DEFAULT_NOTIFICATION_SETTINGS);
  const [moduleOrder, setModuleOrder] = useState<{id: string, title: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Backup States
  const [backupPassword, setBackupPassword] = useState('123456');
  const [inputBackupPassword, setInputBackupPassword] = useState('');
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState<1 | 2>(1);
  const backupInputRef = useRef<HTMLInputElement>(null);
  
  // Manual Sync Modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const savedSmsConfig = await getSetting(SETTINGS_KEYS.SMS_CONFIG);
      if (savedSmsConfig) setSmsConfig(JSON.parse(savedSmsConfig));
      
      const savedTelegramConfig = await getSetting(SETTINGS_KEYS.TELEGRAM_CONFIG);
      if (savedTelegramConfig) setTelegramConfig(JSON.parse(savedTelegramConfig));
      
      setNotifyDefaults(await getNotificationDefaults());
      
      const savedOrder = await getSetting(SETTINGS_KEYS.DASHBOARD_ORDER);
      const allIds = [...new Set([...(savedOrder ? JSON.parse(savedOrder) : DASHBOARD_MODULES_INFO.map(m => m.id)), ...DASHBOARD_MODULES_INFO.map(m => m.id)])];
      setModuleOrder(allIds.map(id => DASHBOARD_MODULES_INFO.find(m => m.id === id)).filter(Boolean) as any);

      // Load Backup Settings
      const savedPass = await getSetting('backup_password');
      if (savedPass) setBackupPassword(savedPass);
      
      const lastSync = await getLastSyncDate();
      setLastSyncDate(lastSync);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSaveSmsConfig = async () => { await setSetting(SETTINGS_KEYS.SMS_CONFIG, JSON.stringify(smsConfig)); alert('ذخیره شد'); };
  const handleSaveTelegramConfig = async () => { await setSetting(SETTINGS_KEYS.TELEGRAM_CONFIG, JSON.stringify(telegramConfig)); alert('ذخیره شد'); };
  const handleSaveNotifyDefaults = async () => { await setSetting(SETTINGS_KEYS.NOTIFICATION_DEFAULTS, JSON.stringify(notifyDefaults)); alert('ذخیره شد'); };
  const handleCopySql = () => { navigator.clipboard.writeText(LATEST_SQL_UPDATE); alert('کپی شد'); };

  // Dashboard Ordering
  const moveModule = (index: number, direction: 'up' | 'down') => {
      const newOrder = [...moduleOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < newOrder.length) {
          [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
          setModuleOrder(newOrder);
      }
  };

  const handleSaveDashboardOrder = async () => {
      const ids = moduleOrder.map(m => m.id);
      await setSetting(SETTINGS_KEYS.DASHBOARD_ORDER, JSON.stringify(ids));
      alert('چیدمان داشبورد ذخیره شد.');
  };

  // --- Backup Handlers ---
  const handleDownloadBackup = async () => {
      try {
          const blob = await createBackup();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `YasoujAirport_Backup_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e: any) {
          alert('خطا در ایجاد بکاپ: ' + e.message);
      }
  };

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setRestoreFile(e.target.files[0]);
          setRestoreStep(2);
      }
  };

  const handleRestoreConfirm = async () => {
      if (inputBackupPassword !== backupPassword) {
          alert('رمز عبور اشتباه است.');
          return;
      }
      if (!restoreFile) return;

      setIsRestoring(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              await restoreBackup(json);
              alert('بازگردانی با موفقیت انجام شد. برنامه ریلود می‌شود.');
              window.location.reload();
          } catch (err: any) {
              alert('خطا در بازگردانی: ' + err.message);
              setIsRestoring(false);
          }
      };
      reader.readAsText(restoreFile);
  };

  const handleSaveBackupPassword = async () => {
      await setSetting('backup_password', backupPassword);
      alert('رمز عبور بکاپ ذخیره شد.');
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><Spinner className="w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-gray-100">
        <main className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl space-y-8 mt-6">
            <div className="border-b pb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center"><SettingsIcon className="ml-2" /> تنظیمات کلی</h2>
            </div>
            
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                {['sms', 'telegram', 'notifications', 'dashboard', 'sql', 'backup'].map(tab => (
                    <button key={tab} className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab(tab as any)}>
                        {tab === 'sms' ? 'پیامک' : tab === 'telegram' ? 'تلگرام' : tab === 'notifications' ? 'اعلان‌ها' : tab === 'dashboard' ? 'داشبورد' : tab === 'sql' ? 'SQL' : 'بکاپ و بازگردانی'}
                    </button>
                ))}
            </div>

            {/* Backup Tab */}
            {activeTab === 'backup' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm bg-yellow-50 border-yellow-200">
                        <div className="flex items-center mb-4 text-yellow-800">
                            <WarningIcon className="ml-2 text-2xl" />
                            <h3 className="text-xl font-semibold">مدیریت داده‌ها (آفلاین و آنلاین)</h3>
                        </div>
                        <p className="text-sm text-gray-700 mb-4">
                            آخرین نسخه دیتابیس آفلاین دریافتی: <span className="font-bold font-mono dir-ltr inline-block">{lastSyncDate ? new Date(lastSyncDate).toLocaleString('fa-IR') : 'هرگز'}</span>
                        </p>
                        
                        <div className="mb-6">
                            <Button variant="primary" onClick={() => setIsSyncModalOpen(true)} fullWidth className="bg-blue-600 hover:bg-blue-700 shadow-lg py-3">
                                <i className="fas fa-sync ml-2"></i> دریافت دستی دیتابیس آفلاین (Full Sync)
                            </Button>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                این گزینه تمام اطلاعات را از سرور دانلود کرده و در دیتابیس محلی (Dexie) ذخیره می‌کند. برای رفع مشکل عدم نمایش اطلاعات در حالت آفلاین از این گزینه استفاده کنید.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-yellow-200 pt-6">
                            <div className="bg-white p-4 rounded border">
                                <h4 className="font-bold mb-2">تهیه نسخه پشتیبان (JSON)</h4>
                                <p className="text-xs text-gray-500 mb-4">دانلود تمام اطلاعات دیتابیس محلی در یک فایل JSON.</p>
                                <Button variant="secondary" onClick={handleDownloadBackup}>
                                    <i className="fas fa-download ml-2"></i> دانلود فایل بکاپ
                                </Button>
                            </div>

                            <div className="bg-white p-4 rounded border">
                                <h4 className="font-bold mb-2">بازگردانی اطلاعات</h4>
                                <p className="text-xs text-gray-500 mb-4">لود کردن فایل بکاپ و جایگزینی دیتابیس فعلی.</p>
                                
                                {restoreStep === 1 && (
                                    <>
                                        <input type="file" ref={backupInputRef} onChange={handleRestoreFileSelect} accept=".json" className="hidden" />
                                        <Button variant="danger" onClick={() => backupInputRef.current?.click()}>
                                            <FileUploadIcon className="ml-2" /> انتخاب فایل بکاپ
                                        </Button>
                                    </>
                                )}

                                {restoreStep === 2 && restoreFile && (
                                    <div className="space-y-3">
                                        <p className="text-sm font-bold text-gray-800">فایل: {restoreFile.name}</p>
                                        <Input 
                                            type="password" 
                                            label="رمز عبور بازگردانی" 
                                            value={inputBackupPassword} 
                                            onChange={e => setInputBackupPassword(e.target.value)} 
                                            placeholder="رمز عبور را وارد کنید"
                                        />
                                        <div className="flex gap-2">
                                            <Button variant="success" onClick={handleRestoreConfirm} loading={isRestoring}>تایید و بازگردانی</Button>
                                            <Button variant="secondary" onClick={() => { setRestoreStep(1); setRestoreFile(null); }}>لغو</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-yellow-200">
                            <h4 className="font-bold text-gray-800 mb-3">تنظیم رمز عبور عملیات بازگردانی (Admin Only)</h4>
                            <div className="flex gap-2 items-end max-w-md">
                                <Input label="رمز عبور جدید" value={backupPassword} onChange={e => setBackupPassword(e.target.value)} />
                                <Button onClick={handleSaveBackupPassword}>ذخیره رمز</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* SMS Tab */}
            {activeTab === 'sms' && (
                <div className="space-y-4">
                    <Input label="آدرس API" value={smsConfig.baseUrl} onChange={e => setSmsConfig({...smsConfig, baseUrl: e.target.value})} />
                    <Input label="کلید API" value={smsConfig.apiKey} onChange={e => setSmsConfig({...smsConfig, apiKey: e.target.value})} type="password" />
                    <Input label="شماره فرستنده" value={smsConfig.fromNumber} onChange={e => setSmsConfig({...smsConfig, fromNumber: e.target.value})} />
                    <Button onClick={handleSaveSmsConfig}>ذخیره تنظیمات پیامک</Button>
                </div>
            )}

            {/* Telegram Tab */}
            {activeTab === 'telegram' && (
                <div className="space-y-4">
                    <div className="p-4 bg-blue-50 text-blue-800 rounded mb-4 text-sm border border-blue-100">
                        <p>برای دریافت اعلان‌ها، ربات تلگرام باید ساخته شده و توکن آن در اینجا وارد شود. کاربران باید در پروفایل خود Chat ID خود را وارد کنند.</p>
                    </div>
                    <Input label="توکن ربات (Bot Token)" value={telegramConfig.botToken} onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})} dir="ltr" />
                    <Input label="نام کاربری ربات (بدون @)" value={telegramConfig.botUsername} onChange={e => setTelegramConfig({...telegramConfig, botUsername: e.target.value})} dir="ltr" />
                    <div className="flex items-center mt-4">
                        <input type="checkbox" checked={telegramConfig.isEnabled} onChange={e => setTelegramConfig({...telegramConfig, isEnabled: e.target.checked})} className="h-4 w-4 text-blue-600 rounded ml-2" />
                        <label>فعال‌سازی سیستم اعلان تلگرام</label>
                    </div>
                    <Button onClick={handleSaveTelegramConfig} className="mt-4">ذخیره تنظیمات تلگرام</Button>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {Object.keys(notifyDefaults).filter(k => k !== 'smsFooter' && k !== 'telegramFooter').map((moduleKey) => {
                            const settings = (notifyDefaults as any)[moduleKey];
                            const persianName: Record<string, string> = {
                                task: 'مدیریت تسک‌ها',
                                cns: 'خرابی CNS',
                                phone: 'مدیریت تلفن',
                                maintenance: 'نت (PM)',
                                shift: 'مدیریت شیفت'
                            };

                            return (
                                <div key={moduleKey} className="border p-4 rounded-lg bg-gray-50">
                                    <h4 className="font-bold text-gray-700 mb-3 border-b pb-2">{persianName[moduleKey] || moduleKey}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h5 className="text-sm font-bold text-indigo-600 mb-2">پیامک (SMS)</h5>
                                            <label className="flex items-center mb-1 cursor-pointer select-none">
                                                <input type="checkbox" checked={settings.sms.enabled} onChange={e => setNotifyDefaults({...notifyDefaults, [moduleKey]: { ...settings, sms: { ...settings.sms, enabled: e.target.checked } }})} className="ml-2"/>
                                                <span className="text-sm">فعال</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer select-none">
                                                <input type="checkbox" checked={settings.sms.notifyAdminsOnAction} onChange={e => setNotifyDefaults({...notifyDefaults, [moduleKey]: { ...settings, sms: { ...settings.sms, notifyAdminsOnAction: e.target.checked } }})} className="ml-2"/>
                                                <span className="text-sm">اطلاع به مدیران (در هنگام اقدام)</span>
                                            </label>
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-blue-600 mb-2">تلگرام</h5>
                                            <label className="flex items-center mb-1 cursor-pointer select-none">
                                                <input type="checkbox" checked={settings.telegram.enabled} onChange={e => setNotifyDefaults({...notifyDefaults, [moduleKey]: { ...settings, telegram: { ...settings.telegram, enabled: e.target.checked } }})} className="ml-2"/>
                                                <span className="text-sm">فعال</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer select-none">
                                                <input type="checkbox" checked={settings.telegram.notifyAdminsOnAction} onChange={e => setNotifyDefaults({...notifyDefaults, [moduleKey]: { ...settings, telegram: { ...settings.telegram, notifyAdminsOnAction: e.target.checked } }})} className="ml-2"/>
                                                <span className="text-sm">اطلاع به مدیران (در هنگام اقدام)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="border-t pt-4">
                        <Input label="پاورقی پیامک‌ها (امضاء)" value={notifyDefaults.smsFooter} onChange={e => setNotifyDefaults({...notifyDefaults, smsFooter: e.target.value})} />
                        <Input label="پاورقی تلگرام (امضاء)" value={notifyDefaults.telegramFooter} onChange={e => setNotifyDefaults({...notifyDefaults, telegramFooter: e.target.value})} />
                    </div>
                    <Button onClick={handleSaveNotifyDefaults}>ذخیره تنظیمات اعلان‌ها</Button>
                </div>
            )}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <div>
                    <div className="mb-4 bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200">
                        ترتیب نمایش ماژول‌ها در صفحه اصلی (Main Dashboard) را تعیین کنید.
                    </div>
                    <div className="space-y-2 mb-6 max-w-2xl">
                        {moduleOrder.map((module, index) => (
                            <div key={module.id} className="flex items-center justify-between p-3 bg-gray-50 border rounded shadow-sm hover:bg-white transition-colors">
                                <span className="font-medium text-gray-700">{module.title}</span>
                                <div className="flex gap-1">
                                    <button onClick={() => moveModule(index, 'up')} disabled={index === 0} className="p-2 text-gray-500 hover:text-indigo-600 disabled:opacity-30 rounded hover:bg-gray-100 transition-colors">
                                        <i className="fas fa-arrow-up"></i>
                                    </button>
                                    <button onClick={() => moveModule(index, 'down')} disabled={index === moduleOrder.length - 1} className="p-2 text-gray-500 hover:text-indigo-600 disabled:opacity-30 rounded hover:bg-gray-100 transition-colors">
                                        <i className="fas fa-arrow-down"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button onClick={handleSaveDashboardOrder} variant="primary">ذخیره چیدمان</Button>
                </div>
            )}

            {/* SQL Tab */}
            {activeTab === 'sql' && (
                <div>
                    <TextArea value={LATEST_SQL_UPDATE} readOnly rows={10} className="font-mono text-sm mb-2" dir="ltr" />
                    <Button onClick={handleCopySql}><CopyIcon className="ml-2"/> کپی اسکریپت</Button>
                </div>
            )}
        </main>
        
        <ManualSyncModal 
            isOpen={isSyncModalOpen}
            onClose={() => {
                setIsSyncModalOpen(false);
                // Refresh data timestamp on close
                getLastSyncDate().then(setLastSyncDate);
            }}
        />
    </div>
  );
};
