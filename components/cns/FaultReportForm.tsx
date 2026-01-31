
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCNSFaultReport, getCNSEquipments } from '../../services/cnsService';
import { CNSEquipment, CNSFaultPriority, CNSFaultStatus, User } from '../../types';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { ImageUpload } from '../assets/ImageUpload';
import { CameraIcon, CloseIcon, AddIcon } from '../ui/Icons';
import { useAuth } from '../../AuthContext';
import { getUsers } from '../../services/authService';
import { getNotificationDefaults, handleNotifications } from '../../services/notificationService';

const PRIORITIES = Object.values(CNSFaultPriority);

export const FaultReportForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Equipment Search
  const [equipments, setEquipments] = useState<CNSEquipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<CNSEquipment | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Form Data
  const [faultType, setFaultType] = useState('');
  const [priority, setPriority] = useState<CNSFaultPriority>(CNSFaultPriority.MEDIUM);
  const [description, setDescription] = useState('');
  
  // Assignment & Notification
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(true);

  // Audio
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Images
  const [images, setImages] = useState<File[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Load data
  useEffect(() => {
      const init = async () => {
          getCNSEquipments().then(setEquipments);
          getUsers().then(setSystemUsers);
          const defaults = await getNotificationDefaults();
          setSendSms(defaults.cns.sms.enabled);
          setSendTelegram(defaults.cns.telegram.enabled);
      };
      init();
  }, []);

  const filteredEquipments = equipments.filter(e => 
      e.name_cns.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.asset_number && e.asset_number.includes(searchTerm))
  );

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          let options = { mimeType: 'audio/mp4' };
          if (!MediaRecorder.isTypeSupported('audio/mp4')) {
              options = { mimeType: '' }; 
          }
          
          const recorder = new MediaRecorder(stream, options);
          mediaRecorderRef.current = recorder;
          const chunks: BlobPart[] = [];
          
          recorder.ondataavailable = e => chunks.push(e.data);
          recorder.onstop = () => {
              const blob = new Blob(chunks, { type: 'audio/mp4' });
              setAudioBlob(blob);
              stream.getTracks().forEach(track => track.stop());
          };
          
          recorder.start();
          setIsRecording(true);
      } catch (err) {
          alert('عدم دسترسی به میکروفون');
      }
  };

  const stopRecording = () => {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
  };

  const handleImageUpload = async (files: File[]) => {
      setImages(prev => [...prev, ...files]);
      setIsImageModalOpen(false);
  };

  const removeImage = (index: number) => {
      setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedEquipment) {
          alert('لطفا تجهیز را انتخاب کنید');
          return;
      }
      setIsLoading(true);
      
      const reporterName = user?.full_name || user?.username || 'کاربر ناشناس';

      try {
          const report = await createCNSFaultReport({
              equipment_id: selectedEquipment.id,
              fault_type: faultType,
              priority_level: priority,
              description,
              reporter_user: reporterName,
              assigned_to: assignedTo || null,
              status: CNSFaultStatus.REPORTED,
              start_time: new Date().toISOString(),
              close_time: null,
              reopen_reason: null
          }, audioBlob, images);

          // --- Notification ---
          if (assignedTo) {
              const appUrl = window.location.origin + window.location.pathname;
              const link = `${appUrl}#/cns/faults/${report.id}`;
              
              await handleNotifications(
                  assignedTo,
                  'cns',
                  {
                      equipment: selectedEquipment.name_cns,
                      faultType,
                      priority,
                      description,
                      reporter: reporterName,
                      link
                  },
                  { sms: sendSms, telegram: sendTelegram }
              );
          }

          navigate('/cns/faults');
      } catch (err) {
          alert('خطا در ثبت گزارش');
          setIsLoading(false);
      }
  };

  return (
      <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl max-w-2xl">
          <h2 className="text-2xl font-bold mb-6 border-b pb-4">ثبت گزارش خرابی CNS</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
              {/* Equipment Search */}
              <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">انتخاب تجهیز *</label>
                  {selectedEquipment ? (
                      <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded">
                          <div>
                              <div className="font-bold">{selectedEquipment.name_cns}</div>
                              <div className="text-xs text-gray-500">حوزه: {selectedEquipment.operational_area}</div>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => setSelectedEquipment(null)}>تغییر</Button>
                      </div>
                  ) : (
                      <>
                          <Input 
                              placeholder="جستجوی نام دستگاه یا شماره اموال..."
                              value={searchTerm}
                              onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                              onFocus={() => setShowDropdown(true)}
                          />
                          {showDropdown && searchTerm && (
                              <ul className="absolute z-10 w-full bg-white border rounded shadow-lg mt-1 max-h-48 overflow-auto">
                                  {filteredEquipments.map(eq => (
                                      <li key={eq.id} className="p-2 hover:bg-gray-100 cursor-pointer border-b" onClick={() => { setSelectedEquipment(eq); setShowDropdown(false); }}>
                                          <div className="font-bold">{eq.name_cns}</div>
                                          <div className="text-xs text-gray-500">{eq.asset_number ? `اموال: ${eq.asset_number}` : ''}</div>
                                      </li>
                                  ))}
                                  {filteredEquipments.length === 0 && (
                                      <li className="p-2 text-gray-500 text-sm">موردی یافت نشد.</li>
                                  )}
                              </ul>
                          )}
                      </>
                  )}
              </div>

              <Input label="نوع خرابی *" value={faultType} onChange={e => setFaultType(e.target.value)} required />
              
              <Select 
                  label="اولویت *" 
                  value={priority} 
                  onChange={e => setPriority(e.target.value as CNSFaultPriority)}
                  options={PRIORITIES.map(p => ({value: p, label: p}))}
              />
              
              <TextArea label="توضیحات *" value={description} onChange={e => setDescription(e.target.value)} required rows={4} />
              
              {/* Assignment Section */}
              <div className="bg-gray-50 p-3 rounded border">
                  <label className="block text-sm font-medium text-gray-700 mb-2">مسئول رسیدگی (اختیاری)</label>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Audio Recorder */}
                <div className="border p-4 rounded bg-gray-50">
                    <label className="block text-sm font-medium mb-2">گزارش صوتی</label>
                    {!isRecording && !audioBlob && (
                        <Button type="button" variant="secondary" fullWidth onClick={startRecording}>
                            <i className="fas fa-microphone ml-2"></i> شروع ضبط
                        </Button>
                    )}
                    {isRecording && (
                        <div className="flex items-center justify-between text-red-600">
                            <span className="animate-pulse">● در حال ضبط...</span>
                            <Button type="button" variant="danger" size="sm" onClick={stopRecording}>توقف</Button>
                        </div>
                    )}
                    {audioBlob && (
                        <div className="flex items-center justify-between text-green-600">
                            <span className="text-xs"><i className="fas fa-check ml-1"></i> فایل صوتی آماده</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAudioBlob(null)} className="text-red-500">حذف</Button>
                        </div>
                    )}
                </div>

                {/* Image Upload */}
                <div className="border p-4 rounded bg-gray-50">
                    <label className="block text-sm font-medium mb-2">تصاویر</label>
                    <Button type="button" variant="secondary" fullWidth onClick={() => setIsImageModalOpen(true)}>
                        <CameraIcon className="ml-2" /> افزودن تصویر
                    </Button>
                    {images.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative group w-16 h-16">
                                    <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover rounded" />
                                    <button type="button" onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t mt-6">
                  <Button type="button" variant="secondary" onClick={() => navigate('/cns/faults')} className="ml-2">لغو</Button>
                  <Button type="submit" variant="primary" loading={isLoading}>ثبت گزارش</Button>
              </div>
          </form>

          <ImageUpload 
              isOpen={isImageModalOpen}
              onClose={() => setIsImageModalOpen(false)}
              onUpload={handleImageUpload}
              isUploading={false} // Not uploading immediately, just selecting
          />
      </div>
  );
};
