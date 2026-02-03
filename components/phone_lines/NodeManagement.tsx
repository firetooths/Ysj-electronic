
import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseContext } from '../../SupabaseContext';
import { Node, NodeType, NodeConfig } from '../../types';
import { createNode, updateNode, deleteNode, getNodeUsageCount } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, InfoIcon, NodeIcon, PhoneIcon, ListIcon, DetailsIcon } from '../ui/Icons';
import { PortAssignmentModal } from './PortAssignmentModal';
import { ConnectedLinesModal } from './ConnectedLinesModal';
import { NodeDetailsModal } from './NodeDetailsModal';

const getNodeConfigText = (node: Node): string => {
    switch (node.config.type) {
        case NodeType.MDF:
            return `${node.config.sets} مجموعه | ${node.config.terminalsPerSet} ترمینال | ${node.config.portsPerTerminal} پورت`;
        case NodeType.SLOT_DEVICE:
            return `${node.config.slots} اسلات | ${node.config.portsPerSlot} پورت`;
        case NodeType.CONVERTER:
            return `${node.config.ports} پورت`;
        case NodeType.SOCKET:
            return `${node.config.ports} پورت`;
        default:
            return 'پیکربندی نامشخص';
    }
}

export const NodeManagement: React.FC = () => {
    const { nodes, refreshNodes, isLoading: isContextLoading } = useSupabaseContext();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentNode, setCurrentNode] = useState<Node | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [type, setType] = useState<NodeType>(NodeType.MDF);
    const [config, setConfig] = useState<Partial<NodeConfig>>({});
    
    const [isSaving, setIsSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // State for Port Assignment Modal
    const [isPortModalOpen, setIsPortModalOpen] = useState(false);
    const [selectedNodeForPorts, setSelectedNodeForPorts] = useState<Node | null>(null);

    // New state for Connected Lines Modal
    const [isLinesModalOpen, setIsLinesModalOpen] = useState(false);
    const [selectedNodeForLines, setSelectedNodeForLines] = useState<Node | null>(null);

    // New State for Details Modal
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedNodeForDetails, setSelectedNodeForDetails] = useState<Node | null>(null);


    useEffect(() => {
        if (!isContextLoading) setIsLoading(false);
    }, [isContextLoading]);

    const resetForm = () => {
        setCurrentNode(null);
        setName('');
        setType(NodeType.MDF);
        setConfig({});
        setValidationErrors({});
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (node: Node) => {
        setCurrentNode(node);
        setName(node.name);
        setType(node.type);
        setConfig(node.config);
        setIsModalOpen(true);
    };
    
    const handleOpenPortAssignment = (node: Node) => {
        setSelectedNodeForPorts(node);
        setIsPortModalOpen(true);
    };

    const handleOpenLinesView = (node: Node) => {
        setSelectedNodeForLines(node);
        setIsLinesModalOpen(true);
    };

    const handleOpenDetails = (node: Node) => {
        setSelectedNodeForDetails(node);
        setIsDetailsModalOpen(true);
    };

    const validateForm = (): boolean => {
        const errors: { [key: string]: string } = {};
        if (!name.trim()) errors.name = "نام گره اجباری است.";
        
        const c = config as any;
        switch(type) {
            case NodeType.MDF:
                if (!c.sets || c.sets <= 0) errors.sets = "تعداد مجموعه باید بزرگتر از صفر باشد.";
                if (!c.terminalsPerSet || c.terminalsPerSet <= 0) errors.terminalsPerSet = "تعداد ترمینال باید بزرگتر از صفر باشد.";
                break;
            case NodeType.SLOT_DEVICE:
                if (!c.slots || c.slots <= 0) errors.slots = "تعداد اسلات باید بزرگتر از صفر باشد.";
                if (!c.portsPerSlot || c.portsPerSlot <= 0) errors.portsPerSlot = "تعداد پورت باید بزرگتر از صفر باشد.";
                break;
            case NodeType.CONVERTER:
            case NodeType.SOCKET:
                if (!c.ports || c.ports <= 0) errors.ports = "تعداد پورت باید بزرگتر از صفر باشد.";
                break;
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSaving(true);
        setError(null);
        
        const finalConfig: NodeConfig = { type, ...config, ...(type === NodeType.MDF && { portsPerTerminal: 10 }) } as NodeConfig;
        
        try {
            if (currentNode) {
                await updateNode(currentNode.id, { name: name.trim(), type, config: finalConfig });
                alert('گره با موفقیت ویرایش شد.');
            } else {
                await createNode({ name: name.trim(), type, config: finalConfig });
                alert('گره با موفقیت ایجاد شد.');
            }
            refreshNodes();
            setIsModalOpen(false);
        } catch (err: any) {
            setError(`خطا در ذخیره سازی: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = async (node: Node) => {
        const usageCount = await getNodeUsageCount(node.id);
        if (usageCount > 0) {
            alert(`امکان حذف این گره وجود ندارد زیرا در ${usageCount} مسیر خط استفاده شده است.`);
            return;
        }
        setNodeToDelete(node);
        setIsDeleteConfirmOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!nodeToDelete) return;
        setIsDeleting(true);
        try {
            await deleteNode(nodeToDelete.id);
            alert('گره با موفقیت حذف شد.');
            refreshNodes();
            setIsDeleteConfirmOpen(false);
        } catch(err: any) {
            alert(`خطا در حذف گره: ${err.message}`);
        } finally {
            setIsDeleting(false);
            setNodeToDelete(null);
        }
    };

    const handleConfigChange = (field: string, value: string) => {
        const numValue = parseInt(value, 10);
        setConfig(prev => ({...prev, [field]: isNaN(numValue) ? '' : numValue }));
    };

    const renderConfigFields = () => {
        const c = config as any;
        switch(type) {
            case NodeType.MDF:
                return <>
                    <Input label="تعداد مجموعه‌ها (Set)" type="number" value={c.sets || ''} onChange={e => handleConfigChange('sets', e.target.value)} error={validationErrors.sets} />
                    <Input label="تعداد ترمینال در هر مجموعه" type="number" value={c.terminalsPerSet || ''} onChange={e => handleConfigChange('terminalsPerSet', e.target.value)} error={validationErrors.terminalsPerSet} />
                    <Input label="تعداد پورت در هر ترمینال" type="number" value={10} disabled readOnly />
                </>;
            case NodeType.SLOT_DEVICE:
                return <>
                    <Input label="تعداد اسلات" type="number" value={c.slots || ''} onChange={e => handleConfigChange('slots', e.target.value)} error={validationErrors.slots} />
                    <Input label="تعداد پورت در هر اسلات" type="number" value={c.portsPerSlot || ''} onChange={e => handleConfigChange('portsPerSlot', e.target.value)} error={validationErrors.portsPerSlot} />
                </>;
            case NodeType.CONVERTER:
                return <Input label="تعداد پورت" type="number" value={c.ports || ''} onChange={e => handleConfigChange('ports', e.target.value)} error={validationErrors.ports} />;
            case NodeType.SOCKET:
                return <Input label="تعداد پورت" type="number" value={c.ports || ''} onChange={e => handleConfigChange('ports', e.target.value)} error={validationErrors.ports} />;
            default: return null;
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
    }
    
    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت گره‌ها (Nodes)</h2>
                <Button variant="primary" onClick={handleOpenCreate}><AddIcon className="ml-2" /> افزودن گره جدید</Button>
            </div>
            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
            
            <div className="space-y-4">
                {nodes.length === 0 ? (
                     <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <InfoIcon className="fa-lg ml-3 text-blue-500" />
                        <span>هنوز هیچ گره‌ای ثبت نشده است.</span>
                    </div>
                ) : (
                    nodes.map(node => (
                        <div key={node.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border flex flex-col md:flex-row items-center justify-between hover:shadow-md transition-shadow gap-4">
                            <div className="flex items-center w-full md:w-auto">
                                <div className="relative flex-shrink-0">
                                    {node.config.image_url ? (
                                        <img src={node.config.image_url} alt={node.name} className="w-12 h-12 rounded-full object-cover ml-4 border" />
                                    ) : (
                                        <NodeIcon className="ml-4 text-2xl text-indigo-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-gray-800">{node.name}</p>
                                    <p className="text-sm text-gray-600">{node.type} - {getNodeConfigText(node)}</p>
                                </div>
                            </div>
                            
                            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
                                {/* Details Button (Full width on mobile) */}
                                <Button variant="primary" size="sm" onClick={() => handleOpenDetails(node)} title="مشاهده جزئیات و آمار" className="w-full sm:w-auto justify-center">
                                    <DetailsIcon className="ml-1" /> جزئیات
                                </Button>
                                
                                {/* Action Icons Grid */}
                                <div className="grid grid-cols-4 gap-2 w-full sm:w-auto">
                                    <Button variant="secondary" size="sm" onClick={() => handleOpenLinesView(node)} title="مشاهده خطوط متصل" className="flex items-center justify-center">
                                        <ListIcon />
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => handleOpenPortAssignment(node)} title="تعریف تلفن روی گره" className="flex items-center justify-center">
                                        <PhoneIcon />
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(node)} title="ویرایش" className="flex items-center justify-center">
                                        <EditIcon />
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteClick(node)} title="حذف" className="flex items-center justify-center">
                                        <DeleteIcon />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentNode ? 'ویرایش گره' : 'افزودن گره جدید'}>
                <form onSubmit={handleSave} className="space-y-4 p-4">
                    <Input label="نام گره" value={name} onChange={e => setName(e.target.value)} error={validationErrors.name} required />
                    <Select label="نوع گره" options={Object.values(NodeType).map(t => ({value: t, label: t}))} value={type} onChange={e => setType(e.target.value as NodeType)} />
                    <div className="p-4 border rounded-md bg-gray-50 space-y-4">
                        <h4 className="font-semibold text-gray-700">تنظیمات ظرفیت</h4>
                        {renderConfigFields()}
                    </div>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
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
                title="حذف گره"
                message={`آیا از حذف گره "${nodeToDelete?.name}" مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
                confirmText="حذف"
                isConfirming={isDeleting}
            />

            {selectedNodeForPorts && (
                <PortAssignmentModal 
                    isOpen={isPortModalOpen}
                    onClose={() => setIsPortModalOpen(false)}
                    node={selectedNodeForPorts}
                />
            )}

            {selectedNodeForLines && (
                <ConnectedLinesModal 
                    isOpen={isLinesModalOpen}
                    onClose={() => setIsLinesModalOpen(false)}
                    node={selectedNodeForLines}
                />
            )}

            {selectedNodeForDetails && (
                <NodeDetailsModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    node={selectedNodeForDetails}
                    onUpdate={refreshNodes}
                    onEdit={() => handleOpenEdit(selectedNodeForDetails)}
                    onPortManage={() => handleOpenPortAssignment(selectedNodeForDetails)}
                    onLinesList={() => handleOpenLinesView(selectedNodeForDetails)}
                />
            )}
        </div>
    );
};
