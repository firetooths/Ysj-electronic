
import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { AddIcon, CloseIcon } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ShiftRequestForm } from './ShiftRequestForm';
import { ShiftRequestType } from '../../types';

export const FloatingShiftActions: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeForm, setActiveForm] = useState<ShiftRequestType | null>(null);

    const toggle = () => setIsOpen(!isOpen);

    const handleSelectAction = (type: ShiftRequestType) => {
        setActiveForm(type);
        setIsOpen(false);
    };

    return (
        <>
            <div className="fixed bottom-8 left-8 flex flex-col items-start space-y-4 z-50">
                {isOpen && (
                    <div className="flex flex-col items-start space-y-3 mb-2 animate-fade-in-up">
                        <ActionButton label="تعویض شیفت" icon="fa-exchange-alt" color="bg-indigo-600" onClick={() => handleSelectAction(ShiftRequestType.EXCHANGE)} />
                        <ActionButton label="مرخصی روزانه" icon="fa-calendar-day" color="bg-green-600" onClick={() => handleSelectAction(ShiftRequestType.LEAVE)} />
                        <ActionButton label="مرخصی استعلاجی" icon="fa-medkit" color="bg-red-600" onClick={() => handleSelectAction(ShiftRequestType.SICK_LEAVE)} />
                        <ActionButton label="دعوت به کار" icon="fa-briefcase" color="bg-orange-600" onClick={() => handleSelectAction(ShiftRequestType.INVITATION)} />
                    </div>
                )}
                <button 
                    onClick={toggle}
                    className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl transition-all duration-300 ${isOpen ? 'bg-gray-800 rotate-45' : 'bg-indigo-600 hover:scale-110'}`}
                >
                    <AddIcon className="fa-lg" />
                </button>
            </div>

            {activeForm && (
                <Modal isOpen={!!activeForm} onClose={() => setActiveForm(null)} title={`ثبت ${activeForm}`}>
                    <ShiftRequestForm 
                        type={activeForm} 
                        onClose={() => setActiveForm(null)} 
                        onSuccess={() => { setActiveForm(null); onComplete(); }} 
                    />
                </Modal>
            )}
        </>
    );
};

const ActionButton: React.FC<{ label: string, icon: string, color: string, onClick: () => void }> = ({ label, icon, color, onClick }) => (
    <button 
        onClick={onClick}
        className="flex items-center group"
    >
        <div className={`w-12 h-12 rounded-full ${color} text-white shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
            <i className={`fas ${icon}`}></i>
        </div>
        <span className="mr-3 bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {label}
        </span>
    </button>
);
