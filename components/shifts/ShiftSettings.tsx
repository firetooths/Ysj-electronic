
import React, { useState, useEffect } from 'react';
import { ShiftTemplates, getShiftTemplates, saveShiftTemplates } from '../../services/shiftNotificationService';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { SettingsIcon } from '../ui/Icons';

const VARIABLE_GUIDE = [
    { key: '{requester}', desc: 'نام درخواست دهنده' },
    { key: '{provider}', desc: 'نام همکار تامین کننده (جایگزین)' },
    { key: '{supervisor}', desc: 'نام مسئول تایید' },
    { key: '{type}', desc: 'نوع درخواست (مرخصی، تعویض...)' },
    { key: '{dates}', desc: 'تاریخ‌های درخواست' },
    { key: '{details}', desc: 'توضیحات کاربر' },
    { key: '{link}', desc: 'لینک مشاهده درخواست در برنامه' },
];

export const ShiftSettings: React.FC = () => {
    const [templates, setTemplates] = useState<ShiftTemplates | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getShiftTemplates().then(data => {
            setTemplates(data);
            setLoading(false);
        });
    }, []);

    const handleChange = (section: keyof ShiftTemplates, field: keyof ShiftTemplates[typeof section], value: any) => {
        if (!templates) return;
        setTemplates({
            ...templates,
            [section]: {
                ...templates[section],
                [field]: value
            }
        });
    };

    const handleSave = async () => {
        if (!templates) return;
        setSaving(true);
        try {
            await saveShiftTemplates(templates);
            alert('تنظیمات با موفقیت ذخیره شد.');
        } catch (e) {
            alert('خطا در ذخیره تنظیمات.');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !templates) return <div className="flex justify-center p-10"><Spinner /></div>;

    const SectionBlock = ({ title, sectionKey }: { title: string, sectionKey: keyof ShiftTemplates }) => (
        <div className="bg-white p-4 rounded-lg shadow border mb-6">
            <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-indigo-700">متن پیامک (SMS)</label>
                    <TextArea 
                        rows={3} 
                        value={templates[sectionKey].sms} 
                        onChange={e => handleChange(sectionKey, 'sms', e.target.value)}
                        className="text-sm"
                    />
                    <label className="flex items-center cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            checked={templates[sectionKey].smsEnabled}
                            onChange={e => handleChange(sectionKey, 'smsEnabled', e.target.checked)}
                            className="h-4 w-4 text-indigo-600 rounded ml-2 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-600">ارسال پیامک به صورت پیش‌فرض فعال باشد</span>
                    </label>
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-blue-600">متن تلگرام (HTML)</label>
                    <TextArea 
                        rows={3} 
                        value={templates[sectionKey].telegram} 
                        onChange={e => handleChange(sectionKey, 'telegram', e.target.value)}
                        className="text-sm font-mono dir-ltr"
                    />
                    <label className="flex items-center cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            checked={templates[sectionKey].telegramEnabled}
                            onChange={e => handleChange(sectionKey, 'telegramEnabled', e.target.checked)}
                            className="h-4 w-4 text-blue-600 rounded ml-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">ارسال تلگرام به صورت پیش‌فرض فعال باشد</span>
                    </label>
                </div>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <SettingsIcon className="ml-2" /> تنظیمات اطلاع‌رسانی شیفت
                </h2>
                <Button variant="primary" onClick={handleSave} loading={saving}>ذخیره تغییرات</Button>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
                <h4 className="font-bold text-yellow-800 mb-2 text-sm">راهنمای متغیرها</h4>
                <div className="flex flex-wrap gap-2">
                    {VARIABLE_GUIDE.map(v => (
                        <span key={v.key} className="bg-white px-2 py-1 rounded border text-xs text-gray-700" title={v.desc}>
                            <span className="font-mono font-bold text-indigo-600">{v.key}</span> : {v.desc}
                        </span>
                    ))}
                </div>
            </div>

            <SectionBlock title="۱. ثبت درخواست جدید (مرخصی/استعلاجی/دعوت)" sectionKey="NEW_REQUEST_LEAVE" />
            <SectionBlock title="۲. ثبت درخواست تعویض (ارسال به همکار)" sectionKey="NEW_REQUEST_EXCHANGE" />
            <SectionBlock title="۳. تایید همکار (ارسال به مسئول)" sectionKey="PROVIDER_ACCEPTED" />
            <SectionBlock title="۴. تایید نهایی (ارسال به درخواست‌دهنده)" sectionKey="APPROVED" />
            <SectionBlock title="۵. رد درخواست (ارسال به درخواست‌دهنده)" sectionKey="REJECTED" />
        </div>
    );
};
