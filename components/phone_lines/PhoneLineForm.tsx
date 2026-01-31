
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSupabaseContext } from '../../SupabaseContext';
import { PhoneLine, RouteNode, Node, NodeType } from '../../types';
import { createPhoneLine, updatePhoneLine, getPhoneLineById, checkPortInUse } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, WarningIcon } from '../ui/Icons';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';

type RouteStep = Partial<Omit<RouteNode, 'id' | 'line_id'>> & {
    key: number;
    portConflict?: { phoneNumber: string, routeNodeId: string } | null;
};


const getNodeTypeHelpText = (node?: Node): string => {
    if (!node) return 'ابتدا یک گره انتخاب کنید.';
    switch(node.type) {
        case NodeType.MDF:
            return 'فرمت: مجموعه‌ترمینال‌پورت. مثال: 168 (برای پورت ۱۰ عدد ۰ را وارد کنید: 160)';
        case NodeType.SLOT_DEVICE:
            return 'فرمت: اسلات‌پورت (پورت دو رقمی). مثال: 112';
        case NodeType.CONVERTER:
            return 'فرمت: شماره پورت. مثال: 35';
        case NodeType.SOCKET:
            return 'فرمت: شماره پورت. مثال: 1';
        default:
            return '';
    }
}

export const PhoneLineForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { nodes, wireColors, tags, isLoading: isContextLoading } = useSupabaseContext();
    const [searchParams] = useSearchParams();
    const copyFromId = searchParams.get('copyFrom');

    const [phoneNumber, setPhoneNumber] = useState('');
    const [consumerUnit, setConsumerUnit] = useState('');
    const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [acceptErrors, setAcceptErrors] = useState(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    const isEditing = !!id;

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isEditing && id) { // Edit mode
                const line = await getPhoneLineById(id);
                if (line) {
                    setPhoneNumber(line.phone_number);
                    setConsumerUnit(line.consumer_unit || '');
                    const steps = (line.route_nodes || []).map(rn => ({ ...rn, key: Math.random(), portConflict: null }));
                    setRouteSteps(steps);
                    setSelectedTagIds(line.tags?.map(t => t.id) || []);
                } else {
                    setError('خط تلفن مورد نظر یافت نشد.');
                }
            } else if (copyFromId) { // Copy mode
                const lineToCopy = await getPhoneLineById(copyFromId);
                if (lineToCopy) {
                    const copiedSteps = (lineToCopy.route_nodes || []).map(rn => ({
                        key: Math.random(),
                        sequence: rn.sequence,
                        node_id: rn.node_id,
                        port_address: '', // Reset
                        wire_1_color_name: '', // Reset
                        wire_2_color_name: '', // Reset
                        portConflict: null,
                    }));
                    setRouteSteps(copiedSteps);
                    setPhoneNumber('');
                    setConsumerUnit('');
                } else {
                    setError('خط تلفن مبدأ برای کپی یافت نشد.');
                }
            }
            // If neither, it's a new form, and state is already empty.
        } catch (err: any) {
            setError(`خطا در بارگذاری اطلاعات: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [id, isEditing, copyFromId]);

    useEffect(() => {
        if (!isContextLoading) {
            loadInitialData();
        }
    }, [loadInitialData, isContextLoading]);

    const addRouteStep = () => {
        if (routeSteps.length >= 8) return;
        setRouteSteps([...routeSteps, { 
            key: Date.now(), 
            sequence: routeSteps.length + 1, 
            wire_1_color_name: '', 
            wire_2_color_name: '',
            portConflict: null,
        }]);
    };
    
    const removeRouteStep = (key: number) => {
        const newSteps = routeSteps.filter(step => step.key !== key)
                                 .map((step, index) => ({ ...step, sequence: index + 1 }));
        setRouteSteps(newSteps);
    };

    const handleStepChange = <T extends keyof RouteStep>(key: number, field: T, value: RouteStep[T]) => {
        setRouteSteps(prevSteps => prevSteps.map(step => step.key === key ? { ...step, [field]: value } : step));
    };
    
    const handleMoveStep = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === routeSteps.length - 1)) {
            return;
        }
    
        const newSteps = [...routeSteps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
        [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    
        const resequencedSteps = newSteps.map((step, idx) => ({
            ...step,
            sequence: idx + 1,
        }));
        
        setRouteSteps(resequencedSteps);
    };

    const validateForm = async (): Promise<boolean> => {
        const errors: { [key: string]: string } = {};
        if (!phoneNumber.trim()) errors.phoneNumber = 'شماره تلفن اجباری است.';
        
        let hasConflict = false;
        const newStepsState = [...routeSteps];

        const checks = newStepsState.map(async (step) => {
            step.portConflict = null; // Reset first
            if (step.node_id && step.port_address) {
                const conflict = await checkPortInUse(step.node_id, step.port_address, id);
                if (conflict.inUse && conflict.routeNodeId) {
                    hasConflict = true;
                    step.portConflict = { phoneNumber: conflict.phoneNumber!, routeNodeId: conflict.routeNodeId! };
                }
            }
        });
        
        await Promise.all(checks);
        
        setRouteSteps(newStepsState);
        setValidationErrors(errors);
        
        if (hasConflict && !acceptErrors) {
            setError("یک یا چند پورت انتخاب شده در حال استفاده است. برای ثبت، گزینه 'خطاها را می‌پذیرم' را فعال کرده و اتصال قبلی را جایگزین کنید.");
            return false;
        }

        setError(null);
        return Object.keys(errors).length === 0;
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!await validateForm()) {
            return;
        }

        setIsSaving(true);
        try {
            const lineData = { phone_number: phoneNumber, consumer_unit: consumerUnit };
            
            const routeNodesData = routeSteps.map(step => ({
                node_id: step.node_id!,
                sequence: step.sequence!,
                port_address: step.port_address!,
                wire_1_color_name: step.wire_1_color_name || null,
                wire_2_color_name: step.wire_2_color_name || null,
            }));
            
            const conflictingRouteNodeIdsToDelete: string[] = [];
            if (acceptErrors) {
                routeSteps.forEach(step => {
                    if (step.portConflict?.routeNodeId) {
                        conflictingRouteNodeIdsToDelete.push(step.portConflict.routeNodeId);
                    }
                });
            }
            
            if (isEditing && id) {
                await updatePhoneLine(id, lineData, routeNodesData, selectedTagIds, conflictingRouteNodeIdsToDelete, nodes, tags);
                alert('خط تلفن با موفقیت ویرایش شد.');
                navigate(`/phone-lines/view/${phoneNumber}`);
            } else {
                await createPhoneLine(lineData, routeNodesData, selectedTagIds, conflictingRouteNodeIdsToDelete, tags);
                alert('خط تلفن با موفقیت ایجاد شد.');
                navigate('/phone-lines');
            }
        } catch (err: any) {
            setError(`خطا در ذخیره‌سازی: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || isContextLoading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">
                {isEditing ? 'ویرایش خط تلفن' : (copyFromId ? 'کپی خط تلفن' : 'افزودن خط تلفن جدید')}
            </h2>

            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="شماره تلفن"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        error={validationErrors.phoneNumber}
                        required
                    />
                    <Input
                        label="مصرف کننده / واحد"
                        value={consumerUnit}
                        onChange={e => setConsumerUnit(e.target.value)}
                    />
                </div>
                
                <MultiSelectDropdown
                    label="تگ‌ها"
                    options={tags.map(t => ({ value: t.id, label: t.name }))}
                    selectedValues={selectedTagIds}
                    onChange={setSelectedTagIds}
                />

                <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">مسیر خط</h3>
                    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        {routeSteps.map((step, index) => {
                            const selectedNode = nodes.find(n => n.id === step.node_id);
                            return (
                                <div key={step.key} className="flex items-start space-x-3 space-x-reverse">
                                    <div className="flex flex-col space-y-1 pt-10">
                                        <button type="button" onClick={() => handleMoveStep(index, 'up')} disabled={index === 0} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                            <i className="fas fa-chevron-up"></i>
                                        </button>
                                        <button type="button" onClick={() => handleMoveStep(index, 'down')} disabled={index === routeSteps.length - 1} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                            <i className="fas fa-chevron-down"></i>
                                        </button>
                                    </div>
                                    <div className="flex-grow p-4 bg-white border rounded-md shadow-sm relative">
                                        <span className="absolute top-2 left-2 bg-indigo-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold">{step.sequence}</span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                            <Select
                                                label="نوع گره"
                                                options={[{ value: '', label: 'انتخاب کنید' }, ...Object.values(NodeType).map(t => ({ value: t, label: t }))]}
                                                value={selectedNode?.type || ''}
                                                onChange={e => {
                                                    const newType = e.target.value as NodeType;
                                                    const firstNodeOfType = nodes.find(n => n.type === newType);
                                                    handleStepChange(step.key, 'node_id', firstNodeOfType?.id || '');
                                                }}
                                            />
                                            <Select
                                                label="نام گره"
                                                options={[{ value: '', label: 'انتخاب کنید' }, ...nodes.filter(n => n.type === selectedNode?.type).map(n => ({ value: n.id, label: n.name }))]}
                                                value={step.node_id || ''}
                                                onChange={e => handleStepChange(step.key, 'node_id', e.target.value)}
                                                disabled={!selectedNode?.type}
                                            />
                                            <Input
                                                label="آدرس پورت/خانه"
                                                value={step.port_address || ''}
                                                onChange={e => handleStepChange(step.key, 'port_address', e.target.value)}
                                                error={step.portConflict ? `پورت توسط شماره تلفن ${step.portConflict.phoneNumber} در حال استفاده است` : undefined}
                                                placeholder={getNodeTypeHelpText(selectedNode)}
                                            />
                                            <Select
                                                label="رنگ سیم ۱"
                                                options={[{ value: '', label: 'انتخاب کنید'}, ...wireColors.map(c => ({ value: c.name, label: c.name }))]}
                                                value={step.wire_1_color_name || ''}
                                                onChange={e => handleStepChange(step.key, 'wire_1_color_name', e.target.value)}
                                            />
                                            <Select
                                                label="رنگ سیم ۲"
                                                options={[{ value: '', label: 'انتخاب کنید'}, ...wireColors.map(c => ({ value: c.name, label: c.name }))]}
                                                value={step.wire_2_color_name || ''}
                                                onChange={e => handleStepChange(step.key, 'wire_2_color_name', e.target.value)}
                                            />
                                        </div>
                                        <button type="button" onClick={() => removeRouteStep(step.key)} className="absolute top-2 right-2 text-gray-400 hover:text-red-600">
                                            <DeleteIcon />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {routeSteps.length < 8 && (
                            <Button type="button" variant="secondary" onClick={addRouteStep}>
                                <AddIcon className="ml-2" /> افزودن گره به مسیر
                            </Button>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center p-4 border-yellow-400 bg-yellow-50 border rounded-md">
                    <input type="checkbox" id="accept-errors" checked={acceptErrors} onChange={e => setAcceptErrors(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded ml-3" />
                    <label htmlFor="accept-errors" className="text-sm font-medium text-yellow-800 flex items-center">
                        <WarningIcon className="mr-2 text-yellow-500" />
                        خطاها را می‌پذیرم (با فعال کردن این گزینه، پورت اشغال شده به این خط اختصاص داده شده و از خط قبلی حذف می‌شود)
                    </label>
                </div>


                <div className="flex justify-start space-x-4 space-x-reverse mt-8 pt-6 border-t">
                    <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
                        {isSaving ? 'در حال ذخیره...' : (isEditing ? 'ذخیره تغییرات' : 'ایجاد خط')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => navigate('/phone-lines')} disabled={isSaving}>
                        لغو
                    </Button>
                </div>
            </form>
        </div>
    );
};
