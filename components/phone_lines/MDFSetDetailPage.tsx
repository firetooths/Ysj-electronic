
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabaseContext } from '../../SupabaseContext';
import { Node, NodeType, RouteNode } from '../../types';
import { getLinesForNode, updateNodeConfig } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { NodeIcon, PrintIcon } from '../ui/Icons';
import { MDFPortModal } from './MDFPortModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPdfFont } from '../../utils/fontManager';
import { VAZIRMATN_BASE64 } from '../../utils/vazirmatnFont';

// Helper to normalize port address for comparison/storage
// Returns "Set-Terminal-Port" string (e.g. "1-6-8") and DB format (e.g. "168")
const getPortAddresses = (set: number, terminal: number, port: number) => {
    // Logic: Terminal 10 -> '0', Port 10 -> '0'
    const terminalDigit = terminal === 10 ? '0' : String(terminal);
    const portDigit = port === 10 ? '0' : String(port);
    const dbFormat = `${set}${terminalDigit}${portDigit}`;
    const uiFormat = `${set}-${terminal}-${port}`;
    return { dbFormat, uiFormat };
};

export const MDFSetDetailPage: React.FC = () => {
    const { nodeId, setNumber } = useParams<{ nodeId: string, setNumber: string }>();
    const navigate = useNavigate();
    const { nodes, refreshNodes, isLoading: isContextLoading } = useSupabaseContext();
    
    const [node, setNode] = useState<Node | null>(null);
    const [routeNodes, setRouteNodes] = useState<RouteNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPort, setSelectedPort] = useState<{set: number, terminal: number, port: number} | null>(null);
    const [isPortModalOpen, setIsPortModalOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const setNum = parseInt(setNumber || '1', 10);

    const loadData = useCallback(async () => {
        if (!nodeId) return;
        setIsLoading(true);
        try {
            const foundNode = nodes.find(n => n.id === nodeId);
            if (foundNode) {
                setNode(foundNode);
                const lines = await getLinesForNode(foundNode.id);
                setRouteNodes(lines);
            }
        } catch (e) {
            console.error("Error loading MDF details", e);
        } finally {
            setIsLoading(false);
        }
    }, [nodeId, nodes]);

    useEffect(() => {
        if (!isContextLoading) {
            loadData();
        }
    }, [isContextLoading, loadData]);

    const handleSaveNodeConfig = async (newConfig: any) => {
        if (!node) return;
        try {
            await updateNodeConfig(node.id, newConfig);
            await refreshNodes();
            // Optimistic update for immediate UI refresh
            setNode(prev => prev ? ({ ...prev, config: newConfig }) : null);
        } catch (e) {
            alert('خطا در ذخیره تنظیمات');
        }
    };

    const handleTerminalNameChange = (terminalIdx: number, newName: string) => {
        if (!node) return;
        const key = `${setNum}-${terminalIdx}`;
        const newLabels = { ...(node.config.terminalLabels || {}), [key]: newName };
        handleSaveSaveDebounced(newLabels);
    };

    // Simple debounce for terminal name input
    const handleSaveSaveDebounced = useCallback((newLabels: Record<string, string>) => {
        if (!node) return;
        const newConfig = { ...node.config, terminalLabels: newLabels };
        updateNodeConfig(node!.id, newConfig).then(refreshNodes);
    }, [node, refreshNodes]);


    const handlePortClick = (terminal: number, port: number) => {
        setSelectedPort({ set: setNum, terminal, port });
        setIsPortModalOpen(true);
    };

    const handlePortModalClose = () => {
        setIsPortModalOpen(false);
        setSelectedPort(null);
        loadData(); // Refresh lines in case of updates (e.g. faults changed status although not direct here)
        refreshNodes(); // Refresh config in case of name/status change
    };

    const handlePrint = async () => {
        if (!node) return;
        setIsPrinting(true);

        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // --- Font Setup ---
            let fontName = 'Vazirmatn';
            try {
                const customFont = await getPdfFont();
                if (customFont) {
                    fontName = customFont.name;
                    doc.addFileToVFS(`${fontName}.ttf`, customFont.base64);
                    doc.addFont(`${fontName}.ttf`, fontName, 'normal');
                    doc.addFont(`${fontName}.ttf`, fontName, 'bold'); // Register bold to prevent fallback
                } else {
                    doc.addFileToVFS('Vazirmatn.ttf', VAZIRMATN_BASE64);
                    doc.addFont('Vazirmatn.ttf', 'Vazirmatn', 'normal');
                    doc.addFont('Vazirmatn.ttf', 'Vazirmatn', 'bold'); // Register bold to prevent fallback
                }
                doc.setFont(fontName);
            } catch (e) {
                console.error("Font load error", e);
                // Fallback attempt
                try {
                    doc.addFileToVFS('Vazirmatn.ttf', VAZIRMATN_BASE64);
                    doc.addFont('Vazirmatn.ttf', 'Vazirmatn', 'normal');
                    doc.addFont('Vazirmatn.ttf', 'Vazirmatn', 'bold');
                    doc.setFont('Vazirmatn');
                    fontName = 'Vazirmatn';
                } catch(fallbackErr) {
                    fontName = 'helvetica';
                }
            }

            // --- Header ---
            const dateStr = new Date().toLocaleDateString('fa-IR');
            doc.setFontSize(14);
            // Title centered
            doc.text(`جدول ارتباطات - مجموعه ${setNum} - ${node.name}`, 105, 15, { align: 'center' });
            
            doc.setFontSize(10);
            // Date top-left (visually left in RTL means left coordinate)
            doc.text(`تاریخ: ${dateStr}`, 20, 15, { align: 'left' });

            // --- Table Data Preparation ---
            // 11 Columns: Col 0 = Terminal Name, Cols 1-10 = Ports
            // 11 Rows: Row 0 = Header (Port #), Rows 1-10 = Terminals
            
            // Header Row (Port Numbers)
            const headRow = ['ترمینال / پورت'];
            for (let i = 1; i <= 10; i++) headRow.push(String(i));

            const bodyRows = [];

            // Loop Terminals 1 to 10
            for (let t = 1; t <= 10; t++) {
                const rowData = [];
                
                // Column 0: Terminal Number & Name
                let termLabel = String(t);
                const customTermLabel = node.config.terminalLabels?.[`${setNum}-${t}`];
                if (customTermLabel) {
                    termLabel += `\n(${customTermLabel})`;
                }
                rowData.push(termLabel);

                // Columns 1-10: Ports
                for (let p = 1; p <= 10; p++) {
                    const { dbFormat } = getPortAddresses(setNum, t, p);
                    
                    // Find Data
                    const conn = routeNodes.find(rn => rn.port_address === dbFormat);
                    const portDetails = node.config.portDetails?.[dbFormat];
                    
                    const phone = conn?.phone_line?.phone_number || '';
                    const consumer = conn?.phone_line?.consumer_unit || '';
                    const customName = portDetails?.customName || '';
                    
                    // Combine into 3 lines
                    const cellContent = `${phone}\n${consumer}\n${customName}`.trim();
                    rowData.push(cellContent);
                }
                bodyRows.push(rowData);
            }

            // --- Layout Calculations ---
            const pageHeight = doc.internal.pageSize.height;
            const targetTableHeight = pageHeight * 0.80; 
            const rowHeight = targetTableHeight / 11;

            autoTable(doc, {
                head: [headRow],
                body: bodyRows,
                startY: 25,
                theme: 'grid',
                styles: {
                    font: fontName,
                    fontSize: 7, // Small font to fit 3 lines
                    halign: 'center',
                    valign: 'middle',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                    textColor: [0, 0, 0],
                    cellPadding: 1,
                    minCellHeight: rowHeight
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    fontSize: 9
                },
                columnStyles: {
                    0: { 
                        fillColor: [240, 240, 240], // Gray background for Terminal column
                        fontStyle: 'bold',
                        cellWidth: 20
                    }
                    // Remaining columns (1-10) get auto-distributed equally
                },
                // Force row height
                didParseCell: (data) => {
                    data.row.height = rowHeight;
                }
            });

            doc.save(`MDF_Set_${setNum}_Chart.pdf`);

        } catch (err: any) {
            console.error("Print Error:", err);
            alert('خطا در ایجاد فایل PDF: ' + err.message);
        } finally {
            setIsPrinting(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (!node) return <div className="text-center p-10">گره یافت نشد.</div>;

    const terminalsCount = node.config.terminalsPerSet || 10;
    const portsPerTerminal = node.config.portsPerTerminal || 10;

    return (
        <div className="container mx-auto p-2 md:p-4 min-h-screen bg-gray-50">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <NodeIcon className="text-xl" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">جزئیات مجموعه {setNum} - {node.name}</h2>
                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>متصل</span>
                            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span>خراب</span>
                            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-gray-300 mr-1"></span>آزاد</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 mt-4 sm:mt-0">
                    <Button 
                        variant="secondary" 
                        onClick={handlePrint} 
                        disabled={isPrinting} 
                        loading={isPrinting}
                        title="چاپ جدول ماتریسی مجموعه"
                    >
                        <PrintIcon className="ml-2" /> چاپ جدول
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/phone-lines/mdf/${nodeId}`)}>
                        بازگشت به نمای کلی
                    </Button>
                </div>
            </div>

            {/* Terminals Grid */}
            <div className="space-y-4">
                {Array.from({ length: terminalsCount }, (_, i) => {
                    const terminalIdx = i + 1;
                    const terminalLabelKey = `${setNum}-${terminalIdx}`;
                    const terminalName = node.config.terminalLabels?.[terminalLabelKey] || '';

                    return (
                        <div key={terminalIdx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-4">
                            {/* Left: Terminal Name Input */}
                            <div className="w-full md:w-48 flex-shrink-0 flex flex-col gap-1">
                                <span className="text-xs font-bold text-gray-400">ترمینال {terminalIdx}</span>
                                <input 
                                    type="text" 
                                    placeholder="نام ترمینال..."
                                    className="border rounded px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-900"
                                    defaultValue={terminalName}
                                    onBlur={(e) => {
                                        if (e.target.value !== terminalName) {
                                            handleTerminalNameChange(terminalIdx, e.target.value);
                                        }
                                    }}
                                />
                            </div>

                            {/* Center: Ports (LTR Direction for 1-10 ordering) */}
                            <div className="flex-1 flex flex-wrap justify-center md:justify-start gap-2" dir="ltr">
                                {Array.from({ length: portsPerTerminal }, (_, j) => {
                                    const portIdx = j + 1;
                                    const { dbFormat } = getPortAddresses(setNum, terminalIdx, portIdx);
                                    
                                    // Find connection
                                    const connection = routeNodes.find(rn => rn.port_address === dbFormat);
                                    const isConnected = !!connection;
                                    const hasLineFault = connection?.phone_line?.has_active_fault;
                                    
                                    // Check physical port status from config
                                    const portDetails = node.config.portDetails?.[dbFormat];
                                    const isPhysicallyBroken = portDetails?.isPhysicallyBroken;
                                    
                                    let bgClass = "bg-gray-200 hover:bg-gray-300 border-gray-300"; // Default Gray
                                    if (isPhysicallyBroken) {
                                        bgClass = "bg-red-600 hover:bg-red-700 border-red-800 text-white"; // Broken Port
                                    } else if (hasLineFault) {
                                        bgClass = "bg-red-400 hover:bg-red-500 border-red-600 text-white"; // Line Fault
                                    } else if (isConnected) {
                                        bgClass = "bg-green-500 hover:bg-green-600 border-green-700 text-white"; // Connected
                                    }

                                    return (
                                        <div 
                                            key={portIdx}
                                            onClick={() => handlePortClick(terminalIdx, portIdx)}
                                            className={`
                                                w-10 h-10 md:w-12 md:h-12 rounded flex items-center justify-center 
                                                cursor-pointer transition-all duration-200 border shadow-sm
                                                ${bgClass}
                                            `}
                                            title={`پورت ${portIdx}${connection ? ` - ${connection.phone_line?.phone_number}` : ''}`}
                                        >
                                            <span className="text-xs font-bold">{portIdx}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Right: Terminal Label (Read only or same as left?) - Sketch implied label on right too */}
                            <div className="hidden md:block w-16 text-center text-gray-400 text-sm font-mono rotate-90 md:rotate-0">
                                {terminalIdx}
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedPort && (
                <MDFPortModal
                    isOpen={isPortModalOpen}
                    onClose={handlePortModalClose}
                    node={node}
                    set={selectedPort.set}
                    terminal={selectedPort.terminal}
                    port={selectedPort.port}
                    routeNodes={routeNodes}
                    onConfigUpdate={handleSaveNodeConfig}
                />
            )}
        </div>
    );
};
