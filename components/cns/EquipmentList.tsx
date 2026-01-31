
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { CNSEquipment } from '../../types';
import { getCNSEquipments, deleteCNSEquipment } from '../../services/cnsService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AddIcon, EditIcon, DeleteIcon, LogIcon, CopyIcon, ExportIcon, BulkImportIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EquipmentFaultHistoryModal } from './EquipmentFaultHistoryModal';

export const EquipmentList: React.FC = () => {
  const navigate = useNavigate();
  const [equipments, setEquipments] = useState<CNSEquipment[]>([]);
  const [filteredEquipments, setFilteredEquipments] = useState<CNSEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const [historyEquipment, setHistoryEquipment] = useState<CNSEquipment | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setFilteredEquipments(
        equipments.filter(e => 
            e.name_cns.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (e.asset_number && e.asset_number.includes(searchTerm))
        )
    );
  }, [searchTerm, equipments]);

  const loadData = async () => {
    setIsLoading(true);
    try {
        const data = await getCNSEquipments();
        setEquipments(data);
        setFilteredEquipments(data);
    } catch (err) {
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async () => {
      if (!deleteId) return;
      try {
          await deleteCNSEquipment(deleteId);
          loadData();
          setDeleteId(null);
      } catch (err) {
          alert('خطا در حذف تجهیز');
      }
  };

  const handleExport = () => {
      setIsExporting(true);
      try {
          const dataToExport = filteredEquipments.map(eq => ({
              'نام دستگاه': eq.name_cns,
              'شماره اموال': eq.asset_number,
              'حوزه عملیاتی': eq.operational_area,
              'شماره سریال': eq.serial_number,
              'سازنده': eq.manufacturer,
              'محل قرارگیری': eq.location,
              'تاریخ ثبت': new Date(eq.created_at).toLocaleDateString('fa-IR')
          }));

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(dataToExport);
          XLSX.utils.book_append_sheet(wb, ws, "CNS_Equipment");
          XLSX.writeFile(wb, `CNS_Equipment_List_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xlsx`);
      } catch (e) {
          console.error(e);
          alert('خطا در ایجاد خروجی اکسل');
      } finally {
          setIsExporting(false);
      }
  };

  if (isLoading) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
          <h2 className="text-2xl font-bold text-gray-900">مدیریت تجهیزات CNS</h2>
          <div className="flex space-x-2 space-x-reverse flex-wrap gap-y-2 justify-center">
              <Button variant="secondary" onClick={handleExport} disabled={isExporting} loading={isExporting}>
                  <ExportIcon className="ml-2" /> خروجی Excel
              </Button>
              <Button variant="secondary" onClick={() => navigate('/cns/equipment/bulk-import')}>
                  <BulkImportIcon className="ml-2" /> ورود گروهی
              </Button>
              <Button variant="primary" onClick={() => navigate('/cns/equipment/new')}>
                  <AddIcon className="ml-2" /> افزودن تجهیز
              </Button>
          </div>
      </div>

      <div className="mb-6">
          <Input 
            placeholder="جستجو بر اساس نام، شماره اموال..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            fullWidth
          />
      </div>

      <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام CNS</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">شماره اموال</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">حوزه</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">عملیات</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEquipments.map(eq => (
                      <tr key={eq.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{eq.name_cns}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{eq.asset_number || '---'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{eq.operational_area}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center space-x-1 space-x-reverse">
                                  <Button variant="ghost" size="sm" onClick={() => setHistoryEquipment(eq)} title="تاریخچه خرابی‌ها">
                                      <LogIcon className="text-blue-600" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => navigate(`/cns/equipment/edit/${eq.id}`)} title="ویرایش">
                                      <EditIcon />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => navigate(`/cns/equipment/new?copyFrom=${eq.id}`)} title="کپی">
                                      <CopyIcon />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(eq.id)} title="حذف">
                                      <DeleteIcon className="text-red-600" />
                                  </Button>
                              </div>
                          </td>
                      </tr>
                  ))}
                  {filteredEquipments.length === 0 && (
                      <tr><td colSpan={4} className="text-center p-6 text-gray-500">موردی یافت نشد.</td></tr>
                  )}
              </tbody>
          </table>
      </div>

      <ConfirmDialog 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="حذف تجهیز"
        message="آیا از حذف این تجهیز اطمینان دارید؟ تمام سوابق خرابی آن نیز حذف خواهد شد."
        confirmText="حذف"
      />
      
      {historyEquipment && (
          <EquipmentFaultHistoryModal 
              isOpen={!!historyEquipment}
              onClose={() => setHistoryEquipment(null)}
              equipment={historyEquipment}
          />
      )}
    </div>
  );
};
