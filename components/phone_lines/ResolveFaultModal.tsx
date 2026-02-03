
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextArea, Input } from '../ui/Input';
import { PhoneLineFault } from '../../types';
import { resolveFault } from '../../supabaseService';
import { Spinner } from '../ui/Spinner';
import { CloseIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext';

interface ResolveFaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    fault: PhoneLineFault;
    onSuccess: () => void;
}

const formatTime = (time: number) => new Date(time * 1000).toISOString().substr(14, 5);
const MAX_RECORDING_TIME = 180;

export const ResolveFaultModal: React.FC<ResolveFaultModalProps> = ({ isOpen, onClose, fault, onSuccess }) => {
    const { user } = useAuth();
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Audio State
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<number | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [micError, setMicError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            // Reset state on close
            setDescription('');
            stopRecording(true);
            setAudioBlob(null);
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
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/mp4', audioBitsPerSecond: 32000 });
            mediaRecorderRef.current = recorder;
            
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (event) => chunks.push(event.data);
            recorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
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
            setMicError('عدم دسترسی به میکروفون');
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
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
    };

    const handleResolve = async () => {
        setIsSaving(true);
        setError(null);
        const resolverName = user?.full_name || user?.username || 'کاربر';
        try {
            await resolveFault(
                fault.id, 
                fault.phone_line_id, 
                description, 
                audioBlob, 
                recordingTime,
                resolverName
            );
            alert('خرابی با موفقیت رفع شد.');
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`رفع خرابی خط ${fault.phone_line?.phone_number}`}>
            <div className="p-4 space-y-4">
                {error && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{error}</div>}
                
                <div className="bg-green-50 p-3 rounded border border-green-200 text-green-800 text-sm">
                    <p>شما در حال ثبت رفع خرابی برای خط <strong>{fault.phone_line?.phone_number}</strong> هستید.</p>
                    <p className="mt-1">نوع خرابی: {fault.fault_type}</p>
                </div>

                <TextArea 
                    label="توضیحات اقدامات انجام شده (اختیاری)" 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    placeholder="شرح دهید چه کاری برای رفع خرابی انجام شد..."
                />

                <div className="bg-gray-50 p-4 rounded border">
                    <label className="block text-sm font-medium mb-2">گزارش صوتی (اختیاری)</label>
                    {micError && <p className="text-red-500 text-sm mb-2">{micError}</p>}
                    
                    {!isRecording && !audioBlob && (
                        <Button type="button" variant="secondary" fullWidth onClick={startRecording}>
                            <i className="fas fa-microphone ml-2"></i> ضبط گزارش صوتی
                        </Button>
                    )}

                    {isRecording && (
                        <div className="flex items-center justify-between text-red-600 border p-2 rounded bg-white">
                            <div className="flex items-center">
                                <span className="animate-pulse ml-2">●</span>
                                <span>در حال ضبط... {formatTime(recordingTime)}</span>
                            </div>
                            <Button type="button" variant="danger" size="sm" onClick={() => stopRecording()}>توقف</Button>
                        </div>
                    )}

                    {audioBlob && (
                        <div className="space-y-2">
                            <div className="flex items-center text-green-600 text-sm">
                                <i className="fas fa-check ml-1"></i> فایل صوتی آماده شد
                            </div>
                            <audio src={audioUrl!} controls className="w-full h-8" />
                            <Button type="button" variant="ghost" size="sm" onClick={() => stopRecording(true)} className="text-red-500">
                                <CloseIcon className="ml-1" /> حذف صدا
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 space-x-2 space-x-reverse">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>لغو</Button>
                    <Button variant="success" onClick={handleResolve} loading={isSaving} disabled={isSaving || isRecording}>
                        تایید و رفع خرابی
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
