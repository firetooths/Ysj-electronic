import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneLine } from '../../types';
import { getPhoneLines, deletePhoneLine } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, DetailsIcon, WrenchIcon, LogIcon, ExportIcon, CopyIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useSupabaseContext } from '../../SupabaseContext';
import { PhoneLineLogModal } from './PhoneLineLogModal';
import { FaultReportModal } from './FaultReportModal';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { Tag } from '../ui/Tag';
import { exportPhoneLinesToExcel } from '../../utils/fileExporter';

const ITEMS_PER_PAGE = 15;

// Debounce hook
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export const PhoneLineList: React.FC = () => {
  const navigate = useNavigate();
  const { tags, isLoading: isContextLoading } = useSupabaseContext();

  const [lines, setLines] = useState<PhoneLine[]>([]);
  const [totalLines, setTotalLines] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<PhoneLine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isFaultModalOpen, setIsFaultModalOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<PhoneLine | null>(null);

  const [isExporting, setIsExporting] = useState(false);


  const fetchLines = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (debouncedSearchTerm.length > 0 && debouncedSearchTerm.length < 3) {
        setLines([]);
        setTotalLines(0);
        // Do not set loading to false here to avoid flash of "no results"
        return;
      }
      const { lines: fetchedLines, total } = await getPhoneLines(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm, selectedTagIds);
      setLines(fetchedLines);
      setTotalLines(total);
    } catch (err: any) {
      setError(`خطا در بارگذاری خطوط تلفن: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, selectedTagIds]);

  useEffect(() => {
    if (!isContextLoading) {
      fetchLines();
    }
  }, [fetchLines, isContextLoading]);
  
  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedTagIds]);


  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleDeleteClick = (line: PhoneLine) => {
    setLineToDelete(line);
    setConfirmDeleteOpen(true);
  };

  const handleOpenLogModal = (line: PhoneLine) => {
    setSelectedLine(line);
    setIsLogModalOpen(true);
  };
  
  const handleOpenFaultModal = (line: PhoneLine) => {
    setSelectedLine(line);
    setIsFaultModalOpen(true);
  };
  
  
  const handleConfirmDelete = async () => {
    if (!lineToDelete) return;
    setIsDeleting(true);
    try {
        await deletePhoneLine(lineToDelete.id);
        alert('خط تلفن با موفقیت حذف شد.');
        fetchLines(); // Refresh list
        setConfirmDeleteOpen(false);
    } catch(err: any) {
        alert(`خطا در حذف خط: ${err.message}`);
    } finally {
        setIsDeleting(false);
        setLineToDelete(null);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { lines: allFilteredLines } = await getPhoneLines(
        1,
        totalLines > 0 ? totalLines : 99999, // Fetch all matching lines
        debouncedSearchTerm,
        selectedTagIds
      );
      if (allFilteredLines.length === 0) {
        alert('هیچ خطی برای خروجی گرفتن یافت نشد.');
        return;
      }
      const fileName = `خروجی_خطوط_تلفن_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}`;
      exportPhoneLinesToExcel(allFilteredLines, fileName);
    } catch (err: any) {
      alert(`خطا در ایجاد خروجی: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.ceil(totalLines / ITEMS_PER_PAGE);

  if (isContextLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4 bg-red-100 rounded-lg">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">جستجو و مدیریت خطوط تلفن</h2>

      {/* Search & Filter Section */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
            id="search-phone-list"
            type="text"
            placeholder="جستجوی شماره یا واحد (حداقل ۳ حرف)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
        <MultiSelectDropdown
            label="فیلتر بر اساس تگ"
            options={tags.map(t => ({ value: t.id, label: t.name }))}
            selectedValues={selectedTagIds}
            onChange={setSelectedTagIds}
        />
      </div>


      {/* Line List Section */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800">لیست خطوط</h3>
        <div className="flex space-x-2 space-x-reverse">
            <Button variant="secondary" onClick={handleExport} loading={isExporting} disabled={isExporting}>
                <ExportIcon className="ml-2" /> خروجی Excel
            </Button>
            <Button variant="primary" onClick={() => navigate('/phone-lines/new')}>
              <AddIcon className="ml-2" /> افزودن خط جدید
            </Button>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar rounded-lg shadow-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره تلفن</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مصرف کننده/واحد</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تگ‌ها</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">عملیات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
                <tr><td colSpan={4} className="text-center py-10"><Spinner/></td></tr>
            ) : lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    {debouncedSearchTerm.length > 0 && debouncedSearchTerm.length < 3 
                        ? "برای جستجو حداقل ۳ حرف وارد کنید."
                        : "هیچ خط تلفنی با معیارهای فعلی یافت نشد."
                    }
                </td>
              </tr>
            ) : (
              lines.map(line => (
                <tr key={line.id} className={line.has_active_fault ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium font-mono ${line.has_active_fault ? 'text-red-700 font-bold' : 'text-gray-900'}`}>{line.phone_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{line.consumer_unit || '---'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                        {line.tags?.map(tag => (
                            <Tag key={tag.id} name={tag.name} color={tag.color} />
                        ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center space-x-1 space-x-reverse">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenLogModal(line)} title="تاریخچه"><LogIcon /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenFaultModal(line)} title="اعلام خرابی"><WrenchIcon className="text-yellow-600"/></Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/phone-lines/view/${line.phone_number}`)} title="مشاهده مسیر"><DetailsIcon /></Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/phone-lines/edit/${line.id}`)} title="ویرایش"><EditIcon /></Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/phone-lines/new?copyFrom=${line.id}`)} title="کپی مسیر"><CopyIcon /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(line)} title="حذف"><DeleteIcon className="text-red-600" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 space-x-reverse mt-8">
          <Button
            variant="secondary"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            size="sm"
          >
            قبلی
          </Button>
          <span className="text-gray-700 font-medium">
            صفحه {currentPage} از {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            size="sm"
          >
            بعدی
          </Button>
        </div>
      )}
      
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="حذف خط تلفن"
        message={`آیا از حذف خط شماره ${lineToDelete?.phone_number} مطمئن هستید؟ این عمل تمام مسیر ثبت شده برای آن را نیز حذف می‌کند.`}
        confirmText="حذف"
        isConfirming={isDeleting}
      />

      {selectedLine && (
        <>
          <PhoneLineLogModal
            isOpen={isLogModalOpen}
            onClose={() => setIsLogModalOpen(false)}
            phoneLine={selectedLine}
          />
          <FaultReportModal
            isOpen={isFaultModalOpen}
            onClose={() => setIsFaultModalOpen(false)}
            phoneLine={selectedLine}
            onSuccess={() => {
              setIsFaultModalOpen(false);
              fetchLines(); // Refresh list to show fault status
            }}
          />
        </>
      )}

    </div>
  );
};