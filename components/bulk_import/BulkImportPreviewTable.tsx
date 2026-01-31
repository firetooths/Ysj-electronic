
import React from 'react';
import { BulkAsset, Category, Location, AssetStatus } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CheckIcon, WarningIcon, CloseIcon } from '../ui/Icons';

interface BulkImportPreviewTableProps {
  data: BulkAsset[];
  onEdit: (index: number, field: keyof BulkAsset, value: any) => void;
  categories: Category[];
  locations: Location[];
  assetStatuses: AssetStatus[];
}

export const BulkImportPreviewTable: React.FC<BulkImportPreviewTableProps> = ({
  data,
  onEdit,
  categories,
  locations,
  assetStatuses,
}) => {
  const getRowClass = (row: BulkAsset) => {
    if (!row.canImport) {
      return 'bg-red-50'; // Red error (Critical fields missing)
    } else if (!row.isCategoryValid || !row.isLocationValid || !row.isStatusValid) {
      return 'bg-yellow-50'; // Yellow warning (Optional fields missing/invalid)
    }
    return 'bg-white'; // All good
  };

  const statusOptions = [{ value: '', label: 'انتخاب وضعیت' }, ...assetStatuses.map(s => ({ value: s, label: s }))];
  const categoryOptions = [{ value: '', label: 'انتخاب دسته بندی' }, ...categories.map(c => ({ value: c.name, label: c.name }))];
  const locationOptions = [{ value: '', label: 'انتخاب محل' }, ...locations.map(l => ({ value: l.name, label: l.name }))];


  return (
    <div className="overflow-x-auto custom-scrollbar rounded-lg shadow-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              وضعیت
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              شماره اموال *
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              نام تجهیز *
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              دسته بندی
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              محل قرارگیری
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              وضعیت
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              توضیحات
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={row.originalIndex} className={getRowClass(row)}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center">
                  {row.canImport ? (
                    <CheckIcon className="text-green-500" title="قابل ورود" />
                  ) : (
                    <CloseIcon className="text-red-500" title="خطا - غیر قابل ورود" />
                  )}
                  {(!row.isCategoryValid || !row.isLocationValid || !row.isStatusValid) && row.canImport && (
                    <WarningIcon className="ml-1 text-yellow-500" title="هشدار - برخی فیلدهای اختیاری نامعتبر یا خالی هستند" />
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <Input
                  type="text"
                  value={row.asset_id_number !== null ? row.asset_id_number : ''}
                  onChange={(e) => onEdit(index, 'asset_id_number', e.target.value)}
                  className={`w-24 ${(!row.isValidAssetId || row.isExistingAssetId) ? 'border-red-500' : ''}`}
                  inputMode="numeric"
                />
                {!row.isValidAssetId && <p className="text-red-500 text-xs mt-1">نامعتبر</p>}
                {row.isExistingAssetId && <p className="text-red-500 text-xs mt-1">تکراری</p>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <Input
                  type="text"
                  value={row.name}
                  onChange={(e) => onEdit(index, 'name', e.target.value)}
                  className={`w-32 ${!row.name ? 'border-red-500' : ''}`}
                />
                {!row.name && <p className="text-red-500 text-xs mt-1">اجباری</p>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <Select
                  options={categoryOptions}
                  value={row.category_name}
                  onChange={(e) => onEdit(index, 'category_name', e.target.value)}
                  className={`w-32 ${!row.isCategoryValid ? 'border-yellow-500' : ''}`}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <Select
                  options={locationOptions}
                  value={row.location_name}
                  onChange={(e) => onEdit(index, 'location_name', e.target.value)}
                  className={`w-32 ${!row.isLocationValid ? 'border-yellow-500' : ''}`}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <Select
                  options={statusOptions}
                  value={row.status}
                  onChange={(e) => onEdit(index, 'status', e.target.value)}
                  className={`w-32 ${!row.isStatusValid ? 'border-yellow-500' : ''}`}
                />
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                <Input
                  type="text"
                  value={row.description || ''}
                  onChange={(e) => onEdit(index, 'description', e.target.value)}
                  className="w-48"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
