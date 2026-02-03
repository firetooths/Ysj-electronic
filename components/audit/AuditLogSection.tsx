import React, { useEffect, useState, useCallback } from 'react';
import { AuditLog } from '../../types';
import { getAuditLogsByAssetId } from '../../supabaseService';
import { Spinner } from '../ui/Spinner';
import { InfoIcon } from '../ui/Icons';

interface AuditLogSectionProps {
  assetId: string;
}

export const AuditLogSection: React.FC<AuditLogSectionProps> = ({ assetId }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedLogs = await getAuditLogsByAssetId(assetId);
      setAuditLogs(fetchedLogs);
    } catch (err: any) {
      setError(`خطا در بارگذاری لاگ تغییرات: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

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
      <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">تاریخچه تغییرات (Audit Log)</h3>
      {auditLogs.length === 0 ? (
        <div className="flex items-center text-gray-600 p-4 border rounded-md bg-white">
          <InfoIcon className="ml-2 text-blue-500" />
          <span>هیچ لاگ تغییری برای این تجهیز ثبت نشده است.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {auditLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-md shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span>
                  <strong>تاریخ:</strong> {new Date(log.changed_at).toLocaleString('fa-IR')}
                </span>
                <span>
                  <strong>کاربر:</strong> {log.user_id}
                </span>
              </div>
              <p className="text-gray-800 mb-2">{log.change_description}</p>
              {log.field_name && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-sm border border-gray-100">
                  <p><strong>فیلد:</strong> {log.field_name}</p>
                  <p><strong>مقدار قبلی:</strong> {log.old_value || 'نامشخص'}</p>
                  <p><strong>مقدار جدید:</strong> {log.new_value || 'نامشخص'}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};