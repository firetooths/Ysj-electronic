
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { getUsers } from '../../services/authService';
import { createShiftRequest } from '../../services/shiftService';
import { sendShiftNotification, getShiftTemplates } from '../../services/shiftNotificationService';
import { User, ShiftRequestType, ShiftRequest } from '../../types';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';

interface Props {
    type: ShiftRequestType;
    onClose: () => void;
    onSuccess: () => void;
}

export const ShiftRequestForm: React.FC<Props> = ({ type, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [dates, setDates] = useState<string[]>(['']);
    const [providerId, setProviderId] = useState('');
    const [supervisorId, setSupervisorId] = useState('');
    const [description, setDescription] = useState('');
    
    // Notifications State
    const [notifySms, setNotifySms] = useState(true);
    const [notifyTg, setNotifyTg] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [usersData, templates] = await Promise.all([
                    getUsers(),
                    getShiftTemplates()
                ]);
                setUsers(usersData);
                
                // Set default notification state based on settings
                const settingsKey = type === ShiftRequestType.EXCHANGE ? 'NEW_REQUEST_EXCHANGE' : 'NEW_REQUEST_LEAVE';
                setNotifySms(templates[settingsKey].smsEnabled);
                setNotifyTg(templates[settingsKey].telegramEnabled);
            } catch (e) {
                console.error("Error loading form data", e);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [type]);

    const addDate = () => setDates([...dates, '']);
    const updateDate = (idx: number, val: string) => {
        const newDates = [...dates];
        newDates[idx] = val;
        setDates(newDates);
    };

    const removeDate = (idx: number) => {
        if (dates.length > 1) {
            setDates(dates.filter((_, i) => i !== idx));
        } else {
            setDates(['']);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        const validDates = dates.filter(d => d);
        if (validDates.length === 0) return alert('حداقل یک تاریخ انتخاب کنید');
        if (!supervisorId) return alert('سرکشیک مسئول را انتخاب کنید');
        if (type === ShiftRequestType.EXCHANGE && !providerId) return alert('همکار تامین کننده را انتخاب کنید');

        setSubmitting(true);
        try {
            const newRequest = await createShiftRequest({
                request_type: type,
                requester_id: user.id,
                provider_id: providerId || null,
                supervisor_id: supervisorId,
                dates: validDates,
                description
            });

            const requester = user;
            const provider = users.find(u => u.id === providerId);
            const supervisor = users.find(u => u.id === supervisorId);
            
            const fullRequest: ShiftRequest = {
                ...newRequest,
                requester: requester,
                provider: provider,
                supervisor: supervisor
            };

            const appUrl = window.location.origin + window.location.pathname;
            const link = `${appUrl}#/shifts`;
            const notifyOptions = { sms: notifySms, telegram: notifyTg };

            // Send Notifications
            if (type === ShiftRequestType.EXCHANGE && provider) {
                await sendShiftNotification('NEW_REQUEST_EXCHANGE', fullRequest, provider, link, notifyOptions);
            } else if (supervisor) {
                await sendShiftNotification('NEW_REQUEST_LEAVE', fullRequest, supervisor, link, notifyOptions);
            }

            alert('درخواست با موفقیت ثبت شد و در چرخه تایید قرار گرفت.');
            onSuccess();
        } catch (e: any) {
            alert('خطا در ثبت درخواست: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center p-5"><Spinner /></div>;

    const targetLabel = type === ShiftRequestType.EXCHANGE ? 'همکار تامین کننده' : 'سرکشیک مسئول';

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-2">
            <div className="bg-indigo-50 p-4 rounded-lg text-sm text-indigo-800 leading-relaxed mb-4">
                {type === ShiftRequestType.LEAVE && "اینجانب متقاضی استفاده از مرخصی روزانه در تاریخ‌های ذیل می‌باشم. خواهشمند است موافقت فرمایید."}
                {type === ShiftRequestType.EXCHANGE && "اینجانب متقاضی تعویض شیفت خود با همکار محترم ذکر شده در تاریخ‌های ذیل می‌باشم."}
                {type === ShiftRequestType.INVITATION && "گزارش حضور خارج از شیفت (دعوت به کار) جهت تایید مسئول مربوطه."}
            </div>

            <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700">تعیین تاریخ(ها)</label>
                {dates.map((d, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <JalaliDatePicker 
                            value={d} 
                            onChange={val => updateDate(i, val)} 
                            fullWidth 
                            placeholder="انتخاب تاریخ..." 
                        />
                        {i === dates.length - 1 ? (
                            <Button type="button" variant="secondary" size="sm" onClick={addDate} className="h-10 w-10 flex-shrink-0">+</Button>
                        ) : (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeDate(i)} className="h-10 w-10 text-red-500 flex-shrink-0">×</Button>
                        )}
                    </div>
                ))}
            </div>

            {type === ShiftRequestType.EXCHANGE && (
                <Select 
                    label="همکار تامین کننده شیفت *"
                    options={[{value: '', label: 'انتخاب همکار...'}, ...users.filter(u => u.id !== user?.id).map(u => ({value: u.id, label: u.full_name || u.username}))]}
                    value={providerId}
                    onChange={e => setProviderId(e.target.value)}
                />
            )}

            <Select 
                label="سرکشیک / کارشناس مسئول تایید کننده *"
                options={[{value: '', label: 'انتخاب مسئول...'}, ...users.map(u => ({value: u.id, label: u.full_name || u.username}))]}
                value={supervisorId}
                onChange={e => setSupervisorId(e.target.value)}
            />

            <TextArea label="توضیحات تکمیلی" value={description} onChange={e => setDescription(e.target.value)} rows={3} />

            <div className="bg-gray-50 p-3 rounded border">
                <label className="block text-xs font-bold text-gray-700 mb-2">
                    ارسال اعلان برای {targetLabel}:
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifySms} onChange={e => setNotifySms(e.target.checked)} className="ml-2 h-4 w-4 text-indigo-600 rounded" />
                        <span className="text-xs text-gray-600">پیامک (SMS)</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifyTg} onChange={e => setNotifyTg(e.target.checked)} className="ml-2 h-4 w-4 text-blue-600 rounded" />
                        <span className="text-xs text-gray-600">تلگرام</span>
                    </label>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t gap-2">
                <Button variant="secondary" onClick={onClose}>انصراف</Button>
                <Button type="submit" variant="primary" loading={submitting}>ثبت و ارسال درخواست</Button>
            </div>
        </form>
    );
};
