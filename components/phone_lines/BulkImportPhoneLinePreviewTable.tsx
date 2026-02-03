import React from 'react';
import { BulkPhoneLine } from '../../types';
import { Input } from '../ui/Input';
import { CheckIcon, CloseIcon, WarningIcon } from '../ui/Icons';

interface BulkImportPhoneLinePreviewTableProps {
  data: BulkPhoneLine[];
  onEdit: (index: number, field: keyof BulkPhoneLine, value: any) => void;
}

export const BulkImportPhoneLinePreviewTable: React.FC<BulkImportPhoneLinePreviewTableProps> = ({
  data,
  onEdit,
}) => {
  const getRowClass = (row: BulkPhoneLine) => {
    if (!row.canImport) return 'bg-red-50'; // Red error for non-importable
    if (row.invalidTagNames.length > 0) return 'bg-yellow-50'; // Yellow warning for bad tags
    return 'bg-white';
  };

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-lg shadow-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">وضعیت</th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره تلفن</th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مصرف کننده/واحد</th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تگ‌ها (جدا شده با کاما)</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={row.originalIndex} className={getRowClass(row)}>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center justify-center">
                  {row.canImport ? (
                    <CheckIcon className="text-green-500" title="قابل ورود" />
                  ) : (
                    <CloseIcon className="text-red-500" title="خطا - غیر قابل ورود" />
                  )}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                <Input
                  type="text"
                  value={row.phone_number}
                  onChange={(e) => onEdit(index, 'phone_number', e.target.value)}
                  className={`w-32 ${!row.isPhoneNumberValid || row.isPhoneNumberDuplicate ? 'border-red-500' : ''}`}
                />
                {!row.isPhoneNumberValid && <p className="text-red-500 text-xs mt-1">اجباری</p>}
                {row.isPhoneNumberDuplicate && <p className="text-red-500 text-xs mt-1">تکراری</p>}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                <Input
                  type="text"
                  value={row.consumer_unit || ''}
                  onChange={(e) => onEdit(index, 'consumer_unit', e.target.value)}
                  className="w-40"
                />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                <Input
                  type="text"
                  value={row.tags_string}
                  onChange={(e) => onEdit(index, 'tags_string', e.target.value)}
                  className={`w-48 ${row.invalidTagNames.length > 0 ? 'border-yellow-500' : ''}`}
                />
                {row.invalidTagNames.length > 0 && (
                  <div className="text-yellow-700 text-xs mt-1 flex items-center">
                    <WarningIcon className="mr-1" />
                    ناشناخته: {row.invalidTagNames.join(', ')}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};