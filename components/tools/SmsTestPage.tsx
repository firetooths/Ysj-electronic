
import React, { useState, useEffect } from 'react';
import { sendSms } from '../../services/smsService';
import { getSmsLogs } from '../../supabaseService';
import { getUsers } from '../../services/authService';
import { User } from '../../types';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { useAuth } from '../../AuthContext';

export const SmsTestPage: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'send' | 'logs'>('send');
    
    // Send Tab State
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [manualNumbers, setManualNumbers] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{type: 'success'|'error', msg: string} | null>(null);

    // Logs Tab State
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await getUsers();
                setUsers(data);
            } catch (e) { console.error("Failed to load users", e); }
        };
        loadUsers();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') {
            loadLogs();
        }
    }, [activeTab]);

    const loadLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const data = await getSmsLogs();
            setLogs(data);
        } catch (e) { console.error("Failed to load logs", e); }
        finally { setIsLoadingLogs(false); }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setSendResult(null);
        
        // Collect recipients
        let recipients: string[] = [];
        
        // From selected users
        selectedUserIds.forEach(uid => {
            const u = users.find(user => user.id === uid);
            if (u && u.phone_number) {
                recipients.push(u.phone_number);
            }
        });

        // From manual input
        if (manualNumbers) {
            const manuals = manualNumbers.split(',').map(n => n.trim()).filter(Boolean);
            recipients = [...recipients, ...manuals];
        }

        // Deduplicate
        recipients = [...new Set(recipients)];

        if (recipients.length === 0) {
            alert('هیچ گیرنده‌ای انتخاب نشده است.');
            return;
        }
        if (!message.trim()) {
            alert('متن پیام خالی است.');
            return;
        }

        setIsSending(true);
        try {
            const senderName = user?.full_name || user?.username || 'System';
            const response = await sendSms(recipients, message, senderName);
            
            if (response.meta.status) {
                setSendResult({ type: 'success', msg: `پیامک با موفقیت برای ${recipients.length} نفر ارسال شد.` });
                setMessage('');
                setSelectedUserIds([]);
                setManualNumbers('');
            } else {
                setSendResult({ type: 'error', msg: `خطا در پنل: ${response.meta.message}` });
            }
        } catch (error: any) {
            setSendResult({ type: 'error', msg: `خطا: ${error.message}` });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="container mx-auto p-4 md:p-6 max-w-5xl">
                
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <button
                            className={`flex-1 py-3 text-center font-medium transition-colors ${activeTab === 'send' ? 'bg-white text-indigo-600 border-t-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => setActiveTab('send')}
                        >
                            <i className="fas fa-paper-plane ml-2"></i> ارسال پیامک آزاد
                        </button>
                        <button
                            className={`flex-1 py-3 text-center font-medium transition-colors ${activeTab === 'logs' ? 'bg-white text-indigo-600 border-t-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => setActiveTab('logs')}
                        >
                            <i className="fas fa-history ml-2"></i> آرشیو پیامک‌ها
                        </button>
                    </div>

                    {activeTab === 'send' && (
                        <div className="p-6">
                             <div className="mb-6 bg-blue-50 text-blue-800 p-4 rounded border border-blue-200">
                                <p className="text-sm">در این بخش می‌توانید پیامک دلخواه خود را برای کاربران سیستم یا شماره‌های دستی ارسال کنید.</p>
                             </div>

                             <form onSubmit={handleSend} className="space-y-6">
                                <div>
                                    <MultiSelectDropdown
                                        label="انتخاب گیرندگان از لیست کاربران"
                                        options={users.map(u => ({ value: u.id, label: `${u.full_name || u.username} (${u.phone_number || 'بدون شماره'})` }))}
                                        selectedValues={selectedUserIds}
                                        onChange={setSelectedUserIds}
                                    />
                                </div>
                                
                                <Input
                                    label="شماره‌های دستی (جدا شده با کاما)"
                                    placeholder="مثال: 0912xxxxxxx, 0935xxxxxxx"
                                    value={manualNumbers}
                                    onChange={e => setManualNumbers(e.target.value)}
                                    dir="ltr"
                                />

                                <TextArea
                                    label="متن پیام"
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    rows={4}
                                    required
                                    placeholder="متن پیامک را اینجا بنویسید..."
                                />

                                {sendResult && (
                                    <div className={`p-3 rounded text-sm ${sendResult.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {sendResult.msg}
                                    </div>
                                )}

                                <div className="pt-4">
                                    <Button type="submit" variant="primary" fullWidth loading={isSending} disabled={isSending}>
                                        <i className="fas fa-paper-plane ml-2"></i> ارسال پیامک
                                    </Button>
                                </div>
                             </form>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="p-6">
                             <div className="flex justify-between items-center mb-4">
                                 <h3 className="text-lg font-bold text-gray-800">لیست پیامک‌های ارسالی</h3>
                                 <Button size="sm" variant="secondary" onClick={loadLogs}><i className="fas fa-sync ml-1"></i> بروزرسانی</Button>
                             </div>
                             
                             {isLoadingLogs ? <div className="flex justify-center p-8"><Spinner /></div> : (
                                 <div className="overflow-x-auto">
                                     <table className="min-w-full divide-y divide-gray-200 border">
                                         <thead className="bg-gray-50">
                                             <tr>
                                                 <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">زمان ارسال</th>
                                                 <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">فرستنده</th>
                                                 <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">متن پیام</th>
                                                 <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">گیرندگان</th>
                                                 <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">وضعیت</th>
                                             </tr>
                                         </thead>
                                         <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                             {logs.length === 0 ? (
                                                 <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">هنوز پیامکی ارسال نشده است.</td></tr>
                                             ) : (
                                                 logs.map(log => (
                                                     <tr key={log.id} className="hover:bg-gray-50">
                                                         <td className="px-4 py-3 whitespace-nowrap text-gray-600 align-top">{new Date(log.sent_at).toLocaleString('fa-IR')}</td>
                                                         <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-700 align-top">{log.sender_user || 'System'}</td>
                                                         <td className="px-4 py-3 text-gray-800 max-w-xs truncate align-top" title={log.message}>{log.message}</td>
                                                         <td className="px-4 py-3 text-gray-600 text-xs align-top" style={{ minWidth: '200px' }}>
                                                             <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar content-start">
                                                                {log.recipients && log.recipients.length > 0 ? log.recipients.map((r: string, idx: number) => (
                                                                    <span key={idx} className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 select-all" dir="ltr">{r}</span>
                                                                )) : <span className="text-gray-400">بدون گیرنده</span>}
                                                             </div>
                                                         </td>
                                                         <td className="px-4 py-3 whitespace-nowrap text-center align-top">
                                                             {log.status === 'SUCCESS' ? (
                                                                 <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">موفق</span>
                                                             ) : (
                                                                 <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs cursor-help" title={log.error_message}>ناموفق</span>
                                                             )}
                                                         </td>
                                                     </tr>
                                                 ))
                                             )}
                                         </tbody>
                                     </table>
                                 </div>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
