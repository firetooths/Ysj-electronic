
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { CNSEquipment, CNSFaultReport } from '../../types';
import { getFaultsByEquipmentId } from '../../services/cnsService';
import { Spinner } from '../ui/Spinner';
import { InfoIcon } from '../ui/Icons';

interface EquipmentFaultHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    equipment: CNSEquipment;
}

export const EquipmentFaultHistoryModal: React.FC<EquipmentFaultHistoryModalProps> = ({ isOpen, onClose, equipment }) => {
    const navigate = useNavigate();
    const [history, setHistory] = useState<CNSFaultReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && equipment) {
            loadHistory();
        }
    }, [isOpen, equipment]);

    const loadHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getFaultsByEquipmentId(equipment.id);
            setHistory(data);
        } catch (err: any) {
            setError(`خطا در بارگذاری تاریخچه: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (s: string) => {
        if (s === 'بسته شده') return 'bg-green-100 text-green-800';
        if (s === 'در حال رفع') return 'bg-blue-100 text-blue-800';
        return 'bg-gray-100 text-gray-800';
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-48"><Spinner className="w-10 h-10" /></div>;
        }

        if (error) {
            return <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>;
        }

        if (history.length === 0) {
            return (
                <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <InfoIcon className="fa-lg ml-3 text-blue-500" />
                    <span>هیچ سابقه خرابی برای این دستگاه ثبت نشده است.</span>
                </div>
            );
        }

        return (
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاریخ ثبت</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع خرابی</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">اولویت</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">وضعیت</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">توضیحات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {history.map((fault) => (
                            <tr 
                                key={fault.id} 
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => navigate(`/cns/faults/${fault.id}`)}
                            >
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {new Date(fault.start_time).toLocaleDateString('fa-IR')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {fault.fault_type}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {fault.priority_level}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                     <span className={`px-2 py-1 rounded text-xs ${getStatusColor(fault.status)}`}>
                                          {fault.status}
                                      </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={fault.description}>
                                    {fault.description}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`تاریخچه خرابی‌های: ${equipment.name_cns}`}
            className="sm:max-w-4xl"
        >
            <div className="p-4">
                {renderContent()}
            </div>
        </Modal>
    );
};
