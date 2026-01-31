import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Node, NodeType, PortAssignment } from '../../types';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { getLinesForNode, getPhoneLineDetailsByNumber, batchUpdatePortAssignments } from '../../supabaseService';

interface PortAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    node: Node;
}

// Debounce helper
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


export const PortAssignmentModal: React.FC<PortAssignmentModalProps> = ({ isOpen, onClose, node }) => {
    // Selection state
    const [selectedSet, setSelectedSet] = useState('1');
    const [selectedTerminal, setSelectedTerminal] = useState('1');
    const [selectedSlot, setSelectedSlot] = useState('1');

    // Data state
    const [assignments, setAssignments] = useState<PortAssignment[]>([]);
    const [initialAssignments, setInitialAssignments] = useState<PortAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const activePhoneNumberRef = useRef<string | null>(null);
    
    // Determine the number of ports to display based on node type and selection
    const getPortCount = useCallback(() => {
         if (!node || !node.config) return 0;
         switch(node.config.type) {
            case NodeType.MDF:
                return node.config.portsPerTerminal || 10;
            case NodeType.SLOT_DEVICE:
                return node.config.portsPerSlot || 0;
            case NodeType.CONVERTER:
            case NodeType.SOCKET:
                return node.config.ports || 0;
            default:
                return 0;
        }
    }, [node]);

    const fetchAssignments = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const portCount = getPortCount();
            if (portCount === 0 && node.config.type !== NodeType.MDF) { // MDF might need selection first, but usually has defaults
                 // Allow 0 for MDF until loaded, but for others warn if config is missing
            }

            const allNodeConnections = await getLinesForNode(node.id);
            
            const newAssignments: PortAssignment[] = [];
            
            for (let i = 1; i <= portCount; i++) {
                let portAddress = '';
                let searchAddresses: string[] = []; // Array to check for legacy/alternative formats

                // --- Address Generation Logic ---
                if (node.config.type === NodeType.MDF) {
                    // MDF Logic: Terminal 10 -> '0', Port 10 -> '0'
                    const terminalDigit = selectedTerminal === '10' ? '0' : selectedTerminal;
                    const portDigit = i === 10 ? '0' : i;
                    
                    portAddress = `${selectedSet}${terminalDigit}${portDigit}`;
                    
                    // Legacy formats to check against DB
                    searchAddresses = [
                        portAddress, 
                        `${selectedSet}/${selectedTerminal}/${i}`, // 1/1/1
                        `${selectedSet}${selectedTerminal}${i}`    // 111 (without 0 logic)
                    ];

                } else if (node.config.type === NodeType.SLOT_DEVICE) {
                    // Slot Device Logic: Slot/Port (e.g., 1/1, 2/15)
                    portAddress = `${selectedSlot}/${i}`;
                    
                    // Legacy formats to check
                    searchAddresses = [
                        portAddress,
                        `${selectedSlot}${String(i).padStart(2, '0')}`, // 101, 102...
                        `${selectedSlot}-${i}`
                    ];

                } else {
                    // Converter/Socket Logic: Just the port number
                    portAddress = String(i);
                    searchAddresses = [portAddress];
                }

                // Find existing connection using any known format
                const existing = allNodeConnections.find(l => searchAddresses.includes(l.port_address));

                newAssignments.push({
                    portAddress, // This is the normalized address we will use for display/save
                    phoneNumber: existing?.phone_line?.phone_number || '',
                    consumerUnit: existing?.phone_line?.consumer_unit || null,
                    phoneLineId: existing?.line_id || null,
                    routeNodeId: existing?.id || null,
                });
            }

            setAssignments(newAssignments);
            setInitialAssignments(JSON.parse(JSON.stringify(newAssignments))); // Deep copy
        } catch (err: any) {
            console.error("Error fetching assignments:", err);
            setError(`خطا در بارگذاری پورت‌ها: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [node.id, node.config, selectedSet, selectedTerminal, selectedSlot, getPortCount]);


    useEffect(() => {
        if (isOpen) {
            fetchAssignments();
        }
    }, [isOpen, fetchAssignments, selectedSet, selectedTerminal, selectedSlot]); // Re-fetch when selection changes
    
    const handlePhoneNumberChange = (portAddress: string, newPhoneNumber: string) => {
        activePhoneNumberRef.current = newPhoneNumber;
        setAssignments(prev => prev.map(a => a.portAddress === portAddress ? { ...a, phoneNumber: newPhoneNumber, consumerUnit: '...' } : a));
    };

    const debouncedPhoneNumber = useDebounce(activePhoneNumberRef.current || '', 500);

    useEffect(() => {
        const fetchConsumerUnit = async () => {
            // Find which assignment is being edited (has '...')
            const editingAssignment = assignments.find(a => a.phoneNumber === debouncedPhoneNumber && a.consumerUnit === '...');
            
            if (!debouncedPhoneNumber || !editingAssignment) {
                 // Clean up any stuck loading states
                 setAssignments(prev => prev.map(a => a.consumerUnit === '...' ? {...a, consumerUnit: null} : a));
                return;
            }

            try {
                const lineDetails = await getPhoneLineDetailsByNumber(debouncedPhoneNumber);
                setAssignments(prev => prev.map(a => a.phoneNumber === debouncedPhoneNumber ? { ...a, consumerUnit: lineDetails?.consumer_unit || 'شماره جدید' } : a));
            } catch (err) {
                 setAssignments(prev => prev.map(a => a.phoneNumber === debouncedPhoneNumber ? { ...a, consumerUnit: 'خطا در استعلام' } : a));
            }
        };

        if(debouncedPhoneNumber) {
            fetchConsumerUnit();
        }
    }, [debouncedPhoneNumber]); // Remove 'assignments' dependency to avoid loop
    
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        try {
            const changes = {
                deletions: [] as string[],
                creations: [] as { phoneNumber: string; consumerUnit: string | null; nodeId: string; portAddress: string; }[]
            };

            for (const current of assignments) {
                const initial = initialAssignments.find(i => i.portAddress === current.portAddress);

                const currentHasNumber = current.phoneNumber.trim() !== '';
                const initialHasNumber = initial?.phoneNumber.trim() !== '';

                if (initialHasNumber && !currentHasNumber) {
                    // Deletion: had a number, now it's empty
                    if (initial?.routeNodeId) changes.deletions.push(initial.routeNodeId);
                } else if (currentHasNumber && (!initialHasNumber || initial?.phoneNumber !== current.phoneNumber)) {
                    // Creation or Update
                    // If it was an update, first delete the old one
                    if (initialHasNumber && initial?.routeNodeId) {
                        changes.deletions.push(initial.routeNodeId);
                    }
                    // Then add the new one
                    // Ensure consumerUnit isn't '...' during save
                    let finalConsumerUnit = current.consumerUnit;
                    if (finalConsumerUnit === '...' || finalConsumerUnit === 'شماره جدید') {
                        finalConsumerUnit = null;
                    }

                    changes.creations.push({
                        phoneNumber: current.phoneNumber,
                        consumerUnit: finalConsumerUnit,
                        nodeId: node.id,
                        portAddress: current.portAddress,
                    });
                }
            }
            
            if (changes.deletions.length > 0 || changes.creations.length > 0) {
                 await batchUpdatePortAssignments(changes.deletions, changes.creations, node);
                 alert('تغییرات با موفقیت ذخیره شد.');
            }
            onClose();

        } catch (err: any) {
            setError(`خطا در ذخیره‌سازی: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };


    const renderSelectors = () => {
        switch(node.config.type) {
            case NodeType.MDF:
                return (
                    <div className="flex items-center space-x-4 space-x-reverse mb-4 bg-gray-50 p-3 rounded border">
                        <Select
                            label="مجموعه (Set)"
                            value={selectedSet}
                            onChange={e => setSelectedSet(e.target.value)}
                            options={Array.from({ length: node.config.sets || 1 }, (_, i) => ({ value: String(i + 1), label: `مجموعه ${i + 1}`}))}
                        />
                        <Select
                            label="ترمینال (کرون)"
                            value={selectedTerminal}
                            onChange={e => setSelectedTerminal(e.target.value)}
                            options={Array.from({ length: node.config.terminalsPerSet || 1 }, (_, i) => ({ value: String(i + 1), label: `ترمینال ${i + 1}`}))}
                        />
                    </div>
                );
            case NodeType.SLOT_DEVICE:
                 return (
                    <div className="mb-4 bg-gray-50 p-3 rounded border">
                        <Select
                            label="انتخاب اسلات (Slot)"
                            value={selectedSlot}
                            onChange={e => setSelectedSlot(e.target.value)}
                            options={Array.from({ length: node.config.slots || 1 }, (_, i) => ({ value: String(i + 1), label: `اسلات ${i + 1}`}))}
                            fullWidth={false}
                        />
                        <p className="text-xs text-gray-500 mt-2">ابتدا شماره اسلات دستگاه را انتخاب کنید تا پورت‌های آن نمایش داده شود.</p>
                    </div>
                );
            case NodeType.CONVERTER:
            case NodeType.SOCKET:
            default:
                return (
                    <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                        <i className="fas fa-info-circle ml-2 text-indigo-500"></i>
                        لیست پورت‌های دستگاه (مستقیم)
                    </div>
                );
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`مدیریت پورت‌های گره: ${node.name}`} className="sm:max-w-4xl">
            <div className="p-4 space-y-4">
                {renderSelectors()}
                {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
                
                {isLoading ? (
                    <div className="flex justify-center items-center h-48"><Spinner /></div>
                ) : (
                    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar border rounded-lg p-4 bg-gray-50">
                        {assignments.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">هیچ پورتی برای پیکربندی فعلی یافت نشد.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {assignments.map((a, index) => (
                                    <div key={a.portAddress} className="bg-white p-3 rounded-md shadow-sm border focus-within:ring-2 focus-within:ring-indigo-500">
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between items-center">
                                            <span>پورت {index + 1}</span>
                                            <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded border" title="کد سیستمی پورت">{a.portAddress}</span>
                                        </label>
                                        <Input 
                                            placeholder="شماره تلفن..."
                                            value={a.phoneNumber}
                                            onChange={e => handlePhoneNumberChange(a.portAddress, e.target.value)}
                                            className="text-center font-mono text-sm"
                                            dir="ltr"
                                        />
                                        <div className="text-xs text-gray-500 mt-1 h-4 truncate">
                                            {a.consumerUnit === '...' ? <Spinner className="h-3 w-3 inline-block" /> : a.consumerUnit || ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t">
                    <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isLoading || isSaving}>
                        اعمال تغییرات
                    </Button>
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                        لغو
                    </Button>
                </div>
            </div>
        </Modal>
    );
};