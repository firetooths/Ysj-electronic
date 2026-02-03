
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FileUploadIcon, CheckIcon, WarningIcon, CloseIcon, DeleteIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';
import { CNSEquipment } from '../../types';
import { getCNSEquipments, bulkCreateCNSEquipment } from '../../services/cnsService';

interface BulkCNSPreviewItem {
    originalIndex: number;
    name_cns: string;
    asset_number: string;
    operational_area: string;
    serial_number: string;
    manufacturer: string;
    location: string;
    
    isValid: boolean;
    isDuplicate: boolean;
    validationMessage?: string;
}

const HEADERS_MAP: { [key: string]: string } = {
    'نام دستگاه': 'name_cns',
    'نام تجهیز': 'name_cns',
    'Device Name': 'name_cns',
    'شماره اموال': 'asset_number',
    'Asset Number': 'asset_number',
    'حوزه عملیاتی': 'operational_area',
    'Operational Area': 'operational_area',
    'شماره سریال': 'serial_number',
    'Serial Number': 'serial_number',
    'سازنده': 'manufacturer',
    'Manufacturer': 'manufacturer',
    'محل قرارگیری': 'location',
    'Location': 'location'
};

export const BulkImportCNSEquipment: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [previewData, setPreviewData] = useState<BulkCNSPreviewItem[]>([]);
    const [existingEquipments, setExistingEquipments] = useState<CNSEquipment[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState(false);

    useEffect(() => {
        // Load existing data for duplicate checking
        const loadExisting = async () => {
            try {
                const data = await getCNSEquipments();
                setExistingEquipments(data);
            } catch (e) {
                console.error("Failed to load existing equipment", e);
            }
        };
        loadExisting();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const processFile = (file: File) => {
        setIsProcessing(true);
        setFileError(null);
        setPreviewData([]);
        setImportSuccess(false);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

                if (jsonData.length === 0) {
                    throw new Error('فایل خالی است.');
                }

                const processed: BulkCNSPreviewItem[] = jsonData.map((row, index) => {
                    // Map headers
                    const item: any = {
                        originalIndex: index,
                        name_cns: '',
                        asset_number: '',
                        operational_area: 'ناوبری', // Default
                        serial_number: '',
                        manufacturer: '',
                        location: ''
                    };

                    Object.keys(row).forEach(key => {
                        const mappedKey = HEADERS_MAP[key.trim()];
                        if (mappedKey) {
                            item[mappedKey] = String(row[key]).trim();
                        }
                    });

                    // Initial Validation
                    return validateItem(item);
                });

                setPreviewData(processed);
            } catch (err: any) {
                setFileError(`خطا در پردازش فایل: ${err.message}`);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const validateItem = (item: any): BulkCNSPreviewItem => {
        let isValid = true;
        let isDuplicate = false;
        let message = '';

        if (!item.name_cns || !item.name_cns.trim()) {
            isValid = false;
            message = 'نام دستگاه الزامی است.';
        } else {
            // Duplicate Check: Same Name AND Same Asset Number
            const duplicateFound = existingEquipments.some(ex => {
                const exName = ex.name_cns.toLowerCase();
                const newName = item.name_cns.toLowerCase().trim();
                const exAsset = ex.asset_number ? ex.asset_number.trim() : '';
                const newAsset = item.asset_number ? item.asset_number.trim() : '';
                
                return exName === newName && exAsset === newAsset;
            });

            if (duplicateFound) {
                isValid = false;
                isDuplicate = true;
                message = 'تکراری: نام و شماره اموال مشابه در سیستم موجود است.';
            }
        }

        return {
            ...item,
            isValid,
            isDuplicate,
            validationMessage: message
        };
    };

    const handleEdit = (index: number, field: keyof BulkCNSPreviewItem, value: string) => {
        setPreviewData(prev => {
            const newData = [...prev];
            const item = { ...newData[index], [field]: value };
            // Re-validate after edit
            const validatedItem = validateItem(item);
            newData[index] = validatedItem;
            return newData;
        });
    };

    const handleDelete = (index: number) => {
        setPreviewData(prev => prev.filter((_, i) => i !== index));
    };

    const handleImport = async () => {
        const validItems = previewData.filter(i => i.isValid);
        if (validItems.length === 0) return;

        setIsImporting(true);
        try {
            const payload = validItems.map(i => ({
                name_cns: i.name_cns,
                asset_number: i.asset_number || null,
                operational_area: i.operational_area || 'ناوبری',
                serial_number: i.serial_number || null,
                manufacturer: i.manufacturer || null,
                location: i.location || null,
                support_contact: null,
                is_imported_from_amval: false,
                image_urls: []
            }));

            await bulkCreateCNSEquipment(payload);
            setImportSuccess(true);
            setPreviewData([]);
            // Refresh existing list to include newly added items for duplicate checking next time
            const updatedList = await getCNSEquipments();
            setExistingEquipments(updatedList);
        } catch (err: any) {
            setFileError(`خطا در ثبت اطلاعات: ${err.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">ورود گروهی تجهیزات CNS</h2>

            {importSuccess && (
                <div className="mb-6 p-4 bg-green-100 text-green-800 rounded border border-green-200 flex items-center">
                    <CheckIcon className="ml-2" />
                    <span>تجهیزات با موفقیت ثبت شدند.</span>
                </div>
            )}

            <div className="mb-6">
                <p className="mb-4 text-gray-600">
                    فایل اکسل باید شامل ستون <strong>"نام دستگاه"</strong> باشد. سایر ستون‌ها مانند "شماره اموال"، "حوزه عملیاتی"، "سریال"، "سازنده" و "محل قرارگیری" اختیاری هستند.
                </p>
                <div className="flex items-center gap-4">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing || isImporting}>
                        <FileUploadIcon className="ml-2" /> انتخاب فایل اکسل
                    </Button>
                    {isProcessing && <span className="text-blue-600"><Spinner className="inline-block ml-1 w-4 h-4"/> در حال پردازش...</span>}
                </div>
            </div>

            {fileError && <div className="p-4 mb-6 bg-red-100 text-red-800 rounded border border-red-200">{fileError}</div>}

            {previewData.length > 0 && (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="text-sm">
                            <span className="ml-4 text-gray-600">تعداد کل: {previewData.length}</span>
                            <span className="ml-4 text-green-600">قابل ثبت: {previewData.filter(i => i.isValid).length}</span>
                            <span className="text-red-600">غیرقابل ثبت (تکراری/ناقص): {previewData.filter(i => !i.isValid).length}</span>
                        </div>
                        <Button variant="primary" onClick={handleImport} disabled={isImporting || previewData.filter(i => i.isValid).length === 0} loading={isImporting}>
                            <CheckIcon className="ml-2" /> ثبت موارد معتبر
                        </Button>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar rounded-lg border border-gray-200 max-h-[600px]">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">وضعیت</th>
                                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام دستگاه</th>
                                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase">شماره اموال</th>
                                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase">حوزه</th>
                                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase">سریال</th>
                                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase">محل</th>
                                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase">توضیحات خطا</th>
                                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">حذف</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {previewData.map((row, idx) => (
                                    <tr key={idx} className={!row.isValid ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                        <td className="px-2 py-2 text-center">
                                            {row.isValid ? (
                                                <CheckIcon className="text-green-500" title="آماده ثبت" />
                                            ) : row.isDuplicate ? (
                                                <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded whitespace-nowrap">تکراری</span>
                                            ) : (
                                                <CloseIcon className="text-red-500" title="ناقص" />
                                            )}
                                        </td>
                                        <td className="px-2 py-2">
                                            <Input 
                                                value={row.name_cns} 
                                                onChange={e => handleEdit(idx, 'name_cns', e.target.value)}
                                                className={`h-8 text-sm ${!row.name_cns ? 'border-red-500' : ''}`}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <Input 
                                                value={row.asset_number} 
                                                onChange={e => handleEdit(idx, 'asset_number', e.target.value)}
                                                className="h-8 text-sm font-mono"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <Input 
                                                value={row.operational_area} 
                                                onChange={e => handleEdit(idx, 'operational_area', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <Input 
                                                value={row.serial_number} 
                                                onChange={e => handleEdit(idx, 'serial_number', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <Input 
                                                value={row.location} 
                                                onChange={e => handleEdit(idx, 'location', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-xs text-red-600 w-48">
                                            {row.validationMessage}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <button 
                                                onClick={() => handleDelete(idx)}
                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                                title="حذف از لیست"
                                            >
                                                <DeleteIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};
