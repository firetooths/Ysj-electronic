
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCNSFaultReports, deleteCNSFaultReport } from '../../services/cnsService';
import { CNSFaultReport, CNSFaultStatus } from '../../types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon } from '../ui/Icons';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../AuthContext';

export const FaultList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [faults, setFaults] = useState<CNSFaultReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState<CNSFaultStatus | 'ALL'>(() => {
      const status = searchParams.get('status');
      if (status === 'closed') return CNSFaultStatus.CLOSED;
      if (status === 'active') return CNSFaultStatus.REPORTED; 
      return 'ALL';
  });
  
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Delete State
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [faultToDelete, setFaultToDelete] = useState<CNSFaultReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = user?.role?.name === 'Admin';

  useEffect(() => {
      loadData();
  }, [statusFilter, searchTerm]);

  const loadData = async () => {
      setIsLoading(true);
      try {
          const data = await getCNSFaultReports(statusFilter, searchTerm);
          setFaults(data);
          setCurrentPage(1); // Reset pagination on filter change
      } catch (err) {
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent, fault: CNSFaultReport) => {
      e.stopPropagation();
      setFaultToDelete(fault);
      setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
      if (!faultToDelete) return;
      setIsDeleting(true);
      try {
          await deleteCNSFaultReport(faultToDelete.id);
          loadData();
          setConfirmDeleteOpen(false);
          setFaultToDelete(null);
      } catch (err: any) {
          alert(`خطا در حذف گزارش خرابی: ${err.message}`);
      } finally {
          setIsDeleting(false);
      }
  };
  
  const getPriorityColor = (p: string) => {
      switch(p) {
          case 'حیاتی': return 'bg-red-200 text-red-800';
          case 'بالا': return 'bg-orange-200 text-orange-800';
          case 'متوسط': return 'bg-yellow-200 text-yellow-800';
          default: return 'bg-gray-200 text-gray-800';
      }
  };

  const getStatusColor = (s: string) => {
      if (s === 'بسته شده') return 'bg-green-100 text-green-800';
      if (s === 'در حال رفع') return 'bg-blue-100 text-blue-800';
      return 'bg-gray-100 text-gray-800';
  };

  // Client-side pagination logic
  const totalItems = faults.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFaults = faults.slice(startIndex, startIndex + itemsPerPage);

  return (
      <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-900">لیست گزارشات خرابی CNS</h2>
              <Button variant="primary" onClick={() => navigate('/cns/new-fault')}>
                  <AddIcon className="ml-2" /> ثبت گزارش جدید
              </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Input 
                  placeholder="جستجو در نام تجهیز، نوع خرابی..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
              />
              <Select 
                  options={[
                      {value: 'ALL', label: 'همه وضعیت‌ها'},
                      {value: CNSFaultStatus.REPORTED, label: 'فعال (ثبت شده/در حال رفع)'},
                      {value: CNSFaultStatus.CLOSED, label: 'بسته شده'},
                  ]}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
              />
          </div>

          {isLoading ? <div className="flex justify-center p-10"><Spinner /></div> : (
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 table-fixed">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[30%]">تجهیز</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[25%]">نوع خرابی</th>
                              <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[15%]">گزارش دهنده</th>
                              <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[10%]">اولویت</th>
                              <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[10%]">وضعیت</th>
                              <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[10%]">زمان</th>
                              {isAdmin && <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-[10%]">عملیات</th>}
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedFaults.map(fault => (
                              <tr key={fault.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/cns/faults/${fault.id}`)}>
                                  <td className="px-4 py-3">
                                      <div className="text-xs font-bold text-gray-900 whitespace-normal leading-snug line-clamp-2" title={fault.equipment?.name_cns}>
                                          {fault.equipment?.name_cns}
                                      </div>
                                  </td>
                                  <td className="px-4 py-3">
                                      <div className="text-xs text-gray-700 whitespace-normal leading-snug line-clamp-2" title={fault.fault_type}>
                                          {fault.fault_type}
                                      </div>
                                  </td>
                                  <td className="px-2 py-3 whitespace-nowrap text-[10px] text-gray-600 truncate">{fault.reporter_user || '---'}</td>
                                  <td className="px-2 py-3 whitespace-nowrap">
                                      <span className={`px-2 py-1 rounded text-[10px] ${getPriorityColor(fault.priority_level)}`}>
                                          {fault.priority_level}
                                      </span>
                                  </td>
                                  <td className="px-2 py-3 whitespace-nowrap">
                                      <span className={`px-2 py-1 rounded text-[10px] ${getStatusColor(fault.status)}`}>
                                          {fault.status}
                                      </span>
                                  </td>
                                  <td className="px-2 py-3 whitespace-nowrap text-gray-500 text-[10px]">
                                      {new Date(fault.start_time).toLocaleDateString('fa-IR')}
                                  </td>
                                  {isAdmin && (
                                      <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                          <Button variant="danger" size="sm" onClick={(e) => handleDeleteClick(e, fault)} title="حذف" className="px-2 h-7">
                                              <DeleteIcon className="w-3 h-3" />
                                          </Button>
                                      </td>
                                  )}
                              </tr>
                          ))}
                          {faults.length === 0 && (
                              <tr><td colSpan={isAdmin ? 7 : 6} className="text-center p-4 text-gray-500">موردی یافت نشد.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}

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

          <ConfirmDialog
                isOpen={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="حذف گزارش خرابی"
                message={`آیا از حذف این گزارش خرابی برای "${faultToDelete?.equipment?.name_cns}" اطمینان دارید؟ تمامی سوابق و لاگ‌های اقدام مربوط به آن نیز حذف خواهند شد.`}
                confirmText="حذف"
                isConfirming={isDeleting}
            />
      </div>
  );
};
