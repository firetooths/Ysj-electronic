import React, { useState, useEffect } from 'react';
import { useSupabaseContext } from '../../SupabaseContext';
import { getSetting, setSetting } from '../../supabaseService';
import { SETTINGS_KEYS } from '../../constants';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AddIcon, DeleteIcon, InfoIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';
import { ColorDisplay } from '../ui/ColorDisplay';
import { WireColor, PhoneLineDashboardCard } from '../../types';
import { Modal } from '../ui/Modal';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const PhoneLineSettings: React.FC = () => {
    const { wireColors, tags, refreshWireColors, isLoading: isContextLoading } = useSupabaseContext();
    const [colors, setColors] = useState<WireColor[]>([]);
    
    // State for the new color form
    const [newColorName, setNewColorName] = useState('');
    const [isDualColor, setIsDualColor] = useState(false);
    const [color1Hex, setColor1Hex] = useState('#ffffff');
    const [color2Hex, setColor2Hex] = useState('#000000');

    // State for dashboard cards
    const [customCards, setCustomCards] = useState<PhoneLineDashboardCard[]>([]);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [newCardName, setNewCardName] = useState('');
    const [newCardTagIds, setNewCardTagIds] = useState<string[]>([]);
    const [cardModalError, setCardModalError] = useState<string | null>(null);
    const [isDeleteCardConfirmOpen, setIsDeleteCardConfirmOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState<PhoneLineDashboardCard | null>(null);


    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isContextLoading) {
            setColors(wireColors);
            const loadCards = async () => {
                try {
                    const cardsJson = await getSetting(SETTINGS_KEYS.PHONE_LINE_DASHBOARD_CARDS);
                    setCustomCards(cardsJson ? JSON.parse(cardsJson) : []);
                } catch(e: any) {
                    setError('خطا در بارگذاری کارت های سفارشی: ' + e.message);
                }
            };
            loadCards();
        }
    }, [wireColors, isContextLoading]);

    const handleAddColor = () => {
        if (!newColorName.trim()) {
            alert('نام رنگ نمی‌تواند خالی باشد.');
            return;
        }
        if (colors.some(c => c.name.toLowerCase() === newColorName.trim().toLowerCase())) {
            alert('رنگی با این نام از قبل وجود دارد.');
            return;
        }

        const newColorValue = isDualColor ? `${color1Hex}|${color2Hex}` : color1Hex;
        const newColor: WireColor = { name: newColorName.trim(), value: newColorValue };
        
        setColors([...colors, newColor]);
        
        // Reset form
        setNewColorName('');
        setIsDualColor(false);
        setColor1Hex('#ffffff');
        setColor2Hex('#000000');
    };

    const handleDeleteColor = (colorNameToDelete: string) => {
        setColors(colors.filter(color => color.name !== colorNameToDelete));
    };

    const handleSaveWireColors = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await setSetting(SETTINGS_KEYS.PHONE_WIRE_COLORS, JSON.stringify(colors));
            await refreshWireColors();
            alert('تغییرات رنگ‌ها با موفقیت ذخیره شد.');
        } catch (err: any) {
            setError(`خطا در ذخیره تغییرات: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenAddCardModal = () => {
        setNewCardName('');
        setNewCardTagIds([]);
        setCardModalError(null);
        setIsCardModalOpen(true);
    };

    const handleAddCard = async () => {
        if (!newCardName.trim()) {
            setCardModalError('نام کارت اجباری است.');
            return;
        }
        if (newCardTagIds.length === 0) {
            setCardModalError('حداقل یک تگ باید انتخاب شود.');
            return;
        }
        
        setIsSaving(true);
        setCardModalError(null);

        try {
            const selectedTags = tags.filter(t => newCardTagIds.includes(t.id));
            const newCard: PhoneLineDashboardCard = {
                id: Date.now().toString(),
                name: newCardName.trim(),
                tagIds: newCardTagIds,
                tagNames: selectedTags.map(t => t.name)
            };
            const updatedCards = [...customCards, newCard];
            await setSetting(SETTINGS_KEYS.PHONE_LINE_DASHBOARD_CARDS, JSON.stringify(updatedCards));
            setCustomCards(updatedCards);
            setIsCardModalOpen(false);
        } catch (e: any) {
            setCardModalError(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCardClick = (card: PhoneLineDashboardCard) => {
        setCardToDelete(card);
        setIsDeleteCardConfirmOpen(true);
    };

    const confirmDeleteCard = async () => {
        if (!cardToDelete) return;
        setIsSaving(true);
        try {
            const updatedCards = customCards.filter(c => c.id !== cardToDelete.id);
            await setSetting(SETTINGS_KEYS.PHONE_LINE_DASHBOARD_CARDS, JSON.stringify(updatedCards));
            setCustomCards(updatedCards);
            setIsDeleteCardConfirmOpen(false);
            setCardToDelete(null);
        } catch (e: any) {
            setError('خطا در حذف کارت: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };


    if (isContextLoading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Spinner className="w-10 h-10" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">تنظیمات خطوط تلفن</h2>
            
            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

            {/* Wire Color Settings */}
            <div className="p-6 border rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">تنظیمات رنگ زوج سیم</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Color List */}
                    <div>
                        <h4 className="font-semibold text-gray-700 mb-2">لیست رنگ‌های تعریف شده</h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2 border p-2 rounded-md bg-white">
                            {colors.length > 0 ? colors.map((color, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                    <span className="font-medium text-gray-700 flex items-center">
                                        <ColorDisplay value={color.value} name={color.name} className="ml-3" />
                                        <span>{color.name}</span>
                                    </span>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteColor(color.name)} disabled={isSaving}>
                                        <DeleteIcon className="text-red-500" />
                                    </Button>
                                </div>
                            )) : (
                                <div className="flex items-center text-gray-500 p-4 border-2 border-dashed rounded-lg">
                                    <InfoIcon className="ml-2" />
                                    <span>هیچ رنگی تعریف نشده است.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add Color Form */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-700 mb-2">افزودن رنگ جدید</h4>
                        <div className="space-y-4">
                            <Input
                                label="نام رنگ"
                                placeholder="مثال: سفید-سبز یا مسی"
                                value={newColorName}
                                onChange={e => setNewColorName(e.target.value)}
                            />
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="is-dual-color"
                                    checked={isDualColor}
                                    onChange={e => setIsDualColor(e.target.checked)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded ml-2"
                                />
                                <label htmlFor="is-dual-color" className="text-sm font-medium text-gray-700">رنگ دوتایی</label>
                            </div>
                            <div className="flex items-center space-x-4 space-x-reverse">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{isDualColor ? 'رنگ اول' : 'رنگ'}</label>
                                    <input type="color" value={color1Hex} onChange={e => setColor1Hex(e.target.value)} className="w-full h-10 p-1 border border-gray-300 rounded-md cursor-pointer"/>
                                </div>
                                {isDualColor && (
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">رنگ دوم</label>
                                        <input type="color" value={color2Hex} onChange={e => setColor2Hex(e.target.value)} className="w-full h-10 p-1 border border-gray-300 rounded-md cursor-pointer"/>
                                    </div>
                                )}
                            </div>
                            <div>
                                <Button variant="secondary" onClick={handleAddColor} disabled={isSaving}>
                                    <AddIcon className="ml-2" /> افزودن به لیست
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t">
                    <Button onClick={handleSaveWireColors} loading={isSaving} disabled={isSaving}>
                        ذخیره تغییرات رنگ‌ها
                    </Button>
                </div>
            </div>
            
            {/* Custom Dashboard Cards Settings */}
            <div className="p-6 border rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">کارت‌های سفارشی داشبورد</h3>
                    <Button variant="primary" onClick={handleOpenAddCardModal}>
                        <AddIcon className="ml-2" /> افزودن کارت جدید
                    </Button>
                </div>
                <div className="space-y-2">
                    {customCards.length > 0 ? customCards.map((card) => (
                    <div key={card.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div>
                        <p className="font-medium text-gray-700">{card.name}</p>
                        <p className="text-sm text-gray-500">
                            تگ‌ها: {card.tagNames.join(', ')}
                        </p>
                        </div>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteCardClick(card)} disabled={isSaving}>
                        <DeleteIcon />
                        </Button>
                    </div>
                    )) : (
                    <p className="text-gray-500">هیچ کارت سفارشی اضافه نشده است.</p>
                    )}
                </div>
            </div>

            {/* Add Card Modal */}
            <Modal isOpen={isCardModalOpen} onClose={() => setIsCardModalOpen(false)} title="افزودن کارت جدید به داشبورد">
                <div className="p-4 space-y-4">
                {cardModalError && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{cardModalError}</div>}
                <Input
                    label="نام کارت"
                    placeholder="مثال: خطوط واحد مالی"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                />
                <MultiSelectDropdown
                    label="فیلتر بر اساس تگ(ها)"
                    options={tags.map(t => ({ value: t.id, label: t.name }))}
                    selectedValues={newCardTagIds}
                    onChange={setNewCardTagIds}
                />
                <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t">
                    <Button variant="primary" onClick={handleAddCard} loading={isSaving} disabled={isSaving}>
                        {isSaving ? 'در حال افزودن...' : 'افزودن کارت'}
                    </Button>
                    <Button variant="secondary" onClick={() => setIsCardModalOpen(false)} disabled={isSaving}>
                        لغو
                    </Button>
                </div>
                </div>
            </Modal>

            {/* Delete Card Confirm Dialog */}
            <ConfirmDialog
                isOpen={isDeleteCardConfirmOpen}
                onClose={() => setIsDeleteCardConfirmOpen(false)}
                onConfirm={confirmDeleteCard}
                title="حذف کارت سفارشی"
                message={`آیا از حذف کارت "${cardToDelete?.name}" مطمئن هستید؟`}
                confirmText="حذف"
                isConfirming={isSaving}
            />
        </div>
    );
};