
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabaseContext } from '../../SupabaseContext';
import { Node, NodeType } from '../../types';
import { updateNodeConfig } from '../../services/nodeService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Input } from '../ui/Input';
import { SettingsIcon, NodeIcon } from '../ui/Icons';

export const MDFOverviewPage: React.FC = () => {
    const { nodeId } = useParams<{ nodeId: string }>();
    const navigate = useNavigate();
    const { nodes, refreshNodes, isLoading: isContextLoading } = useSupabaseContext();
    
    const [node, setNode] = useState<Node | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Layout State
    const [rows, setRows] = useState(1);
    const [cols, setCols] = useState(4);
    const [mapping, setMapping] = useState<Record<string, number>>({});
    const [isConfigMode, setIsConfigMode] = useState(false);

    useEffect(() => {
        if (!isContextLoading && nodeId) {
            const foundNode = nodes.find(n => n.id === nodeId);
            if (foundNode) {
                setNode(foundNode);
                
                // Initialize state from existing config if available
                if (foundNode.config.layout) {
                    setRows(foundNode.config.layout.rows);
                    setCols(foundNode.config.layout.cols);
                    setMapping(foundNode.config.layout.mapping || {});
                } else {
                    // Default: 1 Row, N Cols (N = number of sets)
                    const totalSets = foundNode.config.sets || 1;
                    setRows(1);
                    setCols(totalSets);
                    // Default mapping: sequential
                    const initialMapping: Record<string, number> = {};
                    for (let i = 0; i < totalSets; i++) {
                        initialMapping[`0-${i}`] = i + 1;
                    }
                    setMapping(initialMapping);
                }
            }
            setIsLoading(false);
        }
    }, [isContextLoading, nodeId, nodes]);

    const handleLayoutChange = async () => {
        if (!node) return;
        setIsSaving(true);
        try {
            const newConfig = {
                ...node.config,
                layout: {
                    rows,
                    cols,
                    mapping
                }
            };
            await updateNodeConfig(node.id, newConfig);
            await refreshNodes();
            setIsConfigMode(false);
            alert('چیدمان با موفقیت ذخیره شد.');
        } catch (error) {
            console.error(error);
            alert('خطا در ذخیره چیدمان.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetAssignment = (rowIndex: number, colIndex: number, setNumberStr: string) => {
        const setNumber = parseInt(setNumberStr, 10);
        const key = `${rowIndex}-${colIndex}`;
        
        const newMapping = { ...mapping };
        
        if (isNaN(setNumber)) {
            delete newMapping[key];
        } else {
            // Check if this set is already assigned elsewhere? 
            // For now, allow duplicates/moves, but maybe visually highlight them later.
            newMapping[key] = setNumber;
        }
        setMapping(newMapping);
    };

    const handleSetClick = (setNumber: number) => {
        // Navigate to the set detail page
        navigate(`/phone-lines/mdf/${nodeId}/set/${setNumber}`);
    };

    if (isLoading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (!node) return <div className="text-center p-10">گره یافت نشد.</div>;
    if (node.type !== NodeType.MDF) return <div className="text-center p-10">این قابلیت فقط برای MDF فعال است.</div>;

    const totalSets = node.config.sets || 0;
    const availableSets = Array.from({ length: totalSets }, (_, i) => i + 1);

    // Create Grid Items
    const gridItems = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            gridItems.push({ row: r, col: c, key: `${r}-${c}` });
        }
    }

    return (
        <div className="container mx-auto p-4 md:p-6 min-h-screen bg-gray-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <NodeIcon className="text-2xl" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">نمای کلی MDF: {node.name}</h2>
                        <p className="text-sm text-gray-500">{totalSets} مجموعه تعریف شده</p>
                    </div>
                </div>
                <div className="flex gap-2 mt-4 md:mt-0">
                    <Button variant="secondary" onClick={() => setIsConfigMode(!isConfigMode)}>
                        <SettingsIcon className="ml-2" /> 
                        {isConfigMode ? 'بستن تنظیمات' : 'تنظیم چیدمان'}
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/phone-lines/nodes')}>
                        بازگشت
                    </Button>
                </div>
            </div>

            {/* Configuration Panel */}
            {isConfigMode && (
                <div className="bg-white p-6 rounded-xl shadow-md mb-6 animate-fade-in">
                    <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">تنظیمات ماتریس</h3>
                    <div className="flex flex-wrap items-end gap-4">
                        <Input 
                            label="تعداد سطر" 
                            type="number" 
                            value={rows} 
                            onChange={e => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24"
                        />
                        <Input 
                            label="تعداد ستون" 
                            type="number" 
                            value={cols} 
                            onChange={e => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24"
                        />
                        <Button variant="primary" onClick={handleLayoutChange} loading={isSaving}>
                            ذخیره و اعمال
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        پس از تغییر ابعاد، شماره مجموعه‌ها را در خانه‌های مربوطه وارد کنید.
                    </p>
                </div>
            )}

            {/* The Grid Visualization */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
                <div 
                    className="grid gap-4 mx-auto"
                    style={{
                        gridTemplateColumns: `repeat(${cols}, minmax(120px, 1fr))`,
                        width: 'fit-content',
                        minWidth: '100%'
                    }}
                >
                    {gridItems.map(item => {
                        const assignedSet = mapping[item.key];
                        
                        return (
                            <div 
                                key={item.key} 
                                className={`
                                    relative border-2 rounded-lg p-2 flex flex-col items-center justify-between transition-all duration-300
                                    h-64 
                                    ${assignedSet 
                                        ? 'border-indigo-500 bg-indigo-50 shadow-md hover:shadow-lg hover:-translate-y-1' 
                                        : 'border-dashed border-gray-300 bg-gray-50 opacity-70'}
                                `}
                                onClick={() => assignedSet && !isConfigMode ? handleSetClick(assignedSet) : null}
                            >
                                {/* Header / Selector */}
                                <div className="w-full mb-2" onClick={e => e.stopPropagation()}>
                                    {isConfigMode ? (
                                        <select 
                                            className="w-full text-xs p-1 border rounded bg-white"
                                            value={assignedSet || ''}
                                            onChange={(e) => handleSetAssignment(item.row, item.col, e.target.value)}
                                        >
                                            <option value="">خالی</option>
                                            {availableSets.map(s => (
                                                <option key={s} value={s}>مجموعه {s}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="text-center font-bold text-indigo-800 border-b border-indigo-200 pb-1">
                                            {assignedSet ? `مجموعه ${assignedSet}` : 'خالی'}
                                        </div>
                                    )}
                                </div>

                                {/* Body Representation (Vertical Terminals) */}
                                {assignedSet && (
                                    <div className="flex-1 w-full flex flex-col justify-center items-center gap-1 opacity-50">
                                        {/* Visual representation of terminals inside the set */}
                                        <div className="w-4/5 h-1 bg-indigo-300 rounded"></div>
                                        <div className="w-4/5 h-1 bg-indigo-300 rounded"></div>
                                        <div className="w-4/5 h-1 bg-indigo-300 rounded"></div>
                                        <div className="text-[10px] text-indigo-400 my-1">...</div>
                                        <div className="w-4/5 h-1 bg-indigo-300 rounded"></div>
                                        <div className="w-4/5 h-1 bg-indigo-300 rounded"></div>
                                    </div>
                                )}

                                {/* Footer info */}
                                {assignedSet && !isConfigMode && (
                                    <button className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full mt-2 hover:bg-indigo-700 w-full">
                                        مشاهده
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
