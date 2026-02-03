
import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../ui/Button';
import { FileUploadIcon, CheckIcon, WarningIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';
import { createContact } from '../../supabaseService';
import { ContactPhoneNumber, ContactEmail } from '../../types';

export const BulkImportContacts: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const processFile = (file: File) => {
        setIsProcessing(true);
        setLogs([]);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];
                
                let successCount = 0;
                let errorCount = 0;
                const newLogs: string[] = [];

                for (const row of data) {
                    try {
                        // Required: First Name
                        const firstName = row['نام'] || row['First Name'];
                        if (!firstName) throw new Error('نام الزامی است');

                        const lastName = row['نام خانوادگی'] || row['Last Name'] || null;
                        const organization = row['سازمان'] || row['Organization'] || null;
                        const jobTitle = row['سمت'] || row['Job Title'] || null;
                        const notes = row['توضیحات'] || row['Notes'] || null;
                        
                        // Phones (assume comma separated or single column)
                        const phones: ContactPhoneNumber[] = [];
                        const phoneRaw = row['شماره تلفن'] || row['شماره ها'] || row['Phone'];
                        if (phoneRaw) {
                            String(phoneRaw).split(',').forEach(p => {
                                phones.push({ phone_number: p.trim(), type: 'موبایل' });
                            });
                        }

                        // Emails
                        const emails: ContactEmail[] = [];
                        const emailRaw = row['ایمیل'] || row['Email'];
                        if (emailRaw) {
                            String(emailRaw).split(',').forEach(e => {
                                emails.push({ email: e.trim(), type: 'کاری' });
                            });
                        }

                        await createContact(
                            { first_name: firstName, last_name: lastName, organization, job_title: jobTitle, notes },
                            phones,
                            emails,
                            [] // No groups for now from bulk import simplicity
                        );
                        successCount++;
                    } catch (err: any) {
                        errorCount++;
                        newLogs.push(`ردیف خطا: ${JSON.stringify(row)} - ${err.message}`);
                    }
                }
                setLogs(prev => [...prev, `پایان عملیات. موفق: ${successCount}, خطا: ${errorCount}`, ...newLogs]);
            } catch (err: any) {
                setLogs(prev => [...prev, `خطا در خواندن فایل: ${err.message}`]);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">ورود گروهی مخاطبین</h2>
            
            <div className="mb-6">
                <p className="mb-4 text-gray-600">
                    لطفا فایل اکسل شامل ستون‌های: "نام", "نام خانوادگی", "سازمان", "سمت", "شماره تلفن", "ایمیل" را انتخاب کنید.
                </p>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                    <FileUploadIcon className="ml-2" /> انتخاب فایل
                </Button>
            </div>

            {isProcessing && <div className="flex items-center text-blue-600"><Spinner className="ml-2" /> در حال پردازش...</div>}

            {logs.length > 0 && (
                <div className="mt-6 bg-gray-50 p-4 rounded border max-h-64 overflow-y-auto">
                    <h3 className="font-bold mb-2">گزارش عملیات:</h3>
                    <ul className="list-disc list-inside text-sm">
                        {logs.map((l, i) => <li key={i} className="text-gray-700">{l}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};