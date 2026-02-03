
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { pullAllData } from '../../services/offlineSync';
import { TABLE_NAMES_FA } from '../../constants';
import { CheckIcon, CloseIcon } from '../ui/Icons';

interface ManualSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SyncDetail {
    tableName: string;
    displayName: string;
    count: number;
    success: boolean;
}

export const ManualSyncModal: React.FC<ManualSyncModalProps> = ({ isOpen, onClose }) => {
    const [progress, setProgress] = useState(0);
    const [currentTable, setCurrentTable] = useState('');
    const [details, setDetails] = useState<SyncDetail[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setProgress(0);
            setDetails([]);
            setIsSyncing(false);
            setIsComplete(false);
            setError(null);
            setCurrentTable('');
        }
    }, [isOpen]);

    const startSync = async () => {
        setIsSyncing(true);
        setError(null);
        setDetails([]);
        setProgress(0);

        try {
            await pullAllData((prog, table, count, success) => {
                setProgress(prog);
                setCurrentTable(table);
                setDetails(prev => [
                    ...prev, 
                    { 
                        tableName: table, 
                        displayName: TABLE_NAMES_FA[table] || table, 
                        count: count,
                        success: success
                    }
                ]);
            });
            setIsComplete(true);
        } catch (e: any) {
            console.error("Sync error:", e);
            setError("خطا در دریافت اطلاعات: " + (e.message || 'ناشناخته'));
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={!isSyncing ? onClose : () => {}} title="دریافت دیتابیس آفلاین">
            <div className="p-4 space-y-6">
                {!isSyncing && !isComplete && !error && (
                    <div className="text-center space-y-4">
                        <div className="bg-blue-50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-blue-600 mb-4">
                            <i className="fas fa-cloud-download-alt fa-3x"></i>
                        </div>
                        <p className="text-gray-700">
                            با زدن دکمه زیر، تمام اطلاعات سرور دانلود شده و در حافظه دستگاه ذخیره می‌شود. 
                            این کار باعث می‌شود در حالت آفلاین به تمام اطلاعات دسترسی داشته باشید.
                        </p>
                        <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                            <i className="fas fa-exclamation-triangle ml-1"></i>
                            لطفاً تا پایان عملیات برنامه را نبندید.
                        </p>
                        <Button variant="primary" onClick={startSync} className="w-full py-3 text-lg">
                            شروع دریافت اطلاعات
                        </Button>
                    </div>
                )}

                {(isSyncing || isComplete || error) && (
                    <div className="space-y-4">
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden" dir="ltr">
                            <div 
                                className={`h-full transition-all duration-300 ease-out flex items-center justify-center text-[10px] text-white ${isComplete ? 'bg-green-500' : 'bg-indigo-600'}`}
                                style={{ width: `${progress}%` }}
                            >
                                {progress}%
                            </div>
                        </div>
                        
                        {isSyncing && (
                            <p className="text-center text-sm text-indigo-700 animate-pulse font-medium">
                                در حال بررسی جدول: {TABLE_NAMES_FA[currentTable] || currentTable}...
                            </p>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Details List */}
                        <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto custom-scrollbar bg-gray-50">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">نام بخش</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">تعداد رکورد</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">وضعیت</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {details.map((d, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-2 text-sm text-gray-700">{d.displayName}</td>
                                            <td className="px-4 py-2 text-sm text-center font-mono">{d.count}</td>
                                            <td className="px-4 py-2 text-center">
                                                {d.success ? (
                                                    <i className="fas fa-check text-green-500"></i>
                                                ) : (
                                                    <i className="fas fa-times text-red-500"></i>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {isComplete && (
                            <div className="mt-4 animate-fade-in text-center">
                                <div className="text-green-600 font-bold text-lg mb-4 flex items-center justify-center">
                                    <CheckIcon className="ml-2 fa-2x" />
                                    عملیات پایان یافت
                                </div>
                                <Button variant="secondary" onClick={onClose} fullWidth>بستن</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
