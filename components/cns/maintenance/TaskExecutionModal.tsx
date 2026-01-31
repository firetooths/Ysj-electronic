
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input, TextArea } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { MaintenanceSchedule, User } from '../../../types';
import { performMaintenanceTask } from '../../../services/cnsMaintenanceService';
import { getUsers } from '../../../services/authService';
import { CameraIcon, AddIcon, CloseIcon } from '../../ui/Icons';
import { useAuth } from '../../../AuthContext';
import { handleAdminActionNotification } from '../../../services/notificationService';

interface TaskExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: MaintenanceSchedule;
    onSuccess: () => void;
}

export const TaskExecutionModal: React.FC<TaskExecutionModalProps> = ({ isOpen, onClose, schedule, onSuccess }) => {
    const { user } = useAuth();
    // Changed from single string to array of strings
    const [performers, setPerformers] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // User Selection State
    const [isAddingPerformer, setIsAddingPerformer] = useState(false);
    const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
    const [systemUsers, setSystemUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Media
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);

    useEffect(() => {
        if (isOpen && user) {
            // Default to current user as the first performer
            const currentUserName = user.full_name || user.username;
            setPerformers([currentUserName]);
            setIsAddingPerformer(false);
            setNotes('');
            setAudioBlob(null);
            setImageFile(null);
        }
    }, [isOpen, user]);

    const fetchUsersIfNeeded = async () => {
        if (systemUsers.length === 0) {
            setIsLoadingUsers(true);
            try {
                const users = await getUsers();
                setSystemUsers(users);
            } catch (err) {
                console.error("Failed to load users", err);
            } finally {
                setIsLoadingUsers(false);
            }
        }
    };

    const handleShowAddPerformer = async () => {
        await fetchUsersIfNeeded();
        setIsAddingPerformer(true);
        setSelectedUserToAdd('');
    };

    const handleAddPerformer = () => {
        if (selectedUserToAdd && !performers.includes(selectedUserToAdd)) {
            setPerformers([...performers, selectedUserToAdd]);
        }
        setIsAddingPerformer(false);
        setSelectedUserToAdd('');
    };

    const handleRemovePerformer = (nameToRemove: string) => {
        setPerformers(performers.filter(p => p !== nameToRemove));
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = () => {
                setAudioBlob(new Blob(chunks, { type: 'audio/mp4' }));
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start();
            setIsRecording(true);
        } catch (err) { alert('عدم دسترسی به میکروفون'); }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (performers.length === 0) {
            alert('حداقل یک انجام دهنده باید مشخص شود.');
            return;
        }
        
        const performerString = performers.join('، ');

        setIsSubmitting(true);
        try {
            await performMaintenanceTask(schedule.id, performerString, notes, audioBlob, imageFile);
            
            // Notify Admins
            const appUrl = window.location.origin + window.location.pathname;
            const link = `${appUrl}#/maintenance/details/${schedule.id}`;
            
            await handleAdminActionNotification(
                'maintenance',
                `انجام سرویس «${schedule.title}»`,
                performerString,
                {
                    title: schedule.title,
                    link: link
                }
            );

            alert('انجام کار با موفقیت ثبت شد.');
            onSuccess();
        } catch (err) {
            alert('خطا در ثبت اطلاعات');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`انجام فعالیت: ${schedule.title}`}>
            <div className="space-y-4 p-2">
                
                {/* Performers Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">نام انجام دهندگان *</label>
                    
                    {/* List of selected performers */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {performers.map((name, index) => (
                            <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {name}
                                <button 
                                    type="button" 
                                    onClick={() => handleRemovePerformer(name)}
                                    className="ml-2 text-indigo-500 hover:text-indigo-700 focus:outline-none"
                                    title="حذف"
                                >
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                        {performers.length === 0 && (
                            <span className="text-sm text-gray-500 italic py-1">هیچ انجام دهنده‌ای انتخاب نشده است.</span>
                        )}
                    </div>

                    {/* Add Performer UI */}
                    {isAddingPerformer ? (
                        <div className="flex items-end gap-2 bg-gray-50 p-3 rounded border border-gray-200 animate-fade-in">
                            <div className="flex-grow">
                                <Select
                                    label="انتخاب کاربر"
                                    value={selectedUserToAdd}
                                    onChange={(e) => setSelectedUserToAdd(e.target.value)}
                                    options={[
                                        { value: '', label: 'انتخاب کنید...' },
                                        ...(isLoadingUsers 
                                            ? [{ value: '', label: 'در حال بارگذاری...', disabled: true }] 
                                            : systemUsers.map(u => ({ value: u.full_name || u.username, label: u.full_name || u.username }))
                                        )
                                    ]}
                                    fullWidth
                                />
                            </div>
                            <Button type="button" size="md" variant="primary" onClick={handleAddPerformer} disabled={!selectedUserToAdd}>
                                افزودن
                            </Button>
                            <Button type="button" size="md" variant="secondary" onClick={() => setIsAddingPerformer(false)}>
                                انصراف
                            </Button>
                        </div>
                    ) : (
                        <Button type="button" size="sm" variant="secondary" onClick={handleShowAddPerformer}>
                            <AddIcon className="ml-2" /> افزودن همکار
                        </Button>
                    )}
                </div>
                
                <TextArea 
                    label="گزارش / توضیحات" 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    rows={4}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded border">
                        <label className="block text-sm font-medium mb-2">ضبط گزارش صوتی</label>
                        <div className="flex items-center justify-between">
                            {!isRecording && !audioBlob && <Button size="sm" variant="secondary" onClick={startRecording}>شروع ضبط</Button>}
                            {isRecording && <Button size="sm" variant="danger" onClick={stopRecording}>توقف (در حال ضبط...)</Button>}
                            {audioBlob && (
                                <div className="text-green-600 text-sm flex items-center">
                                    <i className="fas fa-check ml-1"></i> صدا ضبط شد
                                    <Button size="sm" variant="ghost" onClick={() => setAudioBlob(null)} className="text-red-500 mr-2">حذف</Button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded border">
                        <label className="block text-sm font-medium mb-2">پیوست تصویر</label>
                        <div className="relative">
                            <input type="file" accept="image/*" className="hidden" id="task-img" onChange={handleImageChange} />
                            <label htmlFor="task-img" className="cursor-pointer flex items-center justify-center bg-white border border-gray-300 rounded py-2 hover:bg-gray-100">
                                <CameraIcon className="ml-2" /> انتخاب عکس
                            </label>
                            {imageFile && <div className="text-xs mt-1 text-green-600 truncate">{imageFile.name}</div>}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t space-x-2 space-x-reverse">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>لغو</Button>
                    <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} disabled={performers.length === 0}>ذخیره و انجام شد</Button>
                </div>
            </div>
        </Modal>
    );
};
