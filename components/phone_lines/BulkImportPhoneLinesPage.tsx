import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { BulkPhoneLine } from '../../types';
import {
  checkPhoneNumbersExist,
  bulkCreatePhoneLines,
} from '../../supabaseService';
import { useSupabaseContext } from '../../SupabaseContext';
import { Button } from '../ui/Button';
import { FileUploadIcon, WarningIcon, CheckIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';
import { BulkImportPhoneLinePreviewTable } from './BulkImportPhoneLinePreviewTable';

const REQUIRED_HEADERS = ['شماره تلفن'];
const OPTIONAL_HEADERS = ['مصرف کننده/واحد', 'تگ‌ها'];

export const BulkImportPhoneLinesPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tags, isLoading: isContextLoading } = useSupabaseContext();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BulkPhoneLine[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [importErrorCount, setImportErrorCount] = useState(0);
  const [importComplete, setImportComplete] = useState(false);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  const parseTagsString = (tagsString: string): { validTagIds: string[], invalidTagNames: string[] } => {
    if (!tagsString || !tags.length) {
        return { validTagIds: [], invalidTagNames: [] };
    }
    const fileTagNames = tagsString.split(',').map(t => t.trim()).filter(Boolean);
    const validTagIds: string[] = [];
    const invalidTagNames: string[] = [];
    
    fileTagNames.forEach(name => {
        const foundTag = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (foundTag) {
            validTagIds.push(foundTag.id);
        } else {
            invalidTagNames.push(name);
        }
    });
    return { validTagIds, invalidTagNames };
};


  const parseFile = useCallback(
    async (file: File) => {
      setIsProcessingFile(true);
      setFileError(null);
      setPreviewData([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result as string | ArrayBuffer;
          let jsonData: any[] = [];
          
          if (file.name.endsWith('.xlsx')) {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
          } else if (file.name.endsWith('.csv')) {
             const textData = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data);
             jsonData = XLSX.utils.sheet_to_json(XLSX.read(textData, { type: 'string' }).Sheets['Sheet1'], { defval: "" });
          } else {
            throw new Error('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل Excel (.xlsx) یا CSV را انتخاب کنید.');
          }

          if (jsonData.length === 0) {
            throw new Error('فایل خالی یا بدون داده قابل پردازش است.');
          }
          
          const headers = Object.keys(jsonData[0]);
          for (const header of REQUIRED_HEADERS) {
            if (!headers.includes(header)) {
                throw new Error(`فایل باید شامل ستون ضروری «${header}» باشد.`);
            }
          }

          const allPhoneNumbersInFile = jsonData.map(row => String(row['شماره تلفن'] || '').trim()).filter(Boolean);
          const existingNumbersInDB = await checkPhoneNumbersExist(allPhoneNumbersInFile);

          const processedData: BulkPhoneLine[] = jsonData.map((row, index) => {
            const phoneNumber = String(row['شماره تلفن'] || '').trim();
            const tagsString = String(row['تگ‌ها'] || '').trim();
            const { validTagIds, invalidTagNames } = parseTagsString(tagsString);
            
            let isPhoneNumberValid = !!phoneNumber;
            let isPhoneNumberDuplicate = false;

            if (isPhoneNumberValid) {
                // Check for duplicates within the file (up to current row)
                const fileDuplicates = allPhoneNumbersInFile.filter((num, i) => num === phoneNumber && i < index).length > 0;
                if (fileDuplicates || existingNumbersInDB.has(phoneNumber)) {
                    isPhoneNumberDuplicate = true;
                }
            }

            return {
              originalIndex: index,
              phone_number: phoneNumber,
              consumer_unit: String(row['مصرف کننده/واحد'] || '').trim() || null,
              tags_string: tagsString,
              isPhoneNumberValid,
              isPhoneNumberDuplicate,
              validTagIds,
              invalidTagNames,
              canImport: isPhoneNumberValid && !isPhoneNumberDuplicate,
            };
          });
          setPreviewData(processedData);

        } catch (err: any) {
          console.error('Error parsing file:', err.message);
          setFileError(`خطا در پردازش فایل: ${err.message}`);
        } finally {
          setIsProcessingFile(false);
        }
      };

      if (file.name.endsWith('.xlsx')) reader.readAsArrayBuffer(file);
      else if (file.name.endsWith('.csv')) reader.readAsText(file);

    }, [tags]
  );

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

  const handleBulkEdit = useCallback((index: number, field: keyof BulkPhoneLine, value: any) => {
    setPreviewData(prevData => {
        const newData = [...prevData];
        const row = { ...newData[index], [field]: value };

        // Re-validate row
        if (field === 'phone_number') {
            row.isPhoneNumberValid = !!row.phone_number;
            // Full re-check for duplicates is complex here, will be caught by final import.
            // For UI, just mark it as potentially ok for now. A better solution would be a full re-validation pass.
        }
        if (field === 'tags_string') {
            const { validTagIds, invalidTagNames } = parseTagsString(row.tags_string);
            row.validTagIds = validTagIds;
            row.invalidTagNames = invalidTagNames;
        }
        
        row.canImport = row.isPhoneNumberValid && !row.isPhoneNumberDuplicate;
        newData[index] = row;
        return newData;
    });
  }, [tags]);


  const importableRows = useMemo(() => previewData.filter(row => row.canImport), [previewData]);

  const handleImport = async () => {
    setIsImporting(true);
    setImportComplete(false);
    setImportProgress(0);
    setImportSuccessCount(0);
    setImportErrorCount(0);
    
    try {
        const result = await bulkCreatePhoneLines(importableRows);
        setImportSuccessCount(result.successCount);
        setImportErrorCount(result.errorCount + (previewData.length - importableRows.length)); // Add non-importable rows to error count
    } catch(err: any) {
        setFileError(`خطای کلی در هنگام ورود گروهی: ${err.message}`);
        setImportErrorCount(previewData.length);
    } finally {
        setIsImporting(false);
        setImportComplete(true);
        setPreviewData([]);
        setSelectedFile(null);
    }
  };

  if (isContextLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">ورود گروهی خطوط تلفن</h2>

      {importComplete && (
          <div className="mb-6 p-4 border rounded-lg shadow-md bg-green-50">
              <h3 className="text-xl font-bold text-green-800">عملیات ورود تکمیل شد</h3>
              <p className="mt-2 text-gray-700">تعداد <strong className="text-green-700">{importSuccessCount}</strong> خط با موفقیت ثبت شد.</p>
              <p className="text-gray-700">تعداد <strong className="text-red-700">{importErrorCount}</strong> ردیف به دلیل خطا ثبت نشد.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setImportComplete(false)}>وارد کردن فایل جدید</Button>
          </div>
      )}

      {!importComplete && (
        <>
            <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">۱. انتخاب فایل</h3>
                <p className="text-gray-600 mb-4">
                فایل Excel (.xlsx) یا CSV را انتخاب کنید. ستون‌های مورد نیاز: "{REQUIRED_HEADERS.join('", "')}". ستون‌های اختیاری: "{OPTIONAL_HEADERS.join('", "')}".
                </p>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.csv" className="hidden"/>
                <Button onClick={triggerFileInput} variant="primary" disabled={isProcessingFile || isImporting}>
                <FileUploadIcon className="ml-2" /> انتخاب فایل
                </Button>
                {selectedFile && <span className="ml-4 text-gray-700 font-medium">{selectedFile.name}</span>}
                {fileError && <div className="mt-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg">{fileError}</div>}
            </div>

            {isProcessingFile && (
                <div className="flex items-center justify-center p-6 bg-blue-50 text-blue-700 rounded-lg mb-6">
                <Spinner className="w-6 h-6 ml-3" />
                <span>در حال پردازش فایل...</span>
                </div>
            )}

            {previewData.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">۲. پیش‌نمایش و اعتبارسنجی</h3>
                    <div className="flex items-center space-x-4 space-x-reverse mb-4 text-gray-700">
                        <span className="flex items-center"><CheckIcon className="ml-1 text-green-500" /> ردیف‌های قابل ورود: <strong className="mr-1">{importableRows.length}</strong></span>
                        <span className="flex items-center"><WarningIcon className="ml-1 text-red-500" /> ردیف‌های دارای خطا: <strong className="mr-1">{previewData.length - importableRows.length}</strong></span>
                    </div>

                    <BulkImportPhoneLinePreviewTable data={previewData} onEdit={handleBulkEdit} />

                    <div className="mt-6 flex justify-start space-x-4 space-x-reverse">
                        <Button onClick={handleImport} variant="primary" disabled={importableRows.length === 0 || isImporting} loading={isImporting}>
                        <CheckIcon className="ml-2" />
                        {isImporting ? 'در حال ورود...' : `ثبت ${importableRows.length} خط معتبر`}
                        </Button>
                        <Button onClick={() => { setPreviewData([]); setSelectedFile(null); }} variant="secondary" disabled={isImporting}>
                        لغو
                        </Button>
                    </div>
                </div>
            )}
        </>
      )}
    </div>
  );
};