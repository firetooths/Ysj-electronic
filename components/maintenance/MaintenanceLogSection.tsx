import React, { useState, useEffect, useCallback } from 'react';
import { MaintenanceLog, Category, Location } from '../../types';
import { createMaintenanceLog, deleteMaintenanceLog, getMaintenanceLogsByAssetId } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, InfoIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';

interface MaintenanceLogSectionProps {
  assetId: string;
  categories: Category[]; // Not directly used here, but passed from AssetDetails
  locations: Location[]; // Not directly used here, but passed from AssetDetails
}

export const MaintenanceLogSection: React.FC<MaintenanceLogSectionProps> = ({ assetId }) => {
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [workDone, setWorkDone] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [responsiblePerson, setResponsiblePerson] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<MaintenanceLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMaintenanceLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedLogs = await getMaintenanceLogsByAssetId(assetId);
      setMaintenanceLogs(fetchedLogs);
    } catch (err: any) {
      setError(`خطا در بارگذاری لاگ‌های نگهداری: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchMaintenanceLogs();
  }, [fetchMaintenanceLogs]);

  const handleOpenCreate = () => {
    setLogDate(new Date().toISOString().split('T')[0]);
    setWorkDone('');
    setCost('');
    setResponsiblePerson('');
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    if (!logDate) {
      setValidationError('تاریخ انجام کار اجباری است.');
      return;
    }
    if (!workDone.trim()) {
      setValidationError('شرح کار انجام شده اجباری است.');
      return;
    }
    if (cost && isNaN(Number(cost))) {
      setValidationError('هزینه باید عدد باشد.');
      return;
    }

    setIsSaving(true);
    try {
      const newLog = {
        asset_id: assetId,
        log_date: logDate,
        work_done: workDone.trim(),
        cost: cost ? parseFloat(cost) : null,
        responsible_person: responsiblePerson.trim() || null,
      };
      await createMaintenanceLog(newLog);
      alert('لاگ نگهداری با موفقیت ثبت شد.');
      fetchMaintenanceLogs();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(`خطا در ذخیره لاگ نگهداری: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (log: MaintenanceLog) => {
    setLogToDelete(log);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!logToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMaintenanceLog(logToDelete.id);
      alert('لاگ نگهداری با موفقیت حذف شد.');
      fetchMaintenanceLogs();
      setConfirmDeleteOpen(false);
    } catch (err: any) {
      setError(`خطا در حذف لاگ نگهداری: ${err.message}`);
      alert(`خطا در حذف لاگ نگهداری: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setLogToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-3 bg-red-100 rounded-lg">{error}</div>;
  }

  return (
    <div className="bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200">
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h3 className="text-xl font-semibold text-gray-800">تاریخچه نگهداری</h3>
        <Button variant="primary" onClick={handleOpenCreate} size="sm">
          <AddIcon className="ml-2" /> افزودن لاگ
        </Button>
      </div>
      {maintenanceLogs.length === 0 ? (
        <div className="flex items-center text-gray-600 p-4 border rounded-md bg-white">
          <InfoIcon className="ml-2 text-blue-500" />
          <span>هیچ لاگ نگهداری برای این تجهیز ثبت نشده است.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {maintenanceLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-md shadow-sm border border-gray-100 flex justify-between items-start hover:shadow-md transition-shadow">
              <div>
                <p className="text-gray-800 font-medium mb-1">{log.work_done}</p>
                <p className="text-sm text-gray-600 mb-1">
                  <strong>تاریخ:</strong> {new Date(log.log_date).toLocaleDateString('fa-IR')}
                </p>
                {log.cost !== null && (
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>هزینه:</strong> {log.cost.toLocaleString('fa-IR')} ریال
                  </p>
                )}
                {log.responsible_person && (
                  <p className="text-sm text-gray-600">
                    <strong>مسئول:</strong> {log.responsible_person}
                  </p>
                )}
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDeleteClick(log)} title="حذف لاگ">
                <DeleteIcon />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="افزودن لاگ نگهداری">
        <form onSubmit={handleSaveLog} className="space-y-4 p-4">
          <Input
            label="تاریخ انجام کار"
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            error={validationError && !logDate ? validationError : null}
            fullWidth
          />
          <TextArea
            label="شرح کار انجام شده"
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            error={validationError && !workDone.trim() ? validationError : null}
            rows={3}
            fullWidth
          />
          <Input
            label="هزینه (ریال)"
            type="text"
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))} // Only allow digits
            error={validationError && cost && isNaN(Number(cost)) ? validationError : null}
            fullWidth
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <Input
            label="نام مسئول"
            type="text"
            value={responsiblePerson}
            onChange={(e) => setResponsiblePerson(e.target.value)}
            fullWidth
          />
          <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t border-gray-200">
            <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : 'ذخیره'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              لغو
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="حذف لاگ نگهداری"
        message={`آیا از حذف لاگ نگهداری برای "${logToDelete?.work_done}" در تاریخ ${logToDelete?.log_date} مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        confirmText="حذف"
        isConfirming={isDeleting}
      />
    </div>
  );
};