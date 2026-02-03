
import React, { useState, useEffect } from 'react';
import { useSupabaseContext } from '../../SupabaseContext';
import { Tag } from '../../types';
import { createTag, updateTag, deleteTag, checkTagUsage } from '../../supabaseService';
import { getPhoneLinesByTagId } from '../../services/phoneLineService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, InfoIcon, ExportIcon } from '../ui/Icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPdfFont } from '../../utils/fontManager';
import { VAZIRMATN_BASE64 } from '../../utils/vazirmatnFont';

export const TagManagementPage: React.FC = () => {
    const { tags, refreshTags, isLoading: isContextLoading } = useSupabaseContext();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTag, setCurrentTag] = useState<Tag | null>(null);
    const [tagName, setTagName] = useState('');
    const [tagColor, setTagColor] = useState('#6c757d');

    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [tagUsageCount, setTagUsageCount] = useState(0);
    
    // Export state
    const [exportingTagId, setExportingTagId] = useState<string | null>(null);

    useEffect(() => {
        if (!isContextLoading) setIsLoading(false);
    }, [isContextLoading]);

    const handleOpenCreate = () => {
        setCurrentTag(null);
        setTagName('');
        setTagColor('#6c757d');
        setValidationError(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (tag: Tag) => {
        setCurrentTag(tag);
        setTagName(tag.name);
        setTagColor(tag.color);
        setValidationError(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tagName.trim()) {
            setValidationError('نام تگ اجباری است.');
            return;
        }
        
        const isDuplicate = tags.some(t => t.name.toLowerCase() === tagName.trim().toLowerCase() && t.id !== currentTag?.id);
        if (isDuplicate) {
            setValidationError('تگی با این نام از قبل وجود دارد.');
            return;
        }

        setIsSaving(true);
        try {
            const tagData = { name: tagName.trim(), color: tagColor };
            if (currentTag) {
                await updateTag(currentTag.id, tagData);
                alert('تگ با موفقیت ویرایش شد.');
            } else {
                await createTag(tagData);
                alert('تگ با موفقیت ایجاد شد.');
            }
            refreshTags();
            setIsModalOpen(false);
        } catch (err: any) {
            setError(`خطا در ذخیره‌سازی: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = async (tag: Tag) => {
        const usageCount = await checkTagUsage(tag.id);
        setTagUsageCount(usageCount);
        setTagToDelete(tag);
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!tagToDelete) return;
        setIsDeleting(true);
        try {
            await deleteTag(tagToDelete.id);
            alert('تگ با موفقیت حذف شد.');
            refreshTags();
            setIsDeleteConfirmOpen(false);
        } catch (err: any) {
            alert(`خطا در حذف تگ: ${err.message}`);
        } finally {
            setIsDeleting(false);
            setTagToDelete(null);
        }
    };

    const handleExportPdf = async (tag: Tag) => {
        setExportingTagId(tag.id);
        try {
            const lines = await getPhoneLinesByTagId(tag.id);
            
            if (lines.length === 0) {
                alert('هیچ خط تلفنی برای این تگ یافت نشد.');
                setExportingTagId(null);
                return;
            }

            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
            });

            // Load Font (Default to Vazirmatn if no custom font is set)
            let fontName = 'Vazirmatn';
            try {
                const customFont = await getPdfFont();
                if (customFont) {
                    fontName = customFont.name;
                    doc.addFileToVFS(`${fontName}.ttf`, customFont.base64);
                    doc.addFont(`${fontName}.ttf`, fontName, 'normal');
                } else {
                    doc.addFileToVFS('Vazirmatn.ttf', VAZIRMATN_BASE64);
                    doc.addFont('Vazirmatn.ttf', 'Vazirmatn', 'normal');
                }
                doc.setFont(fontName);
            } catch (e) {
                console.error("Font load error", e);
                try {
                    doc.addFileToVFS('Vazirmatn.ttf', VAZIRMATN_BASE64);
                    doc.addFont('Vazirmatn.ttf', 'Vazirmatn', 'normal');
                    doc.setFont('Vazirmatn');
                    fontName = 'Vazirmatn';
                } catch(fallbackErr) {
                    fontName = 'helvetica';
                }
            }

            // Header
            doc.setFontSize(14);
            const title = `لیست خطوط تگ: ${tag.name}`;
            const dateStr = `تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')}`;
            
            // RTL text handling for title
            doc.text(title, 280, 15, { align: 'right' });
            doc.setFontSize(10);
            doc.text(dateStr, 280, 22, { align: 'right' });

            // Table Data Construction
            // Columns (Visual Right to Left): Phone, Consumer, Port 1, Port 2, Port 3, Port 4, Port 5
            // In LTR Table (AutoTable): [P5, P4, P3, P2, P1, Consumer, Phone] with align: right/center
            
            const headers = [['پورت ۵', 'پورت ۴', 'پورت ۳', 'پورت ۲', 'پورت ۱', 'مصرف کننده', 'شماره تلفن']];
            
            const data = lines.map(line => {
                const row = [];
                
                // Route Nodes (Ports 1-5)
                // We fill backwards: P5 -> P1
                for (let i = 5; i >= 1; i--) {
                    const node = line.route_nodes?.find(rn => rn.sequence === i);
                    if (node) {
                        // Cell Content: Port Address (top) + Node Name (bottom)
                        // \n works in AutoTable for new line
                        const cellText = `${node.port_address}\n${node.node?.name || '-'}`;
                        row.push(cellText);
                    } else {
                        row.push('-');
                    }
                }
                
                // Consumer & Phone
                row.push(line.consumer_unit || '-');
                row.push(line.phone_number);
                
                return row;
            });

            autoTable(doc, {
                head: headers,
                body: data,
                startY: 30,
                theme: 'grid',
                styles: {
                    font: fontName, 
                    fontSize: 9,
                    halign: 'center',
                    valign: 'middle',
                    cellPadding: 2,
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200]
                },
                headStyles: {
                    fillColor: [79, 70, 229], // Indigo-600
                    textColor: [255, 255, 255],
                    fontStyle: 'normal',
                    halign: 'center'
                },
                // Force equal width for port columns if possible, though 'auto' usually works best with variable text.
                // We can set specific widths if needed.
                // P5 (col 0) to P1 (col 4) -> 5 columns
                // Consumer (col 5)
                // Phone (col 6)
                columnStyles: {
                    0: { cellWidth: 35 }, // P5
                    1: { cellWidth: 35 }, // P4
                    2: { cellWidth: 35 }, // P3
                    3: { cellWidth: 35 }, // P2
                    4: { cellWidth: 35 }, // P1
                    5: { cellWidth: 'auto' }, // Consumer - flexible
                    6: { cellWidth: 30, fontStyle: 'bold' }  // Phone
                }
            });

            doc.save(`PhoneLines_Tag_${tag.name}.pdf`);

        } catch (err: any) {
            alert('خطا در ایجاد فایل PDF: ' + err.message);
        } finally {
            setExportingTagId(null);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت تگ‌ها</h2>
                <Button variant="primary" onClick={handleOpenCreate}><AddIcon className="ml-2" /> افزودن تگ جدید</Button>
            </div>
            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

            <div className="space-y-3">
                {tags.length === 0 ? (
                    <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <InfoIcon className="fa-lg ml-3 text-blue-500" />
                        <span>هیچ تگی تعریف نشده است.</span>
                    </div>
                ) : (
                    tags.map(tag => (
                        <div key={tag.id} className="bg-gray-50 p-3 rounded-lg shadow-sm border flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex items-center">
                                <span style={{ backgroundColor: tag.color }} className="w-5 h-5 rounded-full ml-3 border border-gray-300"></span>
                                <span className="text-md font-medium text-gray-800">{tag.name}</span>
                            </div>
                            <div className="flex space-x-2 space-x-reverse">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleExportPdf(tag)} 
                                    disabled={exportingTagId === tag.id}
                                    title="دانلود لیست خطوط (PDF)"
                                >
                                    {exportingTagId === tag.id ? <Spinner className="w-4 h-4" /> : <ExportIcon className="text-green-600" />}
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(tag)} title="ویرایش"><EditIcon /></Button>
                                <Button variant="danger" size="sm" onClick={() => handleDeleteClick(tag)} title="حذف"><DeleteIcon /></Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentTag ? 'ویرایش تگ' : 'افزودن تگ جدید'}>
                <form onSubmit={handleSave} className="space-y-4 p-4">
                    <Input label="نام تگ" value={tagName} onChange={e => setTagName(e.target.value)} error={validationError} required />
                    <div className="flex items-center">
                        <label htmlFor="tag-color" className="block text-sm font-medium text-gray-700 ml-4">رنگ تگ</label>
                        <input type="color" id="tag-color" value={tagColor} onChange={e => setTagColor(e.target.value)} className="w-16 h-10 p-1 border border-gray-300 rounded-md cursor-pointer"/>
                    </div>
                    <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t">
                        <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>{isSaving ? 'در حال ذخیره...' : 'ذخیره'}</Button>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>لغو</Button>
                    </div>
                </form>
            </Modal>
            
            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="حذف تگ"
                message={`آیا از حذف تگ "${tagToDelete?.name}" مطمئن هستید؟ ${tagUsageCount > 0 ? `این تگ به ${tagUsageCount} خط تلفن اختصاص داده شده و از همه آنها حذف خواهد شد.` : ''}`}
                confirmText="حذف"
                isConfirming={isDeleting}
            />
        </div>
    );
};
