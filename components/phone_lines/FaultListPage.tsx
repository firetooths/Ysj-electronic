
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PhoneLineFault, FaultStatus } from '../../types';
import { getAllFaults, deleteFault } from '../../supabaseService';
import { useSupabaseContext } from '../../SupabaseContext';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { AddIcon, CheckIcon, WrenchIcon, DeleteIcon } from '../ui/Icons';
import { FaultReportModal } from './FaultReportModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FaultDetailsAndNotesModal } from './FaultDetailsAndNotesModal';
import { ResolveFaultModal } from './ResolveFaultModal';
import { useAuth } from '../../AuthContext';

export const FaultListPage: React.FC = () => {
    const { isLoading: isContextLoading } = useSupabaseContext();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [faults, setFaults] = useState<PhoneLineFault[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isFaultModalOpen, setIsFaultModalOpen] = useState(false);
    
    // Resolve State
    const [faultToResolve, setFaultToResolve] = useState<PhoneLineFault | null>(null);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedFault, setSelectedFault] = useState<PhoneLineFault | null>(null);

    // Delete State
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [faultToDelete, setFaultToDelete] = useState<PhoneLineFault | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const isAdmin = user?.role?.name === 'Admin';

    // Check for URL action to open modal automatically
    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setIsFaultModalOpen(true);
            // Remove the param so it doesn't reopen on refresh (optional, but good UX)
            setSearchParams(params => {
                params.delete('action');
                return params;
            });
        }
    }, [searchParams, setSearchParams]);

    const fetchFaults = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAllFaults();
            setFaults(data);
            setCurrentPage(1); // Reset to first page on new data
        } catch (err: any) {
            setError(`خطا در بارگذاری لیست خرابی‌ها: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isContextLoading) {
            fetchFaults();
        }
    }, [isContextLoading, fetchFaults]);

    const handleResolveClick = (e: React.MouseEvent, fault: PhoneLineFault) => {
        e.stopPropagation();
        setFaultToResolve(fault);
        setIsResolveModalOpen(true);
    };
    
    const handleDetailsClick = (fault: PhoneLineFault) => {
        setSelectedFault(fault);
        setIsDetailsModalOpen(true);
    };

    const handleDeleteClick = (e: React.MouseEvent, fault: PhoneLineFault) => {
        e.stopPropagation();
        setFaultToDelete(fault);
        setConfirmDeleteOpen(true);
    };

    const handleResolveSuccess = () => {
        setIsResolveModalOpen(false);
        setFaultToResolve(null);
        fetchFaults();
    };

    const handleConfirmDelete = async () => {
        if (!faultToDelete) return;
        setIsDeleting(true);
        try {
            await deleteFault(faultToDelete.id);
            fetchFaults();
            setConfirmDeleteOpen(false);
            setFaultToDelete(null);
        } catch (err: any) {
            alert(`خطا در حذف خرابی: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };
    
    const getStatusChip = (status: FaultStatus) => {
        const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full";
        if (status === FaultStatus.REPORTED) {
            return `${baseClasses} bg-red-100 text-red-800`;
        }
        return `${baseClasses} bg-green-100 text-green-800`;
    };

    // Client-side pagination logic
    const totalItems = faults.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedFaults = faults.slice(startIndex, startIndex + itemsPerPage);

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">لیست اعلام خرابی‌ها</h2>
                <Button variant="primary" onClick={() => setIsFaultModalOpen(true)}>
                    <AddIcon className="ml-2" /> ثبت خرابی جدید
                </Button>
            </div>
            
            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

            <div className="overflow-x-auto custom-scrollbar rounded-lg shadow-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">وضعیت</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره تلفن</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نوع خرابی</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاریخ گزارش</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">توضیحات</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">گزارش صوتی</th>
                             <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {faults.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                    <WrenchIcon className="mx-auto text-4xl text-gray-400 mb-4" />
                                    هیچ خرابی ثبت نشده است.
                                </td>
                            </tr>
                        ) : (
                            paginatedFaults.map(fault => {
                                const voiceNoteCount = fault.phone_line_fault_voice_notes[0]?.count || 0;
                                return (
                                    <tr key={fault.id} className="hover:bg-gray-100 cursor-pointer" onClick={() => handleDetailsClick(fault)}>
                                        <td className="px-6 py-4"><span className={getStatusChip(fault.status)}>{fault.status}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{fault.phone_line?.phone_number}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{fault.fault_type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(fault.reported_at).toLocaleDateString('fa-IR')}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={fault.description || ''}>{fault.description || '---'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex items-center justify-center text-gray-600">
                                                <i className="fas fa-microphone ml-2"></i> ({voiceNoteCount})
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center space-x-1 space-x-reverse">
                                                {fault.status === FaultStatus.REPORTED && (
                                                    <Button size="sm" variant="secondary" onClick={(e) => handleResolveClick(e, fault)}>
                                                    <CheckIcon className="ml-2 text-green-600"/> رفع شد
                                                    </Button>
                                                )}
                                                {isAdmin && (
                                                    <Button size="sm" variant="danger" onClick={(e) => handleDeleteClick(e, fault)} title="حذف">
                                                        <DeleteIcon className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center mb-2 sm:mb-0">
                        <span className="text-sm text-gray-600 ml-2">تعداد در صفحه:</span>
                        <select 
                            className="border border-gray-300 rounded-md text-sm p-1"
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                            disabled={currentPage === 1}
                        >
                            قبلی
                        </Button>
                        <span className="text-sm text-gray-700">
                            صفحه {currentPage} از {totalPages || 1} (کل: {totalItems})
                        </span>
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                            disabled={currentPage === totalPages}
                        >
                            بعدی
                        </Button>
                    </div>
                </div>
            )}

            <FaultReportModal 
                isOpen={isFaultModalOpen}
                onClose={() => setIsFaultModalOpen(false)}
                phoneLine={null}
                onSuccess={() => {
                    setIsFaultModalOpen(false);
                    fetchFaults();
                }}
            />

            {selectedFault && (
                <FaultDetailsAndNotesModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    faultId={selectedFault.id}
                    onUpdate={fetchFaults}
                />
            )}

            {faultToResolve && (
                <ResolveFaultModal
                    isOpen={isResolveModalOpen}
                    onClose={() => setIsResolveModalOpen(false)}
                    fault={faultToResolve}
                    onSuccess={handleResolveSuccess}
                />
            )}

            <ConfirmDialog 
                isOpen={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                title="حذف گزارش خرابی"
                message={`آیا از حذف این گزارش خرابی برای خط "${faultToDelete?.phone_line?.phone_number}" اطمینان دارید؟ تمامی گزارش‌های صوتی مرتبط نیز حذف خواهند شد.`}
                confirmText="حذف"
                isConfirming={isDeleting}
            />
        </div>
    );
};
