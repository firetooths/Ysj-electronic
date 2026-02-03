
import React, { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { MaintenanceSchedule, CNSMaintenanceLog } from '../../../types';
import { getMaintenanceLogs } from '../../../services/cnsMaintenanceService';
import { Spinner } from '../../ui/Spinner';
import { InfoIcon } from '../../ui/Icons';

interface MaintenanceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: MaintenanceSchedule;
}

export const MaintenanceHistoryModal: React.FC<MaintenanceHistoryModalProps> = ({ isOpen, onClose, schedule }) => {
    const [logs, setLogs] = useState<CNSMaintenanceLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            getMaintenanceLogs(schedule.id)
                .then(setLogs)
                .catch(console.error)
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, schedule]);

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>;
        
        if (logs.length === 0) {
            return (
                <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <InfoIcon className="fa-lg ml-3 text-blue-500" />
                    <span>هیچ سابقه‌ای برای این فعالیت ثبت نشده است.</span>
                </div>
            );
        }

        return (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                {logs.map(log => (
                    <div key={log.id} className="bg-gray-50 p-4 rounded-lg border shadow-sm">
                        <div className="flex justify-between text-sm mb-2 text-gray-500">
                            <span>تاریخ: {new Date(log.performed_at).toLocaleString('fa-IR')}</span>
                            <span className="font-bold text-gray-800">توسط: {log.performer}</span>
                        </div>
                        <div className="bg-white p-3 rounded border text-gray-700 text-sm mb-3">
                            {log.notes || 'بدون توضیحات'}
                        </div>
                        <div className="flex gap-4">
                            {log.audio_url && (
                                <audio controls src={log.audio_url} className="h-8 w-48" />
                            )}
                            {log.image_url && (
                                <a href={log.image_url} target="_blank" rel="noreferrer" className="block h-16 w-16 border rounded overflow-hidden">
                                    <img src={log.image_url} className="w-full h-full object-cover" alt="proof" />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`سوابق: ${schedule.title}`} className="sm:max-w-2xl">
            <div className="p-4">
                {renderContent()}
            </div>
        </Modal>
    );
};
