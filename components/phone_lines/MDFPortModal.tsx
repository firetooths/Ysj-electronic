
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Node, RouteNode, NodeConfig } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useSupabaseContext } from '../../SupabaseContext';
import { LogIcon, DetailsIcon } from '../ui/Icons';
import { batchUpdatePortAssignments, getPhoneLineDetailsByNumber } from '../../supabaseService';

interface MDFPortModalProps {
    isOpen: boolean;
    onClose: () => void;
    node: Node;
    set: number;
    terminal: number;
    port: number;
    routeNodes: RouteNode[];
    onConfigUpdate: (newConfig: NodeConfig) => void;
}

// Debounce hook to prevent excessive API calls
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export const MDFPortModal: React.FC<MDFPortModalProps> = ({ 
    isOpen, onClose, node, set, terminal, port, routeNodes, onConfigUpdate 
}) => {
    const navigate = useNavigate();
    const { wireColors } = useSupabaseContext();
    
    // Calculate DB Address format
    const terminalDigit = terminal === 10 ? '0' : String(terminal);
    const portDigit = port === 10 ? '0' : String(port);
    const dbAddress = `${set}${terminalDigit}${portDigit}`;

    // Find existing connection from props
    const connection = routeNodes.find(rn => rn.port_address === dbAddress);
    
    // Local State
    const [customName, setCustomName] = useState('');
    const [isBroken, setIsBroken] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [consumerUnit, setConsumerUnit] = useState('');
    
    // Wire Colors State
    const [wire1, setWire1] = useState('');
    const [wire2, setWire2] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const debouncedPhoneNumber = useDebounce(phoneNumber, 500);

    // Initialize state when the modal opens or the port changes.
    useEffect(() => {
        if (isOpen) {
            const currentPortDetails = node.config.portDetails?.[dbAddress];
            setCustomName(currentPortDetails?.customName || '');
            setIsBroken(currentPortDetails?.isPhysicallyBroken || false);
            
            // Find connection again inside effect to ensure we have latest from props at mount time
            const currentConn = routeNodes.find(rn => rn.port_address === dbAddress);
            if (currentConn && currentConn.phone_line) {
                setPhoneNumber(currentConn.phone_line.phone_number);
                setConsumerUnit(currentConn.phone_line.consumer_unit || '');
                setWire1(currentConn.wire_1_color_name || '');
                setWire2(currentConn.wire_2_color_name || '');
            } else {
                setPhoneNumber('');
                setConsumerUnit('');
                setWire1('');
                setWire2('');
            }
        }
    }, [isOpen, dbAddress]); 

    // Auto-populate consumer unit when phone number changes
    useEffect(() => {
        const fetchDetails = async () => {
            if (debouncedPhoneNumber && debouncedPhoneNumber.length > 2) {
                // If it's the same as initially loaded, don't re-fetch/overwrite unless user cleared unit
                if (connection && connection.phone_line?.phone_number === debouncedPhoneNumber && consumerUnit) return;

                try {
                    const details = await getPhoneLineDetailsByNumber(debouncedPhoneNumber);
                    if (details && details.consumer_unit) {
                        setConsumerUnit(details.consumer_unit);
                    }
                } catch (e) {
                    console.error("Error fetching line details", e);
                }
            }
        };
        fetchDetails();
    }, [debouncedPhoneNumber]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 1. Save Config (Port Name / Broken Status)
            const newDetails = { ...node.config.portDetails };
            
            // If empty name and not broken, remove entry to keep config clean
            if (!customName.trim() && !isBroken) {
                delete newDetails[dbAddress];
            } else {
                newDetails[dbAddress] = {
                    customName: customName.trim(),
                    isPhysicallyBroken: isBroken
                };
            }

            const newConfig = { ...node.config, portDetails: newDetails };
            await onConfigUpdate(newConfig);

            // 2. Save Phone Assignment & Wires (If changed)
            const originalPhone = connection?.phone_line?.phone_number || '';
            const originalUnit = connection?.phone_line?.consumer_unit || '';
            const originalWire1 = connection?.wire_1_color_name || '';
            const originalWire2 = connection?.wire_2_color_name || '';

            // Check if ANY phone data or wire data changed
            const phoneChanged = phoneNumber.trim() !== originalPhone || consumerUnit.trim() !== originalUnit;
            const wiresChanged = wire1 !== originalWire1 || wire2 !== originalWire2;

            if (phoneChanged || wiresChanged) {
                const changes = {
                    deletions: [] as string[],
                    creations: [] as any[]
                };

                // If there was a connection, mark it for deletion (to be replaced or removed)
                if (connection) {
                    changes.deletions.push(connection.id);
                }

                // If there is a new phone number, add creation request with wires
                if (phoneNumber.trim()) {
                    changes.creations.push({
                        phoneNumber: phoneNumber.trim(),
                        consumerUnit: consumerUnit.trim() || null,
                        nodeId: node.id,
                        portAddress: dbAddress,
                        wire1: wire1 || null,
                        wire2: wire2 || null
                    });
                }

                if (changes.deletions.length > 0 || changes.creations.length > 0) {
                    await batchUpdatePortAssignments(changes.deletions, changes.creations, node);
                }
            }

            onClose();
        } catch (error) {
            console.error("Error saving port details:", error);
            alert("خطا در ذخیره اطلاعات.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`جزئیات پورت: مجموعه ${set}، ترمینال ${terminal}، پورت ${port}`}>
            <div className="p-4 space-y-6">
                
                {/* 1. Connection Info (Editable) */}
                <div className={`p-4 rounded-lg border-2 ${phoneNumber ? (connection?.phone_line?.has_active_fault ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200') : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-gray-800">وضعیت اتصال:</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${phoneNumber ? 'bg-white text-green-700 shadow-sm' : 'bg-gray-200 text-gray-500'}`}>
                            {phoneNumber ? 'متصل' : 'آزاد'}
                        </span>
                    </div>
                    
                    <div className="space-y-3">
                        <Input 
                            label="شماره تلفن"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="مثال: 33310000"
                            dir="ltr"
                            className="text-left font-mono font-bold"
                        />
                        <Input 
                            label="واحد مصرف کننده"
                            value={consumerUnit}
                            onChange={(e) => setConsumerUnit(e.target.value)}
                            placeholder="مثال: واحد مالی"
                        />

                        {/* Wire Colors Section (Editable) */}
                        <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-gray-200/50">
                            <Select 
                                label="رنگ سیم ۱"
                                options={[{ value: '', label: 'انتخاب کنید' }, ...wireColors.map(c => ({ value: c.name, label: c.name }))]}
                                value={wire1}
                                onChange={e => setWire1(e.target.value)}
                                fullWidth
                            />
                            <Select 
                                label="رنگ سیم ۲"
                                options={[{ value: '', label: 'انتخاب کنید' }, ...wireColors.map(c => ({ value: c.name, label: c.name }))]}
                                value={wire2}
                                onChange={e => setWire2(e.target.value)}
                                fullWidth
                            />
                        </div>
                        
                        {/* Action Buttons (Only show if saved connection exists) */}
                        {connection && (
                            <div className="flex gap-2 mt-4 pt-2 border-t border-gray-300">
                                <Button size="sm" variant="outline" onClick={() => { onClose(); navigate(`/phone-lines/view/${connection.phone_line?.phone_number}`); }}>
                                    <DetailsIcon className="ml-1" /> مسیر کامل
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Port Configuration */}
                <div className="space-y-4">
                    <Input 
                        label="نام اختصاصی پورت (برچسب)" 
                        placeholder="مثال: رزرو واحد مالی"
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                    />
                    
                    <div className="flex items-center justify-between bg-red-50 p-3 rounded border border-red-100">
                        <label className="text-sm font-medium text-red-800 cursor-pointer" htmlFor="port-broken-checkbox">
                            علامت‌گذاری به عنوان پورت خراب (فیزیکی)
                        </label>
                        <input 
                            type="checkbox" 
                            id="port-broken-checkbox"
                            checked={isBroken}
                            onChange={e => setIsBroken(e.target.checked)}
                            className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>انصراف</Button>
                    <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>ذخیره تغییرات</Button>
                </div>
            </div>
        </Modal>
    );
};
