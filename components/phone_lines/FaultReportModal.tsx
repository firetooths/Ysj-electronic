
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/Input';
import { PhoneLine, FaultType, User } from '../../types';
import { createFaultReport, getPhoneLineByNumber } from '../../supabaseService';
import { FAULT_TYPES } from '../../constants';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { CameraIcon, CloseIcon } from '../ui/Icons';
import { getUsers } from '../../services/authService';
import { getNotificationDefaults, handleNotifications } from '../../services/notificationService';

const formatTime = (time: number) => new Date(time * 1000).toISOString().substr(14, 5);
const MAX_RECORDING_TIME = 180; // 3 minutes in seconds

interface FaultReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    phoneLine: PhoneLine | null;
    onSuccess: () => void;
}

export const FaultReportModal: React.FC<FaultReportModalProps> = ({ isOpen, onClose, phoneLine, onSuccess }) => {
    const [faultType, setFaultType] = useState<FaultType>(FaultType.DISCONNECTED);
    const [description, setDescription] = useState('');
    const [reporterName, setReporterName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(phoneLine?.phone_number || '');
    
    // Assignment
    const [systemUsers, setSystemUsers] = useState<User[]>([]);
    const [assignedTo, setAssignedTo] = useState('');
    const [sendSms, setSendSms] = useState(true);
    const [sendTelegram, setSendTelegram] = useState(true);

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Voice recording state
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<number | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [micError, setMicError] = useState<string | null>(null);

    // Load Data on Open
    useEffect(() => {
        if (isOpen) {
            const init = async () => {
                getUsers().then(setSystemUsers);
                const defaults = await getNotificationDefaults();
                setSendSms(defaults.phone.sms.enabled);
                setSendTelegram(defaults.phone.telegram.enabled);
            };
            init();
        } else {
            // Cleanup on close
            stopRecording(true); 
            setAudioBlob(null);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setError(null);
            setMicError(null);
        }
    }, [isOpen]);

    const startRecording = async () => {
        setMicError(null);
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, {
                mimeType: 'audio/mp4',
                audioBitsPerSecond: 32000,
            });
            mediaRecorderRef.current = recorder;
            
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (event) => chunks.push(event.data);
            recorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop()); // Release microphone
                const blob = new Blob(chunks, { type: 'audio/mp4' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= MAX_RECORDING_TIME) {
                        stopRecording();
                        return MAX_RECORDING_TIME;
                    }
                    return prev + 1;
                });
            }, 1000);

        } catch (err) {
            setMicError('دسترسی به میکروفون ممکن نیست. لطفاً اجازه دسترسی را بدهید.');
            console.error("Mic access error:", err);
        }
    };

    const stopRecording = (cancel = false) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        setIsRecording(false);
        if (cancel) {
            setAudioBlob(null);
            setAudioUrl(null);
        }
    };

    const deleteRecording = () => {
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        let targetLineId = phoneLine?.id;
        let targetPhoneNumber = phoneLine?.phone_number || phoneNumber.trim();
        
        if (!targetLineId) {
            if (!targetPhoneNumber) {
                setError('شماره تلفن اجباری است.');
                return;
            }
            try {
                const foundLine = await getPhoneLineByNumber(targetPhoneNumber);
                if (!foundLine) {
                    setError(`خط تلفنی با شماره ${targetPhoneNumber} یافت نشد.`);
                    return;
                }
                targetLineId = foundLine.id;
            } catch (findErr: any) {
                 setError(`خطا در یافتن خط تلفن: ${findErr.message}`);
                 return;
            }
        }

        setIsSaving(true);
        try {
            const fault = await createFaultReport({
                phone_line_id: targetLineId,
                fault_type: faultType,
                description: description || null,
                reporter_name: reporterName || null,
                assigned_to: assignedTo || null
            }, audioBlob, recordingTime);

            // --- Notification ---
            if (assignedTo) {
                const appUrl = window.location.origin + window.location.pathname;
                const link = `${appUrl}#/phone-lines/faults`; 
                
                await handleNotifications(
                    assignedTo,
                    'phone',
                    {
                        phoneNumber: targetPhoneNumber,
                        faultType,
                        description: description || 'ندارد',
                        reporter: reporterName || 'ناشناس',
                        link
                    },
                    { sms: sendSms, telegram: sendTelegram }
                );
            }

            alert('خرابی با موفقیت گزارش شد.');
            onSuccess();
        } catch (err: any) {
            setError(`خطا در ثبت خرابی: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`اعلام خرابی برای خط ${phoneLine?.phone_number || ''}`}
        >
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
                
                {!phoneLine && (
                     <Input
                        label="شماره تلفن"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        required
                        fullWidth
                    />
                )}
                
                <Select
                    label="نوع خرابی"
                    options={FAULT_TYPES.map(ft => ({ value: ft, label: ft }))}
                    value={faultType}
                    onChange={(e) => setFaultType(e.target.value as FaultType)}
                    fullWidth
                />
                <TextArea
                    label="توضیحات (اختیاری)"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    fullWidth
                />
                <Input
                    label="نام گزارش دهنده (اختیاری)"
                    value={reporterName}
                    onChange={e => setReporterName(e.target.value)}
                    fullWidth
                />
                
                {/* Assignment Section */}
                <div className="bg-gray-50 p-3 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-2">ارجاع به (اختیاری)</label>
                    <Select 
                        options={[{ value: '', label: 'انتخاب کنید...' }, ...systemUsers.map(u => ({ value: u.full_name || u.username, label: u.full_name || u.username }))]}
                        value={assignedTo}
                        onChange={e => setAssignedTo(e.target.value)}
                        className="mb-3"
                    />
                    
                    {assignedTo && (
                        <div className="flex gap-6 border-t pt-2 mt-2">
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} className="h-4 w-4 text-indigo-600 rounded ml-2" />
                                <span className="text-sm">ارسال پیامک</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={sendTelegram} onChange={e => setSendTelegram(e.target.checked)} className="h-4 w-4 text-blue-500 rounded ml-2" />
                                <span className="text-sm">ارسال تلگرام</span>
                            </label>
                        </div>
                    )}
                </div>

                {/* Voice Note Section */}
                <div className="p-4 border rounded-lg bg-gray-50">
                     <h4 className="font-semibold text-gray-800 mb-3">افزودن گزارش صوتی (اختیاری)</h4>
                     {micError && <p className="text-red-500 text-sm mb-2">{micError}</p>}
                     
                     {!isRecording && !audioUrl && (
                        <Button type="button" variant="secondary" onClick={startRecording}>
                            <i className="fas fa-microphone ml-2"></i> شروع ضبط
                        </Button>
                     )}

                     {isRecording && (
                        <div className="flex items-center space-x-4 space-x-reverse">
                            <Button type="button" variant="danger" onClick={() => stopRecording()}>
                                <i className="fas fa-stop ml-2"></i> توقف ضبط
                            </Button>
                            <div className="flex items-center text-red-600 font-mono">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="ml-2">{formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}</span>
                            </div>
                        </div>
                     )}

                     {audioUrl && !isRecording && (
                        <div className="space-y-3">
                            <p className="text-sm text-green-700">یک فایل صوتی ضبط شده است.</p>
                            <audio src={audioUrl} controls className="w-full"></audio>
                            <Button type="button" variant="ghost" size="sm" onClick={deleteRecording}>
                                <CloseIcon className="ml-1 text-red-500" /> حذف این صدا
                            </Button>
                        </div>
                     )}
                </div>


                <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t">
                    <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving || isRecording}>
                        {isSaving ? 'در حال ثبت...' : 'ثبت خرابی'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving || isRecording}>
                        لغو
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
