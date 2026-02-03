import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { PhoneLineFault, PhoneLineFaultVoiceNote, FaultType, PhoneLine, FaultStatus } from '../../types';
import { getFaultWithNotes, addVoiceNoteToFault, updateFault, reopenFault } from '../../supabaseService';
import { CloseIcon, InfoIcon, EditIcon, LogIcon, RouteIcon } from '../ui/Icons';
import { Input, TextArea } from '../ui/Input';
import { Select } from '../ui/Select';
import { FAULT_TYPES } from '../../constants';
import { PhoneLineLogModal } from './PhoneLineLogModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface FaultDetailsAndNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    faultId: string;
    onUpdate: () => void; // To refresh the list when a note is added
}

const formatTime = (time: number) => new Date(time * 1000).toISOString().substr(14, 5);
const MAX_RECORDING_TIME = 180; // 3 minutes in seconds

export const FaultDetailsAndNotesModal: React.FC<FaultDetailsAndNotesModalProps> = ({ isOpen, onClose, faultId, onUpdate }) => {
    const [fault, setFault] = useState<PhoneLineFault | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [editableFault, setEditableFault] = useState<Partial<PhoneLineFault>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Other modals
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isReopenConfirmOpen, setIsReopenConfirmOpen] = useState(false);
    const [isReopening, setIsReopening] = useState(false);

    // Voice recording state
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<number | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [micError, setMicError] = useState<string | null>(null);
    const [recorderName, setRecorderName] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    const fetchFaultDetails = useCallback(async () => {
        if (!faultId) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await getFaultWithNotes(faultId);
            setFault(data);
            if (data) {
                setEditableFault({
                    fault_type: data.fault_type,
                    description: data.description,
                    reporter_name: data.reporter_name,
                });
            }
        } catch (err: any) {
            setError(`خطا در بارگذاری جزئیات خرابی: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [faultId]);

    useEffect(() => {
        if (isOpen) {
            fetchFaultDetails();
        } else {
            // Cleanup on close
            setIsEditMode(false);
            stopRecording(true);
            setAudioBlob(null);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setMicError(null);
        }
    }, [isOpen, fetchFaultDetails]);

    // --- Edit Logic ---
    const handleEnterEditMode = () => {
        if (fault) {
            setEditableFault({
                fault_type: fault.fault_type,
                description: fault.description,
                reporter_name: fault.reporter_name,
            });
            setIsEditMode(true);
        }
    };
    const handleCancelEdit = () => setIsEditMode(false);
    const handleFieldChange = (field: keyof typeof editableFault, value: string) => {
        setEditableFault(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveChanges = async () => {
        if (!fault) return;
        setIsSaving(true);
        setError(null);
        try {
            await updateFault(fault.id, {
                fault_type: editableFault.fault_type,
                description: editableFault.description,
                reporter_name: editableFault.reporter_name,
            });
            alert('تغییرات با موفقیت ذخیره شد.');
            setIsEditMode(false);
            await fetchFaultDetails();
            onUpdate();
        } catch (err: any) {
            setError(`خطا در ذخیره تغییرات: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleReopenClick = () => {
        if (fault) {
            setIsReopenConfirmOpen(true);
        }
    };
    
    const handleConfirmReopen = async () => {
        if (!fault) return;
        setIsReopening(true);
        setError(null);
        try {
            await reopenFault(fault.id);
            alert('خرابی با موفقیت بازگشایی شد.');
            setIsReopenConfirmOpen(false);
            await fetchFaultDetails(); // Refresh details in the modal
            onUpdate(); // Refresh the list in the parent component
        } catch (err: any) {
            setError(`خطا در بازگشایی خرابی: ${err.message}`);
        } finally {
            setIsReopening(false);
        }
    };


    // --- Voice Recording Logic ---
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
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
    };
    
    const handleSaveNote = async () => {
        if (!audioBlob || !fault) return;
        setIsSavingNote(true);
        setError(null);
        try {
            await addVoiceNoteToFault(fault.id, audioBlob, recorderName || null, recordingTime);
            alert('گزارش صوتی با موفقیت افزوده شد.');
            setAudioBlob(null);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setRecorderName('');
            setRecordingTime(0);
            await fetchFaultDetails();
            onUpdate();
        } catch(err: any) {
            setError(`خطا در ذخیره گزارش صوتی: ${err.message}`);
        } finally {
            setIsSavingNote(false);
        }
    };
    
    const isBusy = isEditMode || isRecording || isSaving || isSavingNote || isReopening;

    return (
        <>
        <Modal 
            isOpen={isOpen} 
            onClose={isBusy ? undefined : onClose} // Prevent closing while busy
            title={`جزئیات خرابی خط ${fault?.phone_line?.phone_number || ''}`}
            className="sm:max-w-3xl"
        >
            {isLoading ? <div className="flex justify-center p-8"><Spinner /></div> : 
             error ? <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div> :
             !fault ? <div className="p-4 text-gray-600">اطلاعات خرابی یافت نشد.</div> :
            (
                <div className="space-y-6 p-4">
                     {/* Fault Details & Edit Section */}
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold text-gray-800">اطلاعات اصلی خرابی</h3>
                            {!isEditMode && fault.status === 'گزارش شده' && (
                                <Button variant="secondary" size="sm" onClick={handleEnterEditMode}>
                                    <EditIcon className="ml-2"/> ویرایش
                                </Button>
                            )}
                        </div>
                        {isEditMode ? (
                            <div className="space-y-4">
                                <Select
                                    label="نوع خرابی"
                                    options={FAULT_TYPES.map(ft => ({ value: ft, label: ft }))}
                                    value={editableFault.fault_type || ''}
                                    onChange={(e) => handleFieldChange('fault_type', e.target.value as FaultType)}
                                    fullWidth
                                />
                                <TextArea
                                    label="توضیحات"
                                    value={editableFault.description || ''}
                                    onChange={(e) => handleFieldChange('description', e.target.value)}
                                    rows={3}
                                    fullWidth
                                />
                                <Input
                                    label="نام گزارش دهنده"
                                    value={editableFault.reporter_name || ''}
                                    onChange={(e) => handleFieldChange('reporter_name', e.target.value)}
                                    fullWidth
                                />
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <Button variant="primary" onClick={handleSaveChanges} loading={isSaving} disabled={isSaving}>ذخیره</Button>
                                    <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>لغو</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1 text-sm">
                                <p><strong>شماره تلفن:</strong> {fault.phone_line?.phone_number}</p>
                                <p><strong>نوع خرابی:</strong> {fault.fault_type}</p>
                                <p><strong>توضیحات:</strong> {fault.description || '---'}</p>
                                <p><strong>گزارش دهنده:</strong> {fault.reporter_name || '---'}</p>
                                <p><strong>تاریخ گزارش:</strong> {new Date(fault.reported_at).toLocaleString('fa-IR')}</p>
                                <p>
                                    <strong>وضعیت:</strong> {fault.status}
                                    {fault.status === FaultStatus.RESOLVED && fault.resolved_at && ` (در تاریخ ${new Date(fault.resolved_at).toLocaleDateString('fa-IR')})`}
                                </p>
                            </div>
                        )}
                    </div>
                    
                    {/* Links section */}
                    <div className="p-4 border rounded-lg flex items-center justify-center space-x-4 space-x-reverse">
                        <Button variant="outline" size="sm" onClick={() => setIsLogModalOpen(true)}>
                            <LogIcon className="ml-2" /> تاریخچه خط
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/phone-lines/view/${fault.phone_line?.phone_number}`)}>
                            <RouteIcon className="ml-2" /> مشاهده مسیر خط
                        </Button>
                         {fault.status === FaultStatus.RESOLVED && (
                            <Button variant="warning" size="sm" onClick={handleReopenClick} disabled={isReopening}>
                                <i className="fas fa-undo ml-2"></i> باز کردن مجدد خرابی
                            </Button>
                        )}
                    </div>


                    {/* Voice Notes List */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">گزارش‌های صوتی</h3>
                        <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {fault.voice_notes && fault.voice_notes.length > 0 ? (
                                fault.voice_notes.map(note => (
                                    <div key={note.id} className="p-3 border bg-white rounded-md">
                                        <audio controls src={note.audio_url} className="w-full"></audio>
                                        <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                                            <span>ثبت توسط: {note.recorder_name || 'نامشخص'}</span>
                                            <span>{new Date(note.created_at).toLocaleString('fa-IR')}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center text-gray-500 p-4 border-2 border-dashed rounded-lg">
                                    <InfoIcon className="ml-2" />
                                    <span>هیچ گزارش صوتی برای این خرابی ثبت نشده است.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add New Voice Note Section */}
                     <div className="p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">افزودن گزارش صوتی جدید</h3>
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
                                <audio src={audioUrl} controls className="w-full"></audio>
                                <Input 
                                    label="نام ثبت کننده (اختیاری)"
                                    value={recorderName}
                                    onChange={e => setRecorderName(e.target.value)}
                                    placeholder="نام خود را وارد کنید"
                                />
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <Button type="button" variant="primary" onClick={handleSaveNote} loading={isSavingNote} disabled={isSavingNote}>
                                        ذخیره این گزارش
                                    </Button>
                                    <Button type="button" variant="ghost" onClick={() => stopRecording(true)}>
                                         <CloseIcon className="ml-1 text-red-500" /> لغو
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Modal>
        {fault?.phone_line && fault.phone_line_id && (
            <PhoneLineLogModal
                isOpen={isLogModalOpen}
                onClose={() => setIsLogModalOpen(false)}
                phoneLine={{ 
                    id: fault.phone_line_id, 
                    phone_number: fault.phone_line.phone_number, 
                    consumer_unit: fault.phone_line.consumer_unit || null, 
                    created_at: '', 
                    has_active_fault: false 
                }}
            />
        )}
        <ConfirmDialog
            isOpen={isReopenConfirmOpen}
            onClose={() => setIsReopenConfirmOpen(false)}
            onConfirm={handleConfirmReopen}
            title="باز کردن مجدد خرابی"
            message={`آیا از باز کردن مجدد این خرابی برای خط ${fault?.phone_line?.phone_number} مطمئن هستید؟ وضعیت خرابی به "گزارش شده" تغییر خواهد کرد.`}
            confirmText="بله، باز کن"
            isConfirming={isReopening}
            confirmButtonVariant="warning"
        />
        </>
    );
};