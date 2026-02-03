
import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { BulkAsset } from '../../types';
import {
  checkAssetIdNumberExists,
  createAsset,
  supabase, // Used for direct `supabase.from` call
} from '../../supabaseService';
import { useSupabaseContext } from '../../SupabaseContext';
import { Button } from '../ui/Button';
import { FileUploadIcon, WarningIcon, CheckIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';
import { BulkImportPreviewTable } from './BulkImportPreviewTable';

export const BulkImportPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { categories, locations, assetStatuses, isLoading: isContextLoading, supabase } = useSupabaseContext(); // Get supabase from context

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BulkAsset[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [importErrorCount, setImportErrorCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const parseFile = useCallback(
    async (file: File) => {
      if (!supabase) { // Ensure supabase is available before proceeding
        setFileError('خطا: Supabase پیکربندی نشده است. قادر به پردازش فایل نیستید.');
        return;
      }

      setIsProcessingFile(true);
      setFileError(null);
      setPreviewData([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result as string | ArrayBuffer;
          let workbook: XLSX.WorkBook;
          let jsonData: any[] = [];

          if (file.name.endsWith('.xlsx')) {
            workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
          } else if (file.name.endsWith('.csv')) {
            const textData = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data);
            const lines = textData.split('\n').filter(line => line.trim() !== '');
            if (lines.length === 0) {
              setFileError('فایل CSV خالی است.');
              setIsProcessingFile(false);
              return;
            }
            const headers = lines[0].split(',').map(h => h.trim());
            jsonData = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                return headers.reduce((obj, header, index) => {
                    (obj as any)[header] = values[index];
                    return obj;
                }, {});
            });
          } else {
            setFileError('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل Excel (.xlsx) یا CSV را انتخاب کنید.');
            setIsProcessingFile(false);
            return;
          }

          if (jsonData.length === 0) {
            setFileError('فایل خالی یا بدون داده قابل پردازش است.');
            setIsProcessingFile(false);
            return;
          }

          const existingAssetIds = new Set<string>();
          const { data: dbAssetNumbers, error: dbError } = await supabase
            .from('assets')
            .select('asset_id_number');
          if (dbError) throw dbError;
          dbAssetNumbers?.forEach((item) =>
            existingAssetIds.add(String(item.asset_id_number)),
          );

          const fileAssetIdNumbers = new Set<string>(); // To track duplicates within the file
          const processedData: BulkAsset[] = [];

          for (const [index, row] of jsonData.entries()) {
            const assetIdNum = String(row['شماره اموال'] || row['Asset ID'] || '').trim();
            const assetName = row['نام تجهیز'] || row['Name'];
            const categoryName = row['دسته بندی'] || row['Category'];
            const locationName = row['محل قرارگیری'] || row['Location'];
            const statusName = row['وضعیت'] || row['Status'];
            const descriptionText = row['توضیحات'] || row['Description'];
            // FIX: Extract is_external from row headers
            const isExternalValue = row['اموال تهران (خارج)'] || row['Is External'];
            const isExternal = isExternalValue === 'بله' || isExternalValue === 'Yes' || isExternalValue === true;

            let isValidAssetId = true;
            let isExistingAssetId = false;

            if (!assetIdNum) {
              isValidAssetId = false;
            } else {
              // Check for duplicates within the file
              if (fileAssetIdNumbers.has(assetIdNum)) {
                isExistingAssetId = true; // Mark as duplicate within file
              } else {
                fileAssetIdNumbers.add(assetIdNum);
                // Check against database only if not a duplicate within the file
                if (existingAssetIds.has(assetIdNum)) {
                  isExistingAssetId = true;
                }
              }
            }
            
            const category = categories.find((c) => c.name === categoryName);
            const location = locations.find((l) => l.name === locationName);
            const isStatusValid = assetStatuses.some(s => s.name === statusName);

            // Optional Fields Validation: 
            // Valid if: (Field is Empty) OR (Field is Provided AND Found in DB)
            const isCategoryValid = !categoryName || !!category;
            const isLocationValid = !locationName || !!location;
            const isStatusValidField = !statusName || isStatusValid;

            processedData.push({
              originalIndex: index,
              asset_id_number: assetIdNum || null,
              name: assetName || '',
              category_name: categoryName || '',
              location_name: locationName || '',
              status: statusName || '',
              description: descriptionText || null,
              // FIX: Added is_external property required by BulkAsset type.
              is_external: isExternal,
              category_id: category?.id,
              location_id: location?.id,
              isValidAssetId: isValidAssetId, 
              isExistingAssetId: isExistingAssetId, // Checks against DB AND internal file duplicates
              isCategoryValid: isCategoryValid,
              isLocationValid: isLocationValid,
              isStatusValid: isStatusValidField,
              // Mandatory fields: Asset ID and Name. Others are optional.
              canImport: isValidAssetId && !isExistingAssetId && !!assetName,
            });
          }
          setPreviewData(processedData);
        } catch (err: any) {
          console.error('Error parsing file:', err.message);
          setFileError(`خطا در پردازش فایل: ${err.message}`);
        } finally {
          setIsProcessingFile(false);
        }
      };

      if (file.name.endsWith('.xlsx')) {
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      }
    },
    [categories, locations, assetStatuses, supabase], // Add supabase to dependencies
  );

  // FIX: Added missing handleFileChange function
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setSelectedFile(file);
      parseFile(file);
    } else {
      setSelectedFile(null);
      setPreviewData([]);
      setFileError(null);
    }
  };

  const handleBulkEdit = useCallback((index: number, field: keyof BulkAsset, value: any) => {
    setPreviewData((prevData) => {
      const newData = [...prevData];
      const row = newData[index];
      (row as any)[field] = value;

      // Re-validate row on change
      let currentIsValidAssetId = true;
      let currentIsExistingAssetId = false; // Tracks if ID is duplicated in file OR in DB
      const assetIdNum = String(row.asset_id_number || '');

      if (field === 'asset_id_number') {
        if (!assetIdNum) {
          currentIsValidAssetId = false;
        } else {
          // Check for duplicates in the current preview data (excluding itself)
          const fileDuplicates = newData.filter(
            (item, i) => i !== index && item.asset_id_number === assetIdNum,
          ).length > 0;
          
          if (fileDuplicates) {
            currentIsExistingAssetId = true;
          } else {
            // Check against DB
            checkAssetIdNumberExists(assetIdNum).then(dbExists => {
              if (dbExists) {
                newData[index].isExistingAssetId = true;
                newData[index].isValidAssetId = true; // Format is valid
                newData[index].canImport = false;
                setPreviewData([...newData]); // Update state again if async check changes things
              } else {
                newData[index].isExistingAssetId = false;
                newData[index].isValidAssetId = true;
                // Re-calculate canImport inside promise
                newData[index].canImport = newData[index].isValidAssetId && !newData[index].isExistingAssetId && !!newData[index].name;
                setPreviewData([...newData]);
              }
            }).catch(err => {
              console.error("Error checking asset ID existence:", err.message);
              newData[index].isValidAssetId = false; // Treat database check failure as an error for this field
              newData[index].canImport = false;
              setPreviewData([...newData]);
            });
          }
        }
        row.isValidAssetId = currentIsValidAssetId;
        row.isExistingAssetId = currentIsExistingAssetId;
      }

      if (field === 'name') {
        row.name = value;
      } else if (field === 'category_name') {
        const category = categories.find((c) => c.name === value);
        row.category_id = category?.id;
        row.isCategoryValid = !value || !!category; // Valid if empty or found
      } else if (field === 'location_name') {
        const location = locations.find((l) => l.name === value);
        row.location_id = location?.id;
        row.isLocationValid = !value || !!location; // Valid if empty or found
      } else if (field === 'status') {
        row.isStatusValid = !value || assetStatuses.some(s => s.name === value); // Valid if empty or in DB
      }

      // Only Asset ID and Name are mandatory for import enable
      row.canImport = row.isValidAssetId && !row.isExistingAssetId && !!row.name;

      return newData;
    });
  }, [categories, locations, assetStatuses]);


  const importableRows = useMemo(
    () => previewData.filter((row) => row.canImport),
    [previewData],
  );

  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    setImportSuccessCount(0);
    setImportErrorCount(0);
    setImportError(null);

    let successCount = 0;
    let errorCount = 0;
    const totalToImport = importableRows.length;

    for (const [index, row] of importableRows.entries()) {
      try {
        // Check mandatory fields again (redundant but safe)
        if (row.canImport && row.asset_id_number !== null && row.name) {
          
          // Handle optional fields:
          const finalStatus = (row.isStatusValid && row.status) ? row.status : (assetStatuses[0]?.name || 'در حال استفاده');

          const newAsset: any = {
            asset_id_number: row.asset_id_number,
            name: row.name,
            category_id: row.category_id || null,
            location_id: row.location_id || null,
            status: finalStatus,
            description: row.description,
            // FIX: Pass is_external to the creation payload.
            is_external: row.is_external,
            image_urls: [], 
          };
          
          await createAsset(newAsset);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err: any) {
        console.error(`Error importing row ${row.originalIndex + 1}:`, err.message);
        errorCount++;
      } finally {
        setImportProgress(Math.round(((index + 1) / totalToImport) * 100));
        setImportSuccessCount(successCount);
        setImportErrorCount(errorCount);
      }
    }

    setIsImporting(false);
    if (errorCount > 0) {
      setImportError(`تعداد ${errorCount} ردیف با خطا مواجه شد (ممکن است خطای دیتابیس باشد).`);
    } else {
      alert('وارد کردن گروهی با موفقیت انجام شد!');
    }
    setPreviewData([]); // Clear preview after import
    setSelectedFile(null);
  };

  if (isContextLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">ورود گروهی تجهیزات</h2>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">1. انتخاب فایل</h3>
        <p className="text-gray-600 mb-4">
          لطفاً فایل Excel (.xlsx) یا CSV حاوی اطلاعات تجهیزات را انتخاب کنید. ستون‌های <strong>شماره اموال</strong> و <strong>نام تجهیز</strong> الزامی هستند. سایر ستون‌ها (دسته بندی، محل، وضعیت) اختیاری می‌باشند.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.csv"
          className="hidden"
        />
        <Button onClick={triggerFileInput} variant="primary" disabled={isProcessingFile || isImporting}>
          <FileUploadIcon className="ml-2" /> انتخاب فایل
        </Button>
        {selectedFile && (
          <span className="ml-4 text-gray-700 font-medium">فایل انتخاب شده: {selectedFile.name}</span>
        )}
        {fileError && (
          <div className="mt-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg">
            {fileError}
          </div>
        )}
      </div>

      {isProcessingFile && (
        <div className="flex items-center justify-center p-6 bg-blue-50 text-blue-700 rounded-lg mb-6">
          <Spinner className="w-6 h-6 ml-3" />
          <span>در حال پردازش فایل...</span>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">2. پیش‌نمایش و اعتبارسنجی</h3>
          <div className="flex items-center space-x-4 space-x-reverse mb-4 text-gray-700">
            <span className="flex items-center"><CheckIcon className="ml-1 text-green-500" /> ردیف‌های قابل ورود: <strong className="mr-1">{importableRows.length}</strong></span>
            <span className="flex items-center"><WarningIcon className="ml-1 text-red-500" /> ردیف‌های دارای خطای اجباری (غیر قابل ورود): <strong className="mr-1">{previewData.length - importableRows.length}</strong></span>
          </div>

          <BulkImportPreviewTable
            data={previewData}
            onEdit={handleBulkEdit}
            categories={categories}
            locations={locations}
            assetStatuses={assetStatuses.map(s => s.name as any)}
          />

          <div className="mt-6 flex justify-start space-x-4 space-x-reverse">
            <Button
              onClick={handleImport}
              variant="primary"
              disabled={importableRows.length === 0 || isImporting}
              loading={isImporting}
            >
              <CheckIcon className="ml-2" />
              {isImporting ? 'در حال ورود...' : 'ثبت ردیف‌های قابل ورود'}
            </Button>
            <Button
              onClick={() => {
                setPreviewData([]);
                setSelectedFile(null);
              }}
              variant="secondary"
              disabled={isImporting}
            >
              لغو
            </Button>
          </div>
          {isImporting && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-center text-sm text-gray-600 mt-2">
                {importProgress}% - موفق: {importSuccessCount}, خطا: {importErrorCount}
              </p>
            </div>
          )}
          {importError && (
            <div className="mt-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg">
              {importError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
