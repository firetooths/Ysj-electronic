
import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Node, RouteNode } from '../../types';
import { Spinner } from '../ui/Spinner';
import { getLinesForNode } from '../../supabaseService';
import { InfoIcon, ExportIcon } from '../ui/Icons';
import { ColorDisplay } from '../ui/ColorDisplay';
import { useSupabaseContext } from '../../SupabaseContext';
import { Button } from '../ui/Button';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPdfFont } from '../../utils/fontManager';
import { VAZIRMATN_BASE64 } from '../../utils/vazirmatnFont';

interface ConnectedLinesModalProps {
    isOpen: boolean;
    onClose: () => void;
    node: Node;
}

export const ConnectedLinesModal: React.FC<ConnectedLinesModalProps> = ({ isOpen, onClose, node }) => {
    const [connectedLines, setConnectedLines] = useState<RouteNode[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const { wireColors } = useSupabaseContext();

    const fetchConnectedLines = useCallback(async () => {
        if (!node) return;
        setIsLoading(true);
        setError(null);
        try {
            const lines = await getLinesForNode(node.id);
            lines.sort((a, b) => a.port_address.localeCompare(b.port_address, undefined, { numeric: true }));
            setConnectedLines(lines);
        } catch (err: any) {
            setError(`خطا در بارگذاری خطوط متصل: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [node]);

    useEffect(() => {
        if (isOpen) {
            fetchConnectedLines();
        }
    }, [isOpen, fetchConnectedLines]);

    const handleExportPdf = async () => {
        if (connectedLines.length === 0) return;
        setIsExporting(true);

        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            // Load Font logic
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
                    console.error("Fallback font error", fallbackErr);
                    fontName = 'helvetica';
                }
            }

            // Header
            doc.setFontSize(14);
            // Right align title
            const fullTitle = `لیست خطوط متصل به گره: ${node.name}`;
            const fullDate = `تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')}`;
            
            // In pure jsPDF with a supporting font, right alignment often handles the visual order correctly
            // if we don't manually reverse words.
            doc.text(fullTitle, 190, 15, { align: 'right' });
            
            doc.setFontSize(10);
            doc.text(fullDate, 190, 22, { align: 'right' });

            // Table Data
            // We want visual order: [Wire 2] [Wire 1] [Unit] [Phone] [Port]
            // Since jspdf-autotable draws column 0 on the LEFT, we map our data:
            // Col 0 (Left): Wire 2
            // Col 1: Wire 1
            // Col 2: Unit
            // Col 3: Phone
            // Col 4 (Right): Port
            
            const headers = [['رنگ سیم ۲', 'رنگ سیم ۱', 'مصرف کننده', 'شماره تلفن', 'آدرس پورت']];
            
            const data = connectedLines.map(line => {
                const color1Name = line.wire_1_color_name || '-';
                const color2Name = line.wire_2_color_name || '-';
                const unit = line.phone_line?.consumer_unit || '-';
                const phone = line.phone_line?.phone_number || '-';
                const port = line.port_address;
                
                return [
                    color2Name,
                    color1Name,
                    unit,
                    phone,
                    port
                ];
            });

            autoTable(doc, {
                head: headers,
                body: data,
                startY: 30,
                theme: 'grid',
                styles: {
                    font: fontName, 
                    fontSize: 9,
                    halign: 'right', // Right align all text for RTL feel
                    cellPadding: 2,
                },
                headStyles: {
                    fillColor: [79, 70, 229], 
                    textColor: [255, 255, 255],
                    fontStyle: 'normal', // CRITICAL: Force normal to use the loaded Vazirmatn font, avoiding Helvetica fallback
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 30, halign: 'center' }, // Wire 2
                    1: { cellWidth: 30, halign: 'center' }, // Wire 1
                    2: { cellWidth: 'auto' }, // Unit (Right aligned by default styles)
                    3: { cellWidth: 30, halign: 'center' }, // Phone
                    4: { cellWidth: 25, fontStyle: 'normal', halign: 'center' }  // Port
                },
                didDrawCell: (data) => {
                    // Draw colored circle
                    if (data.section === 'body' && (data.column.index === 0 || data.column.index === 1)) {
                        const originalIndex = data.row.index;
                        const line = connectedLines[originalIndex];
                        const colorName = data.column.index === 1 ? line.wire_1_color_name : line.wire_2_color_name;
                        const colorDef = wireColors.find(c => c.name === colorName);
                        
                        if (colorDef && colorDef.value) {
                            const hex = colorDef.value.split('|')[0];
                            if (hex.startsWith('#')) {
                                const r = parseInt(hex.slice(1, 3), 16);
                                const g = parseInt(hex.slice(3, 5), 16);
                                const b = parseInt(hex.slice(5, 7), 16);
                                
                                // Draw circle. Since text is centered, we put circle slightly to the right of text?
                                // Or since it's a table cell, maybe just put it near the text.
                                // Let's put it to the right of the cell content area
                                doc.setFillColor(r, g, b);
                                doc.circle(data.cell.x + data.cell.width - 6, data.cell.y + (data.cell.height / 2), 1.5, 'F');
                            }
                        }
                    }
                }
            });

            doc.save(`Node_${node.name}_Lines.pdf`);

        } catch (err: any) {
            alert('خطا در ایجاد فایل PDF: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-48"><Spinner /></div>;
        }

        if (error) {
            return <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>;
        }

        if (connectedLines.length === 0) {
            return (
                <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <InfoIcon className="fa-lg ml-3 text-blue-500" />
                    <span>هیچ خط تلفنی به این گره متصل نیست.</span>
                </div>
            );
        }

        return (
            <>
                <div className="flex justify-end mb-4 px-1">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={handleExportPdf} 
                        disabled={isExporting} 
                        loading={isExporting}
                        title="دانلود لیست به صورت PDF"
                    >
                        <ExportIcon className="ml-2" /> دانلود لیست (PDF)
                    </Button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره پورت/آدرس</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره تلفن</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مصرف کننده/واحد</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">رنگ سیم ۱</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">رنگ سیم ۲</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {connectedLines.map(line => {
                                const color1 = wireColors.find(c => c.name === line.wire_1_color_name);
                                const color2 = wireColors.find(c => c.name === line.wire_2_color_name);
                                return (
                                    <tr key={line.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 font-mono">{line.port_address}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{line.phone_line?.phone_number || '---'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{line.phone_line?.consumer_unit || '---'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <ColorDisplay value={color1?.value || ''} name={line.wire_1_color_name || 'نامشخص'} />
                                                <span className="text-xs text-gray-500">{line.wire_1_color_name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <ColorDisplay value={color2?.value || ''} name={line.wire_2_color_name || 'نامشخص'} />
                                                <span className="text-xs text-gray-500">{line.wire_2_color_name || '-'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </>
        );
    };


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`خطوط متصل به گره: ${node?.name}`} className="sm:max-w-4xl">
            {renderContent()}
        </Modal>
    );
};
