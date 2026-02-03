import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { PhoneLine, PhoneLineLog } from '../../types';
import { getLogsByPhoneLineId } from '../../supabaseService';
import { InfoIcon } from '../ui/Icons';

interface PhoneLineLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    phoneLine: PhoneLine;
}

export const PhoneLineLogModal: React.FC<PhoneLineLogModalProps> = ({ isOpen, onClose, phoneLine }) => {
    const [logs, setLogs] = useState<PhoneLineLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        if (!phoneLine) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await getLogsByPhoneLineId(phoneLine.id);
            setLogs(data);
        } catch (err: any) {
            setError(`خطا در بارگذاری تاریخچه: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [phoneLine]);

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
        }
    }, [isOpen, fetchLogs]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-48"><Spinner /></div>;
        }

        if (error) {
            return <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>;
        }

        if (logs.length === 0) {
            return (
                <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <InfoIcon className="fa-lg ml-3 text-blue-500" />
                    <span>هیچ تاریخچه‌ای برای این خط ثبت نشده است.</span>
                </div>
            );
        }

        return (
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                <ul className="space-y-3">
                    {logs.map(log => (
                        <li key={log.id} className="p-3 bg-gray-50 border rounded-md hover:bg-gray-100 transition-colors">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{log.user_id}</span>
                                <span className="text-xs text-gray-500">{new Date(log.changed_at).toLocaleString('fa-IR')}</span>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed">{log.change_description}</p>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`تاریخچه خط شماره ${phoneLine.phone_number}`}
        >
           {renderContent()}
        </Modal>
    );
};