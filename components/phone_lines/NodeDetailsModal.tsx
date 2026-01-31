
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Node, NodeType } from '../../types';
import { getNodeStats, updateNodeConfig, uploadNodeImage } from '../../services/nodeService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { TextArea } from '../ui/Input';
import { CameraIcon, EditIcon, ListIcon, PhoneIcon, NodeIcon } from '../ui/Icons';

interface NodeDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    node: Node;
    onEdit: () => void;
    onPortManage: () => void;
    onLinesList: () => void;
    onUpdate: () => void; // Refresh parent list
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ 
    isOpen, onClose, node, onEdit, onPortManage, onLinesList, onUpdate 
}) => {
    const [stats, setStats] = useState<{ total: number, used: number, free: number, lastActivity: { date: string, port: string } | null } | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && node) {
            setDescription(node.config.description || '');
            setImageUrl(node.config.image_url || null);
            loadStats();
        }
    }, [isOpen, node]);

    const loadStats = async () => {
        setIsLoadingStats(true);
        try {
            const s = await getNodeStats(node);
            setStats(s);
        } catch (e) {
            console.error("Error loading stats", e);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const handleSaveDescription = async () => {
        setIsSaving(true);
        try {
            const newConfig = { ...node.config, description: description, image_url: imageUrl || undefined };
            await updateNodeConfig(node.id, newConfig);
            onUpdate(); // Refresh parent to keep data synced (though config is nested)
            // No alert needed for smoother UX, maybe a toast?
        } catch (e) {
            alert('خطا در ذخیره توضیحات');
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try {
                const url = await uploadNodeImage(node.id, e.target.files[0]);
                setImageUrl(url);
                // Auto save config with new image
                const newConfig = { ...node.config, description: description, image_url: url };
                await updateNodeConfig(node.id, newConfig);
                onUpdate();
            } catch (err: any) {
                alert('خطا در آپلود تصویر: ' + err.message);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const renderConfigDetails = () => {
        const c = node.config;
        switch(node.type) {
            case NodeType.MDF:
                return (
                    <div className="grid grid-cols-3 gap-2 text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">
                        <div><span className="font-bold">مجموعه (Set):</span> {c.sets}</div>
                        <div><span className="font-bold">ترمینال/ست:</span> {c.terminalsPerSet}</div>
                        <div><span className="font-bold">پورت/ترمینال:</span> {c.portsPerTerminal}</div>
                    </div>
                );
            case NodeType.SLOT_DEVICE:
                return (
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">
                        <div><span className="font-bold">تعداد اسلات:</span> {c.slots}</div>
                        <div><span className="font-bold">پورت/اسلات:</span> {c.portsPerSlot}</div>
                    </div>
                );
            default:
                return (
                    <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">
                        <span className="font-bold">تعداد پورت:</span> {c.ports}
                    </div>
                );
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`جزئیات گره: ${node.name}`} className="sm:max-w-2xl">
            <div className="p-4 space-y-6">
                
                {/* Header & Image */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Image Section */}
                    <div className="w-full md:w-1/3 flex flex-col items-center">
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                            {imageUrl ? (
                                <img src={imageUrl} alt={node.name} className="w-full h-full object-cover" />
                            ) : (
                                <NodeIcon className="text-4xl text-gray-400" />
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Spinner className="text-white" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={() => fileInputRef.current?.click()} className="text-white bg-black/50 p-2 rounded-full hover:bg-black/70">
                                    <CameraIcon />
                                </button>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <span className="text-xs text-gray-500 mt-2">برای تغییر تصویر کلیک کنید</span>
                    </div>

                    {/* Stats & Info Section */}
                    <div className="w-full md:w-2/3">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                            {node.name}
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full mr-2">{node.type}</span>
                        </h3>
                        
                        {renderConfigDetails()}

                        {isLoadingStats ? (
                            <div className="flex justify-center p-4"><Spinner /></div>
                        ) : stats ? (
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="bg-blue-50 p-3 rounded text-center border border-blue-100">
                                    <div className="text-xs text-blue-600 mb-1">کل پورت‌ها</div>
                                    <div className="text-xl font-bold text-blue-800">{stats.total}</div>
                                </div>
                                <div className="bg-red-50 p-3 rounded text-center border border-red-100">
                                    <div className="text-xs text-red-600 mb-1">مشغول</div>
                                    <div className="text-xl font-bold text-red-800">{stats.used}</div>
                                </div>
                                <div className="bg-green-50 p-3 rounded text-center border border-green-100">
                                    <div className="text-xs text-green-600 mb-1">آزاد</div>
                                    <div className="text-xl font-bold text-green-800">{stats.free}</div>
                                </div>
                            </div>
                        ) : null}

                        {stats?.lastActivity && (
                            <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-100 mb-4">
                                <span className="font-bold text-yellow-700">آخرین اتصال:</span> پورت {stats.lastActivity.port} در تاریخ {new Date(stats.lastActivity.date).toLocaleDateString('fa-IR')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات تکمیلی</label>
                    <div className="flex gap-2">
                        <TextArea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            rows={3} 
                            placeholder="توضیحات مربوط به محل نصب، وضعیت فیزیکی و..."
                            className="text-sm"
                        />
                        <Button 
                            variant="primary" 
                            onClick={handleSaveDescription} 
                            loading={isSaving}
                            disabled={isSaving}
                            className="h-fit self-end"
                        >
                            ذخیره
                        </Button>
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t">
                    <Button variant="secondary" onClick={() => { onClose(); onEdit(); }}>
                        <EditIcon className="ml-1" /> ویرایش گره
                    </Button>
                    <Button variant="secondary" onClick={() => { onClose(); onPortManage(); }}>
                        <PhoneIcon className="ml-1" /> مدیریت پورت‌ها
                    </Button>
                    <Button variant="secondary" onClick={() => { onClose(); onLinesList(); }}>
                        <ListIcon className="ml-1" /> لیست خطوط
                    </Button>
                    <Button variant="ghost" onClick={onClose} className="border">
                        بستن
                    </Button>
                </div>

            </div>
        </Modal>
    );
};
