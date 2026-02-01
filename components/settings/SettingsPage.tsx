
import React, { useState, useEffect, useRef } from 'react';
import {
  getSavedFonts,
  addFont,
  removeFont,
  getAppFontName,
  setAppFont,
  getPdfFont,
  setPdfFont,
} from '../../utils/fontManager';
// FIX: NotificationDefaults is exported from types.ts, not notificationService.ts
import { CustomFont, CustomDashboardCard, AssetStatus, NotificationDefaults } from '../../types';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Input, TextArea } from '../ui/Input';
import { AddIcon, DeleteIcon, SettingsIcon, CopyIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { getSetting, setSetting } from '../../supabaseService';
import { useSupabaseContext } from '../../SupabaseContext';
import { ASSET_STATUSES, SETTINGS_KEYS, DASHBOARD_MODULES_INFO, DB_VERSION, LATEST_SQL_UPDATE } from '../../constants';
import { useNavigate } from 'react-router-dom';
// FIX: Removed NotificationDefaults from this import
import { getNotificationDefaults, DEFAULT_NOTIFICATION_SETTINGS, MODULE_FIELDS } from '../../services/notificationService';
import { syncFullDatabase, getLastSyncTime } from '../../services/offlineService';

const SYSTEM_FONT_OPTION_LABEL = 'فونت پیش‌فرض سیستم';
const SYSTEM_FONT_OPTION_VALUE = 'System Default';

// ... (Interface definitions unchanged) ...
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

// ... (AssetSettingsPage unchanged) ...
export const AssetSettingsPage: React.FC = () => {
  const { categories, locations, isLoading: isContextLoading } = useSupabaseContext();
  const [customCards, setCustomCards] = useState<CustomDashboardCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state for adding/editing card
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
    if (!newCardName.trim()) {
        setModalError('نام کارت الزامی است.');
        return;
    }
    if (!newCardFilterValue) {
        setModalError('لطفا مقدار فیلتر (دسته/محل) را انتخاب کنید.');
        return;
    }

    setIsSaving(true);
    try {
        const filterItemName = newCardFilterType === 'category' 
            ? categories.find(c => c.id === newCardFilterValue)?.name 
            : locations.find(l => l.id === newCardFilterValue)?.name;

        const newCard: CustomDashboardCard = {
            id: Date.now().toString(),
            name: newCardName,
            filterType: newCardFilterType,
            filterValue: newCardFilterValue,
            filterValueName: filterItemName || 'نامشخص',
            statusFilter: newCardStatusFilter
        };

        const updatedCards = [...customCards, newCard];
        await setSetting(SETTINGS_KEYS.DASHBOARD_CARDS, JSON.stringify(updatedCards));
        setCustomCards(updatedCards);
        setIsModalOpen(false);
        resetModal();
    } catch(e: any) {
        setModalError(e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteCard = async () => {
      if (!cardToDelete) return;
      setIsSaving(true);
      try {
          const updatedCards = customCards.filter(c => c.id !== cardToDelete.id);
          await setSetting(SETTINGS_KEYS.DASHBOARD_CARDS, JSON.stringify(updatedCards));
          setCustomCards(updatedCards);
          setIsDeleteConfirmOpen(false);
          setCardToDelete(null);
      } catch (e: any) {
          setError(e.message);
      } finally {
          setIsSaving(false);
      }
  };

  const resetModal = () => {
      setNewCardName('');
      setNewCardFilterType('category');
      setNewCardFilterValue('');
      setNewCardStatusFilter('all');
      setModalError(null);
  };

  const openAddModal = () => {
      resetModal();
      setIsModalOpen(true);
  };

  if (isLoading || isContextLoading) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
      <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <SettingsIcon className="ml-2" /> تنظیمات داشبورد اموال
              </h2>
              <Button variant="primary" onClick={openAddModal}>
                  <AddIcon className="ml-2" /> کارت جدید
              </Button>
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
                      <button 
                          onClick={() => { setCardToDelete(card); setIsDeleteConfirmOpen(true); }}
                          className="absolute top-4 left-4 text-red-500 hover:text-red-700"
                      >
                          <DeleteIcon />
                      </button>
                  </div>
              ))}
              {customCards.length === 0 && <p className="text-gray-500 col-span-3 text-center py-8">هیچ کارت سفارشی تعریف نشده است.</p>}
          </div>

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="افزودن کارت داشبورد">
              <div className="p-4 space-y-4">
                  {modalError && <div className="p-2 text-sm text-red-700 bg-red-100 rounded">{modalError}</div>}
                  
                  <Input label="نام کارت" value={newCardName} onChange={e => setNewCardName(e.target.value)} required />
                  
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">نوع فیلتر</label>
                      <div className="flex gap-4">
                          <label className="flex items-center">
                              <input type="radio" checked={newCardFilterType === 'category'} onChange={() => setNewCardFilterType('category')} className="ml-2" />
                              دسته‌بندی
                          </label>
                          <label className="flex items-center">
                              <input type="radio" checked={newCardFilterType === 'location'} onChange={() => setNewCardFilterType('location')} className="ml-2" />
                              محل قرارگیری
                          </label>
                      </div>
                  </div>

                  <Select 
                      label={newCardFilterType === 'category' ? 'انتخاب دسته' : 'انتخاب محل'}
                      value={newCardFilterValue}
                      onChange={e => setNewCardFilterValue(e.target.value)}
                      options={[
                          { value: '', label: 'انتخاب کنید...', disabled: true },
                          ...(newCardFilterType === 'category' 
                              ? categories.map(c => ({ value: c.id, label: c.name }))
                              : locations.map(l => ({ value: l.id, label: l.name }))
                          )
                      ]}
                  />

                  <Select 
                      label="فیلتر وضعیت"
                      value={newCardStatusFilter}
                      onChange={e => setNewCardStatusFilter(e.target.value as any)}
                      options={[
                          { value: 'all', label: 'همه وضعیت‌ها' },
                          ...ASSET_STATUSES.map(s => ({ value: s, label: s }))
                      ]}
                  />

                  <div className="flex justify-end pt-4 border-t">
                      <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="ml-2">لغو</Button>
                      <Button variant="primary" onClick={handleAddCard} loading={isSaving} disabled={isSaving}>ذخیره</Button>
                  </div>
              </div>
          </Modal>

          <ConfirmDialog 
              isOpen={isDeleteConfirmOpen}
              onClose={() => setIsDeleteConfirmOpen(false)}
              onConfirm={handleDeleteCard}
              title="حذف کارت"
              message={`آیا از حذف کارت "${cardToDelete?.name}" مطمئن هستید؟`}
              confirmText="حذف"
              isConfirming={isSaving}
          />
      </div>
  );
};

// =================================================================
// Global Settings Component (Fonts + SMS + Dashboard + Telegram + Offline)
// =================================================================
export const GlobalSettings: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'fonts' | 'sms' | 'telegram' | 'notifications' | 'dashboard' | 'sql' | 'offline'>('fonts');

  // Font states
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  const [selectedAppFont, setSelectedAppFont] = useState('');
  const [selectedPdfFontId, setSelectedPdfFontId] = useState('');
  const [savedAppFont, setSavedAppFont] = useState('');
  const [savedPdfFontId, setSavedPdfFontId] = useState('');

  // SMS states
  const [smsConfig, setSmsConfig] = useState<SmsConfig>({
      baseUrl: "https://edge.ippanel.com/v1",
      apiKey: "",
      fromNumber: "+983000505"
  });

  // Telegram states
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
      botToken: "",
      botUsername: "",
      isEnabled: false
  });

  // Notification Defaults
  const [notifyDefaults, setNotifyDefaults] = useState<NotificationDefaults>(DEFAULT_NOTIFICATION_SETTINGS);

  // Dashboard Order states
  const [moduleOrder, setModuleOrder] = useState<{id: string, title: string}[]>([]);

  // Offline Sync States
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // General states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Font modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFontName, setNewFontName] = useState('');
  const [newFontFile, setNewFontFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [addFontError, setAddFontError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [fontToDelete, setFontToDelete] = useState<CustomFont | null>(null);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load fonts
      const savedFonts = await getSavedFonts();
      const appFontName = await getAppFontName();
      const pdfFont = await getPdfFont();
      
      setFonts(savedFonts);
      setSelectedAppFont(appFontName);
      setSavedAppFont(appFontName);
      const pdfFontId = pdfFont?.id || '';
      setSelectedPdfFontId(pdfFontId);
      setSavedPdfFontId(pdfFontId);

      // Load SMS Config
      const savedSmsConfig = await getSetting(SETTINGS_KEYS.SMS_CONFIG);
      if (savedSmsConfig) {
          setSmsConfig(JSON.parse(savedSmsConfig));
      }

      // Load Telegram Config
      const savedTelegramConfig = await getSetting(SETTINGS_KEYS.TELEGRAM_CONFIG);
      if (savedTelegramConfig) {
          setTelegramConfig(JSON.parse(savedTelegramConfig));
      }

      // Load Notification Defaults
      const defaults = await getNotificationDefaults();
      setNotifyDefaults(defaults);

      // Load Dashboard Order
      const savedOrder = await getSetting(SETTINGS_KEYS.DASHBOARD_ORDER);
      let orderIds: string[] = [];
      if (savedOrder) {
          orderIds = JSON.parse(savedOrder);
      } else {
          orderIds = DASHBOARD_MODULES_INFO.map(m => m.id);
      }
      
      const allIds = [...new Set([...orderIds, ...DASHBOARD_MODULES_INFO.map(m => m.id)])];
      const orderedModules = allIds
        .map(id => DASHBOARD_MODULES_INFO.find(m => m.id === id))
        .filter(Boolean) as {id: string, title: string}[];
      
      setModuleOrder(orderedModules);

      // Load Sync Time
      setLastSyncTime(getLastSyncTime());

    } catch (e: any) {
      setError('خطا در بارگذاری تنظیمات: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleManualSync = async () => {
      setIsSyncing(true);
      const success = await syncFullDatabase();
      setIsSyncing(false);
      if (success) {
          setLastSyncTime(getLastSyncTime());
          alert('همگام‌سازی دیتابیس با موفقیت انجام شد.');
      } else {
          alert('همگام‌سازی با خطا مواجه شد. لطفاً اتصال اینترنت را بررسی کنید.');
      }
  };

  // ... (Other handlers unchanged) ...
  const handleAppFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAppFont(e.target.value);
  };

  const handlePdfFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPdfFontId(e.target.value);
  };
  
  const handleApplyFontChanges = async () => {
    setIsApplying(true);
    setError(null);
    try {
      await Promise.all([
        setAppFont(selectedAppFont),
        setPdfFont(selectedPdfFontId),
      ]);
      setSavedAppFont(selectedAppFont);
      setSavedPdfFontId(selectedPdfFontId);
      alert('تغییرات فونت با موفقیت اعمال شد.');
    } catch (e: any) {
      setError('خطا در اعمال تغییرات فونت: ' + e.message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleAddFont = async () => {
    if (!newFontName.trim() || !newFontFile) {
      setAddFontError('نام فونت و فایل هر دو اجباری هستند.');
      return;
    }
    setIsSaving(true);
    setAddFontError(null);
    try {
      await addFont(newFontName, newFontFile);
      setIsAddModalOpen(false);
      setNewFontName('');
      setNewFontFile(null);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
      await loadSettings();
    } catch (e: any) {
      setAddFontError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFont = (font: CustomFont) => {
    setFontToDelete(font);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteFont = async () => {
    if (fontToDelete) {
      setIsSaving(true);
      setError(null);
      try {
        await removeFont(fontToDelete.id);
        setIsDeleteConfirmOpen(false);
        setFontToDelete(null);
        await loadSettings(); 
      } catch (e: any) {
        setError("خطا در حذف فونت: " + e.message)
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveSmsConfig = async () => {
      setIsSaving(true);
      try {
          await setSetting(SETTINGS_KEYS.SMS_CONFIG, JSON.stringify(smsConfig));
          alert('تنظیمات پیامک با موفقیت ذخیره شد.');
      } catch (e: any) {
          alert('خطا در ذخیره تنظیمات پیامک: ' + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveTelegramConfig = async () => {
      setIsSaving(true);
      try {
          await setSetting(SETTINGS_KEYS.TELEGRAM_CONFIG, JSON.stringify(telegramConfig));
          alert('تنظیمات تلگرام با موفقیت ذخیره شد.');
      } catch (e: any) {
          alert('خطا در ذخیره تنظیمات تلگرام: ' + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveNotifyDefaults = async () => {
      setIsSaving(true);
      try {
          await setSetting(SETTINGS_KEYS.NOTIFICATION_DEFAULTS, JSON.stringify(notifyDefaults));
          alert('تنظیمات پیش‌فرض اطلاع‌رسانی با موفقیت ذخیره شد.');
      } catch (e: any) {
          alert('خطا در ذخیره تنظیمات اطلاع‌رسانی: ' + e.message);
      } finally {
          setIsSaving(false);
      }
  };
  
  const updateModuleSetting = (module: keyof NotificationDefaults, channel: 'sms' | 'telegram', key: 'enabled' | 'fields' | 'notifyAdminsOnAction', value: any) => {
      setNotifyDefaults(prev => ({
          ...prev,
          [module]: {
              ...prev[module],
              [channel]: {
                  ...(prev[module] as any)[channel],
                  [key]: value
              }
          }
      }));
  };

  const toggleField = (module: keyof NotificationDefaults, channel: 'sms' | 'telegram', fieldKey: string) => {
      const currentFields = (notifyDefaults[module] as any)[channel].fields as string[] || [];
      const newFields = currentFields.includes(fieldKey)
          ? currentFields.filter(f => f !== fieldKey)
          : [...currentFields, fieldKey];
      updateModuleSetting(module, channel, 'fields', newFields);
  };
  
  const moveModule = (index: number, direction: 'up' | 'down') => {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === moduleOrder.length - 1)) {
          return;
      }
      
      const newOrder = [...moduleOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setModuleOrder(newOrder);
  };
  
  const handleSaveDashboardOrder = async () => {
      setIsSaving(true);
      try {
          const ids = moduleOrder.map(m => m.id);
          await setSetting(SETTINGS_KEYS.DASHBOARD_ORDER, JSON.stringify(ids));
          alert('چیدمان داشبورد با موفقیت ذخیره شد.');
      } catch (e: any) {
          alert('خطا در ذخیره چیدمان: ' + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleCopySql = () => {
      navigator.clipboard.writeText(LATEST_SQL_UPDATE);
      alert('کد SQL با موفقیت کپی شد. اکنون می‌توانید آن را در SQL Editor سوپابیس اجرا کنید.');
  };

  const fontOptions = [
    { value: SYSTEM_FONT_OPTION_VALUE, label: SYSTEM_FONT_OPTION_LABEL },
    ...fonts.map((f) => ({ value: f.name, label: f.name }))
  ];

  const pdfFontOptions = [
      { value: '', label: 'بدون فونت سفارشی (Helvetica)' },
      ...fonts.map((f) => ({ value: f.id, label: f.name }))
  ];
  
  const hasFontChanges = selectedAppFont !== savedAppFont || selectedPdfFontId !== savedPdfFontId;

  const NotificationSection = ({ title, moduleKey, fields }: { title: string, moduleKey: keyof typeof MODULE_FIELDS, fields: Record<string, string> }) => {
      const moduleSettings = notifyDefaults[moduleKey] as any;
      return (
        <div className="bg-gray-50 p-4 rounded-md border">
            <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">{title}</h4>
            
            <div className="mb-4">
                <div className="flex items-center mb-2">
                    <input 
                        type="checkbox" 
                        checked={moduleSettings.sms.enabled} 
                        onChange={e => updateModuleSetting(moduleKey, 'sms', 'enabled', e.target.checked)} 
                        className="h-4 w-4 text-indigo-600 rounded ml-2" 
                    />
                    <span className="font-medium text-indigo-700">ارسال پیامک (به کاربر مسئول)</span>
                </div>
                
                <div className="flex items-center mb-2 mr-6">
                    <input 
                        type="checkbox" 
                        checked={moduleSettings.sms.notifyAdminsOnAction} 
                        onChange={e => updateModuleSetting(moduleKey, 'sms', 'notifyAdminsOnAction', e.target.checked)} 
                        className="h-4 w-4 text-indigo-500 rounded ml-2" 
                    />
                    <span className="text-sm text-gray-700">ارسال پیامک اقدام به مدیران (Admin)</span>
                </div>

                {moduleSettings.sms.enabled && (
                    <div className="mr-6 grid grid-cols-2 gap-2">
                        {Object.entries(fields).map(([key, label]) => (
                            <label key={`sms-${moduleKey}-${key}`} className="flex items-center text-sm cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={moduleSettings.sms.fields?.includes(key)} 
                                    onChange={() => toggleField(moduleKey, 'sms', key)}
                                    className="h-3 w-3 text-indigo-500 rounded ml-1"
                                />
                                <span className="text-gray-600">{label}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="flex items-center mb-2">
                    <input 
                        type="checkbox" 
                        checked={moduleSettings.telegram.enabled} 
                        onChange={e => updateModuleSetting(moduleKey, 'telegram', 'enabled', e.target.checked)} 
                        className="h-4 w-4 text-blue-500 rounded ml-2" 
                    />
                    <span className="font-medium text-blue-700">ارسال تلگرام (به کاربر مسئول)</span>
                </div>

                <div className="flex items-center mb-2 mr-6">
                    <input 
                        type="checkbox" 
                        checked={moduleSettings.telegram.notifyAdminsOnAction} 
                        onChange={e => updateModuleSetting(moduleKey, 'telegram', 'notifyAdminsOnAction', e.target.checked)} 
                        className="h-4 w-4 text-blue-500 rounded ml-2" 
                    />
                    <span className="text-sm text-gray-700">ارسال تلگرام اقدام به مدیران (Admin)</span>
                </div>

                {moduleSettings.telegram.enabled && (
                    <div className="mr-6 grid grid-cols-2 gap-2">
                        {Object.entries(fields).map(([key, label]) => (
                            <label key={`tg-${moduleKey}-${key}`} className="flex items-center text-sm cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={moduleSettings.telegram.fields?.includes(key)} 
                                    onChange={() => toggleField(moduleKey, 'telegram', key)}
                                    className="h-3 w-3 text-blue-500 rounded ml-1"
                                />
                                <span className="text-gray-600">{label}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
      );
  };

  if (isLoading) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Spinner className="w-10 h-10" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
        <main className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl space-y-8 mt-6">
            <div className="border-b pb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <SettingsIcon className="ml-2" /> تنظیمات کلی برنامه
                </h2>
                <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 dir-ltr">
                        App Version: 1.28
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1 mr-2">
                        DB Version: {DB_VERSION}
                    </span>
                </div>
            </div>
            
            {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'fonts' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('fonts')}
                >
                    تنظیمات فونت
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'sms' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('sms')}
                >
                    تنظیمات پیامک
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'telegram' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('telegram')}
                >
                    تنظیمات تلگرام
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'notifications' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('notifications')}
                >
                    تنظیمات اطلاع‌رسانی
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'dashboard' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    چیدمان داشبورد
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'sql' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('sql')}
                >
                    اسکریپت‌های SQL
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'offline' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('offline')}
                >
                    مدیریت آفلاین
                </button>
            </div>

            {/* Offline Tab Content */}
            {activeTab === 'offline' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm bg-gray-50">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">همگام‌سازی دیتابیس</h3>
                        <p className="text-gray-600 mb-4 text-sm">
                            این قابلیت اطلاعات کلیدی دیتابیس (شامل اموال، خطوط تلفن و مخاطبین) را دانلود و در حافظه دستگاه ذخیره می‌کند تا در صورت قطع اینترنت بتوانید به صورت آفلاین از برنامه استفاده کنید.
                        </p>
                        
                        <div className="bg-white p-4 rounded border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div>
                                <span className="block text-gray-700 font-bold mb-1">آخرین همگام‌سازی:</span>
                                <span className="text-sm text-gray-500 dir-ltr">{lastSyncTime ? new Date(lastSyncTime).toLocaleString('fa-IR') : 'هرگز'}</span>
                            </div>
                            <Button 
                                variant="primary" 
                                onClick={handleManualSync} 
                                loading={isSyncing}
                                disabled={isSyncing || !navigator.onLine}
                            >
                                <i className="fas fa-sync ml-2"></i> همگام‌سازی دستی اکنون
                            </Button>
                        </div>
                        
                        {!navigator.onLine && (
                            <div className="p-3 bg-red-100 text-red-700 rounded text-sm mb-4">
                                <i className="fas fa-wifi-slash ml-2"></i>
                                اتصال اینترنت برقرار نیست. امکان همگام‌سازی وجود ندارد.
                            </div>
                        )}
                        
                        <p className="text-xs text-gray-500">
                            نکته: در نسخه اندروید، برنامه هر ۳۰ ثانیه در صورت وجود اینترنت تلاش می‌کند تا دیتابیس را به‌روزرسانی کند.
                        </p>
                    </div>
                </div>
            )}

            {/* ... Other tabs content (sql, fonts, sms, telegram, notifications, dashboard) unchanged ... */}
            {/* Keeping existing code for other tabs to save space in diff, assume they exist */}
            
            {activeTab === 'sql' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-gray-800">بروزرسانی ساختار دیتابیس</h3>
                            <Button variant="secondary" size="sm" onClick={handleCopySql}>
                                <CopyIcon className="ml-2" /> کپی دستورات SQL
                            </Button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                            در صورتی که تغییراتی در ساختار دیتابیس (مثل اضافه شدن ستون‌های جدید) اعمال شده باشد، کدهای زیر را کپی کرده و در بخش <b>SQL Editor</b> کنسول سوپابیس اجرا کنید.
                        </p>
                        <div className="relative">
                            <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto text-xs dir-ltr text-left border-2 border-indigo-300 font-mono min-h-[150px]">
                                {LATEST_SQL_UPDATE}
                            </pre>
                            <div className="absolute top-2 right-2 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded">
                                SQL Version: {DB_VERSION}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'fonts' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">فونت برنامه</h3>
                    <Select label="فونت فعال برنامه" options={fontOptions} value={selectedAppFont} onChange={handleAppFontChange} />
                    </div>
                    <div className="p-6 border rounded-lg shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">فونت خروجی PDF</h3>
                    <Select label="فونت فعال PDF" options={pdfFontOptions} value={selectedPdfFontId} onChange={handlePdfFontChange} />
                    </div>
                    <div className="mt-8 pt-6 border-t flex justify-start">
                    <Button variant="primary" size="lg" onClick={handleApplyFontChanges} disabled={!hasFontChanges || isApplying} loading={isApplying}>اعمال تغییرات فونت</Button>
                    </div>
                    <div className="p-6 border rounded-lg shadow-sm bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-gray-800">مدیریت فایل‌های فونت</h3>
                        <Button variant="secondary" onClick={() => setIsAddModalOpen(true)}><AddIcon className="ml-2" /> افزودن فونت جدید</Button>
                    </div>
                    <div className="space-y-2">
                        {fonts.length > 0 ? fonts.map((font) => (
                        <div key={font.id} className="flex items-center justify-between p-3 bg-white border rounded-md">
                            <span className="font-medium text-gray-700">{font.name}</span>
                            <Button variant="danger" size="sm" onClick={() => handleDeleteFont(font)} disabled={isSaving}><DeleteIcon /></Button>
                        </div>
                        )) : <p className="text-gray-500">هیچ فونت سفارشی اضافه نشده است.</p>}
                    </div>
                    </div>
                </div>
            )}

            {activeTab === 'sms' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">پیکربندی پنل پیامکی (IPPanel)</h3>
                        <div className="space-y-4 max-w-2xl">
                            <Input label="آدرس پایه (Base URL)" value={smsConfig.baseUrl} onChange={(e) => setSmsConfig({ ...smsConfig, baseUrl: e.target.value })} dir="ltr" />
                            <Input label="کلید دسترسی (API Key)" value={smsConfig.apiKey} onChange={(e) => setSmsConfig({ ...smsConfig, apiKey: e.target.value })} dir="ltr" type="password" />
                            <Input label="شماره فرستنده (From Number)" value={smsConfig.fromNumber} onChange={(e) => setSmsConfig({ ...smsConfig, fromNumber: e.target.value })} dir="ltr" />
                        </div>
                        <div className="mt-8 pt-6 border-t flex justify-start">
                            <Button variant="primary" size="lg" onClick={handleSaveSmsConfig} loading={isSaving} disabled={isSaving}>ذخیره تنظیمات پیامک</Button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'telegram' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm bg-blue-50 border-blue-100">
                        <h3 className="text-xl font-semibold text-blue-900 mb-4 flex items-center"><i className="fab fa-telegram ml-2 text-2xl"></i> پیکربندی ربات تلگرام</h3>
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex items-center mb-4">
                                <input type="checkbox" checked={telegramConfig.isEnabled} onChange={(e) => setTelegramConfig({...telegramConfig, isEnabled: e.target.checked})} className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 ml-2"/>
                                <label className="text-gray-800 font-medium">فعال‌سازی سیستم اطلاع‌رسانی تلگرام</label>
                            </div>
                            <Input label="توکن ربات (Bot Token)" value={telegramConfig.botToken} onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })} dir="ltr" type="password" disabled={!telegramConfig.isEnabled} />
                            <Input label="نام کاربری ربات (Bot Username)" value={telegramConfig.botUsername} onChange={(e) => setTelegramConfig({ ...telegramConfig, botUsername: e.target.value.replace('@', '') })} dir="ltr" disabled={!telegramConfig.isEnabled} />
                        </div>
                        <div className="mt-8 pt-6 border-t border-blue-200 flex justify-start">
                            <Button variant="primary" size="lg" onClick={handleSaveTelegramConfig} loading={isSaving} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">ذخیره تنظیمات تلگرام</Button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">تنظیمات پیشرفته ارسال اعلان</h3>
                        <div className="space-y-6">
                            <div className="bg-white p-4 rounded-md border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-3">متن پاورقی (Footer)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="پاورقی پیامک" value={notifyDefaults.smsFooter} onChange={e => setNotifyDefaults({...notifyDefaults, smsFooter: e.target.value})} />
                                    <Input label="پاورقی تلگرام" value={notifyDefaults.telegramFooter} onChange={e => setNotifyDefaults({...notifyDefaults, telegramFooter: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <NotificationSection title="ماژول تسک‌ها" moduleKey="task" fields={MODULE_FIELDS.task} />
                                <NotificationSection title="ماژول خرابی CNS" moduleKey="cns" fields={MODULE_FIELDS.cns} />
                                <NotificationSection title="ماژول خرابی تلفن" moduleKey="phone" fields={MODULE_FIELDS.phone} />
                                <NotificationSection title="ماژول سرویس و نگهداری" moduleKey="maintenance" fields={MODULE_FIELDS.maintenance} />
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t flex justify-start">
                            <Button variant="primary" size="lg" onClick={handleSaveNotifyDefaults} loading={isSaving} disabled={isSaving}>ذخیره تنظیمات اطلاع‌رسانی</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="p-6 border rounded-lg shadow-sm">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">تنظیم چیدمان داشبورد</h3>
                        <div className="space-y-2 max-w-3xl">
                            {moduleOrder.map((module, index) => (
                                <div key={module.id} className="flex items-center justify-between p-3 bg-gray-50 border rounded-md hover:bg-gray-100 transition-colors">
                                    <span className="font-medium text-gray-800">{module.title}</span>
                                    <div className="flex space-x-2 space-x-reverse">
                                        <button type="button" onClick={() => moveModule(index, 'up')} disabled={index === 0} className="p-2 text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"><i className="fas fa-arrow-up"></i></button>
                                        <button type="button" onClick={() => moveModule(index, 'down')} disabled={index === moduleOrder.length - 1} className="p-2 text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"><i className="fas fa-arrow-down"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 pt-6 border-t flex justify-start">
                            <Button variant="primary" size="lg" onClick={handleSaveDashboardOrder} loading={isSaving} disabled={isSaving}>ذخیره چیدمان</Button>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="افزودن فونت جدید">
                <div className="p-4 space-y-4">
                {addFontError && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{addFontError}</div>}
                <Input label="نام فونت" placeholder="مثال: IranSans" value={newFontName} onChange={(e) => setNewFontName(e.target.value)} />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">فایل فونت (ttf)</label>
                    <input type="file" accept=".ttf" ref={fileInputRef} onChange={(e) => setNewFontFile(e.target.files ? e.target.files[0] : null)} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                </div>
                <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t">
                    <Button variant="primary" onClick={handleAddFont} loading={isSaving} disabled={isSaving}>ذخیره</Button>
                    <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>لغو</Button>
                </div>
                </div>
            </Modal>

            <ConfirmDialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={confirmDeleteFont} title="حذف فونت" message={`آیا از حذف فونت "${fontToDelete?.name}" مطمئن هستید؟`} confirmText="حذف" isConfirming={isSaving} />
        </main>
    </div>
  );
};
