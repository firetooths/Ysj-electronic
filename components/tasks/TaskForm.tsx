
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createTask, getTaskById, updateTask } from '../../services/taskService';
import { getUsers } from '../../services/authService';
import { TaskStatus, TaskPriority, User } from '../../types';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { Select } from '../ui/Select';
import { ImageUpload } from '../assets/ImageUpload';
import { CameraIcon, CloseIcon, AddIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext';
import { getNotificationDefaults, handleNotifications } from '../../services/notificationService';

export const TaskForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
    
    // Assignee State
    const [assignedToUsers, setAssignedToUsers] = useState<string[]>([]);
    const [systemUsers, setSystemUsers] = useState<User[]>([]);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

    // Notification Options
    const [sendSms, setSendSms] = useState(true);
    const [sendTelegram, setSendTelegram] = useState(true);

    // Media
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [images, setImages] = useState<File[]>([]);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const currentUserName = user?.full_name || user?.username || 'کاربر ناشناس';

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                // Load users for selection
                const users = await getUsers();
                setSystemUsers(users);

                if (id) {
                    const task = await getTaskById(id);
                    if (task) {
                        setTitle(task.title);
                        setDescription(task.description || '');
                        setPriority(task.priority);
                        if (task.assigned_to) {
                            const assignees = task.assigned_to.split('، ').map(s => s.trim()).filter(Boolean);
                            setAssignedToUsers(assignees);
                        } else {
                            setAssignedToUsers([]);
                        }
                        // For edit, default to false to avoid spam, or keep defaults? 
                        // Let's keep defaults but maybe user unchecks them.
                    }
                } else {
                    // Load defaults
                    const defaults = await getNotificationDefaults();
                    setSendSms(defaults.task.sms.enabled);
                    setSendTelegram(defaults.task.telegram.enabled);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [id]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 }); // Target 32k
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

    const handleImageSelect = async (files: File[]) => {
        setImages(prev => [...prev, ...files]);
        setIsImageModalOpen(false);
    };

    const handleAddAssignee = () => {
        if (selectedUserToAdd && !assignedToUsers.includes(selectedUserToAdd)) {
            setAssignedToUsers([...assignedToUsers, selectedUserToAdd]);
        }
        setIsAddingUser(false);
        setSelectedUserToAdd('');
    };

    const handleRemoveAssignee = (name: string) => {
        setAssignedToUsers(prev => prev.filter(u => u !== name));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            alert('عنوان تسک الزامی است');
            return;
        }
        setIsLoading(true);
        
        const assignedToString = assignedToUsers.length > 0 ? assignedToUsers.join('، ') : null;

        try {
            let taskId = id;
            if (id) {
                await updateTask(id, {
                    title,
                    description,
                    priority,
                    assigned_to: assignedToString
                }, currentUserName);
                alert('تسک با موفقیت ویرایش شد');
            } else {
                const newTask = await createTask({
                    title,
                    description,
                    priority,
                    assigned_to: assignedToString,
                    status: TaskStatus.PENDING,
                }, audioBlob, images, currentUserName);
                taskId = newTask.id;
                alert('تسک با موفقیت ایجاد شد');
            }

            // --- Notifications ---
            if (assignedToUsers.length > 0 && taskId) {
                const appUrl = window.location.origin + window.location.pathname;
                const taskLink = `${appUrl}#/tasks/${taskId}`;
                
                await handleNotifications(
                    assignedToUsers,
                    'task',
                    {
                        title,
                        priority,
                        description: description || 'ندارد',
                        assignee: assignedToString,
                        creator: currentUserName,
                        link: taskLink
                    },
                    { sms: sendSms, telegram: sendTelegram }
                );
            }

            navigate('/tasks/list');
        } catch (err: any) {
            alert(`خطا: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl max-w-2xl">
            <h2 className="text-2xl font-bold mb-6 border-b pb-4">{id ? 'ویرایش تسک' : 'تعریف تسک جدید'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="عنوان تسک *" value={title} onChange={e => setTitle(e.target.value)} required />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select 
                        label="اولویت"
                        value={priority}
                        onChange={e => setPriority(e.target.value as TaskPriority)}
                        options={Object.values(TaskPriority).map(p => ({value: p, label: p}))}
                    />
                </div>

                {/* Multi-User Assignment */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">مسئول انجام</label>
                    <div className="flex flex-wrap gap-2 mb-3 p-2 border rounded min-h-[40px] bg-gray-50">
                        {assignedToUsers.length === 0 && !isAddingUser && (
                            <span className="text-gray-500 text-sm italic self-center">هیچ کاربری انتخاب نشده است</span>
                        )}
                        {assignedToUsers.map((user, idx) => (
                            <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {user}
                                <button type="button" onClick={() => handleRemoveAssignee(user)} className="ml-2 text-indigo-500 hover:text-red-600">
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                        {!isAddingUser && (
                            <button type="button" onClick={() => setIsAddingUser(true)} className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center px-2 border border-dashed border-indigo-300 rounded hover:bg-indigo-50">
                                <AddIcon className="w-3 h-3 ml-1" /> افزودن کاربر
                            </button>
                        )}
                    </div>
                    
                    {isAddingUser && (
                        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded animate-fade-in">
                            <Select
                                options={[{ value: '', label: 'انتخاب کنید...' }, ...systemUsers.map(u => ({ value: u.full_name || u.username, label: u.full_name || u.username }))]}
                                value={selectedUserToAdd}
                                onChange={e => setSelectedUserToAdd(e.target.value)}
                                className="flex-grow text-sm"
                            />
                            <Button type="button" size="sm" variant="primary" onClick={handleAddAssignee} disabled={!selectedUserToAdd}>تایید</Button>
                            <Button type="button" size="sm" variant="secondary" onClick={() => setIsAddingUser(false)}>لغو</Button>
                        </div>
                    )}
                </div>
                
                <TextArea label="توضیحات" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
                
                {/* Notification Options */}
                <div className="bg-gray-50 p-3 rounded border">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">تنظیمات اطلاع‌رسانی</h4>
                    <div className="flex gap-6">
                        <label className="flex items-center cursor-pointer">
                            <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} className="h-4 w-4 text-indigo-600 rounded ml-2" />
                            <span className="text-sm">ارسال پیامک</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="checkbox" checked={sendTelegram} onChange={e => setSendTelegram(e.target.checked)} className="h-4 w-4 text-blue-500 rounded ml-2" />
                            <span className="text-sm">ارسال تلگرام</span>
                        </label>
                    </div>
                </div>

                {/* Media Section (Only for new tasks usually, but keeping it consistent) */}
                {!id && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="border p-4 rounded bg-gray-50">
                            <label className="block text-sm font-medium mb-2">توضیحات صوتی</label>
                            <div className="flex items-center justify-between">
                                {!isRecording && !audioBlob && <Button type="button" size="sm" variant="secondary" onClick={startRecording}>ضبط (32k)</Button>}
                                {isRecording && <Button type="button" size="sm" variant="danger" onClick={stopRecording}>توقف</Button>}
                                {audioBlob && (
                                    <div className="text-green-600 text-sm flex items-center">
                                        <i className="fas fa-check ml-1"></i> ضبط شد
                                        <Button type="button" size="sm" variant="ghost" onClick={() => setAudioBlob(null)} className="text-red-500 mr-2">حذف</Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border p-4 rounded bg-gray-50">
                            <label className="block text-sm font-medium mb-2">پیوست تصاویر</label>
                            <Button type="button" size="sm" variant="secondary" fullWidth onClick={() => setIsImageModalOpen(true)}>
                                <CameraIcon className="ml-2" /> افزودن عکس
                            </Button>
                            {images.length > 0 && <div className="text-xs mt-2 text-gray-600">{images.length} عکس انتخاب شد</div>}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t mt-6 space-x-2 space-x-reverse">
                    <Button type="button" variant="secondary" onClick={() => navigate('/tasks/list')}>لغو</Button>
                    <Button type="submit" variant="primary" loading={isLoading}>ذخیره</Button>
                </div>
            </form>
            
            <ImageUpload 
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                onUpload={handleImageSelect}
                isUploading={false}
            />
        </div>
    );
};
