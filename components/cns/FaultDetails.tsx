
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getCNSFaultById, addCNSActionLog, updateCNSFaultStatus } from '../../services/cnsService';
import { CNSFaultReport, CNSFaultStatus } from '../../types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Modal } from '../ui/Modal';
import { TextArea, Input } from '../ui/Input';
import { ImageUpload } from '../assets/ImageUpload';
import { CameraIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../AuthContext';
import { handleAdminActionNotification } from '../../services/notificationService';

export const FaultDetails: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [fault, setFault] = useState<CNSFaultReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Action Form
  const [actionDesc, setActionDesc] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [actionImages, setActionImages] = useState<File[]>([]); // For Action Images
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reopen Modal
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Close Modal State
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const currentUserName = user?.full_name || user?.username || 'کاربر ناشناس';

  useEffect(() => {
      loadData();
  }, [id]);

  const loadData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
          const data = await getCNSFaultById(id);
          setFault(data);
      } catch (err) {
          console.error(err);
      } finally {
          setIsLoading(false);
      }
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
      } catch (err) { alert('Error accessing mic'); }
  };

  const stopRecording = () => {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
  };

  const handleImageSelect = async (files: File[]) => {
      setActionImages(prev => [...prev, ...files]);
      setIsImageModalOpen(false);
  };

  const handleAddAction = async () => {
      if (!actionDesc.trim() || !fault) return;
      setIsSubmitting(true);
      try {
          // If status is "Reported", change to "In Progress" automatically on first action
          let statusChange = null;
          if (fault.status === CNSFaultStatus.REPORTED) {
              await updateCNSFaultStatus(fault.id, CNSFaultStatus.IN_PROGRESS);
              statusChange = `تغییر وضعیت به ${CNSFaultStatus.IN_PROGRESS}`;
          }
          
          await addCNSActionLog({
              report_id: fault.id,
              action_user: currentUserName,
              action_description: actionDesc,
              status_change: statusChange,
              audio_url: null, // handled in service
              image_urls: [] // handled in service
          }, audioBlob, actionImages);
          
          // Notify Admins
          const appUrl = window.location.origin + window.location.pathname;
          const link = `${appUrl}#/cns/faults/${fault.id}`;
          await handleAdminActionNotification(
              'cns',
              actionDesc,
              currentUserName,
              {
                  equipment: fault.equipment?.name_cns,
                  link: link
              }
          );

          setActionDesc('');
          setAudioBlob(null);
          setActionImages([]);
          await loadData();
      } catch (err: any) {
          alert(`خطا در ثبت اقدام: ${err.message || 'ناشناخته'}`);
      } finally {
          setIsSubmitting(false);
      }
  };

  // Opens the confirmation dialog
  const handleCloseTicketClick = () => {
      setIsCloseConfirmOpen(true);
  };

  // Executes the close logic after confirmation
  const executeCloseTicket = async () => {
      if (!fault || !fault.id) return;
      
      setIsSubmitting(true);
      try {
          // 1. Update Status
          await updateCNSFaultStatus(fault.id, CNSFaultStatus.CLOSED);
          
          // 2. Log Action
          const closeDesc = `تغییر وضعیت به بسته شده (توسط ${currentUserName})`;
          await addCNSActionLog({
              report_id: fault.id,
              action_user: currentUserName,
              action_description: closeDesc,
              status_change: CNSFaultStatus.CLOSED,
              audio_url: null,
              image_urls: []
          }, null, []);

          // Notify Admins
          const appUrl = window.location.origin + window.location.pathname;
          const link = `${appUrl}#/cns/faults/${fault.id}`;
          await handleAdminActionNotification(
              'cns',
              closeDesc,
              currentUserName,
              {
                  equipment: fault.equipment?.name_cns,
                  link: link
              }
          );
          
          setIsCloseConfirmOpen(false);
          await loadData(); // Refresh data instead of reloading page
      } catch (err: any) {
          alert(`خطا در عملیات بستن خرابی: ${err.message || JSON.stringify(err)}`);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleReopenTicket = async () => {
      if (!fault || !reopenReason.trim()) {
          alert('لطفا دلیل بازگشایی را وارد کنید.');
          return;
      }
      
      setIsSubmitting(true);
      try {
          await updateCNSFaultStatus(fault.id, CNSFaultStatus.REOPENED, reopenReason);
          const reopenDesc = `بازگشایی مجدد توسط ${currentUserName}: ${reopenReason}`;
          
           await addCNSActionLog({
              report_id: fault.id,
              action_user: currentUserName,
              action_description: reopenDesc,
              status_change: CNSFaultStatus.REOPENED,
              audio_url: null, image_urls: []
          }, null, []);
          
          // Notify Admins
          const appUrl = window.location.origin + window.location.pathname;
          const link = `${appUrl}#/cns/faults/${fault.id}`;
          await handleAdminActionNotification(
              'cns',
              reopenDesc,
              currentUserName,
              {
                  equipment: fault.equipment?.name_cns,
                  link: link
              }
          );

          setIsReopenModalOpen(false);
          setReopenReason('');
          alert('خرابی با موفقیت بازگشایی شد.');
          await loadData();
      } catch (err: any) { 
          console.error(err);
          alert(`خطا در بازگشایی مجدد: ${err.message || 'ناشناخته'}`); 
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isLoading || !fault) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
      <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">خرابی: {fault.equipment?.name_cns}</h2>
                  <span className={`px-3 py-1 rounded text-sm ${fault.status === CNSFaultStatus.CLOSED ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {fault.status}
                  </span>
                  <span className="mr-2 text-gray-500 text-sm">اولویت: {fault.priority_level}</span>
              </div>
              <div className="flex space-x-2 space-x-reverse">
                  {fault.status !== CNSFaultStatus.CLOSED ? (
                      <Button 
                        type="button"
                        variant="success" 
                        onClick={handleCloseTicketClick} 
                        disabled={isSubmitting} 
                        loading={isSubmitting}
                      >
                        بستن خرابی
                      </Button>
                  ) : (
                      <Button 
                        type="button"
                        variant="warning" 
                        onClick={() => setIsReopenModalOpen(true)} 
                        disabled={isSubmitting}
                      >
                        باز کردن مجدد
                      </Button>
                  )}
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Info Sidebar */}
              <div className="md:col-span-1 bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold mb-3 text-gray-700">اطلاعات پایه</h4>
                  <p className="text-sm mb-2"><strong>تجهیز:</strong> {fault.equipment?.name_cns}</p>
                  <p className="text-sm mb-2"><strong>حوزه:</strong> {fault.equipment?.operational_area}</p>
                  <p className="text-sm mb-2"><strong>نوع خرابی:</strong> {fault.fault_type}</p>
                  <p className="text-sm mb-2"><strong>گزارش دهنده:</strong> {fault.reporter_user || '---'}</p>
                  <p className="text-sm mb-2"><strong>زمان شروع:</strong> {new Date(fault.start_time).toLocaleString('fa-IR')}</p>
                  <div className="mt-4">
                      <strong className="block text-sm mb-1">توضیحات اولیه:</strong>
                      <p className="text-sm text-gray-600 bg-white p-2 rounded border">{fault.description}</p>
                  </div>
                  {/* Display Initial Report Images */}
                  {fault.image_urls && fault.image_urls.length > 0 && (
                      <div className="mt-4">
                          <strong className="block text-sm mb-2">تصاویر گزارش:</strong>
                          <div className="grid grid-cols-2 gap-2">
                              {fault.image_urls.map((url, idx) => (
                                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                      <img src={url} alt="fault" className="w-full h-20 object-cover rounded border" />
                                  </a>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

              {/* Timeline */}
              <div className="md:col-span-2">
                  <h4 className="font-bold mb-4 text-gray-700 border-b pb-2">روند پیگیری (Timeline)</h4>
                  <div className="space-y-6 mb-8">
                      {fault.action_logs?.map(log => (
                          <div key={log.id} className="relative pr-8 border-r-2 border-gray-200">
                              <div className="absolute top-0 -right-2 w-4 h-4 bg-indigo-500 rounded-full"></div>
                              <div className="bg-gray-50 p-3 rounded shadow-sm">
                                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                                      <span className="font-bold text-indigo-700">{log.action_user || 'کاربر'}</span>
                                      <span>{new Date(log.action_time).toLocaleString('fa-IR')}</span>
                                  </div>
                                  <p className="text-gray-800">{log.action_description}</p>
                                  {log.status_change && (
                                      <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                          {log.status_change}
                                      </span>
                                  )}
                                  {/* Log Images */}
                                  {log.image_urls && log.image_urls.length > 0 && (
                                      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                                          {log.image_urls.map((url, idx) => (
                                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                                  <img src={url} className="h-16 rounded border" alt="action" />
                                              </a>
                                          ))}
                                      </div>
                                  )}
                                  {log.audio_url && (
                                      <div className="mt-2">
                                          <audio controls src={log.audio_url} className="h-8 w-full" />
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                      {fault.action_logs?.length === 0 && <p className="text-gray-500 text-center">هنوز اقدامی ثبت نشده است.</p>}
                  </div>

                  {/* Add Action */}
                  {fault.status !== CNSFaultStatus.CLOSED && (
                      <div className="bg-white p-4 rounded border-2 border-dashed border-gray-300">
                          <h5 className="font-bold mb-3">ثبت اقدام جدید</h5>
                          <div className="grid grid-cols-1 gap-3">
                             <TextArea placeholder="شرح اقدام..." value={actionDesc} onChange={e => setActionDesc(e.target.value)} />
                             <div className="flex items-center space-x-2 space-x-reverse">
                                 {!isRecording && !audioBlob && <Button type="button" size="sm" variant="secondary" onClick={startRecording}>ضبط صدا</Button>}
                                 {isRecording && <Button type="button" size="sm" variant="danger" onClick={stopRecording}>توقف</Button>}
                                 {audioBlob && <span className="text-green-600 text-sm">صدا ضبط شد</span>}
                                 
                                 <Button type="button" size="sm" variant="secondary" onClick={() => setIsImageModalOpen(true)}>
                                     <CameraIcon className="ml-1" /> تصویر ({actionImages.length})
                                 </Button>
                             </div>
                             <Button variant="primary" onClick={handleAddAction} loading={isSubmitting} disabled={isSubmitting}>ثبت اقدام</Button>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* Reopen Modal */}
          <Modal isOpen={isReopenModalOpen} onClose={() => setIsReopenModalOpen(false)} title="بازگشایی مجدد">
              <div className="p-4">
                  <TextArea 
                      label="علت بازگشایی *" 
                      value={reopenReason} 
                      onChange={e => setReopenReason(e.target.value)} 
                      required
                  />
                  <div className="flex justify-end mt-4 space-x-2 space-x-reverse">
                      <Button variant="secondary" onClick={() => setIsReopenModalOpen(false)} disabled={isSubmitting}>لغو</Button>
                      <Button variant="warning" onClick={handleReopenTicket} loading={isSubmitting} disabled={isSubmitting}>تایید و بازگشایی</Button>
                  </div>
              </div>
          </Modal>
          
          {/* Close Confirmation Modal */}
          <ConfirmDialog 
            isOpen={isCloseConfirmOpen}
            onClose={() => setIsCloseConfirmOpen(false)}
            onConfirm={executeCloseTicket}
            title="بستن خرابی"
            message="آیا از بستن این خرابی و بایگانی آن اطمینان دارید؟ وضعیت به بسته شده تغییر خواهد کرد."
            confirmText="بله، بستن خرابی"
            confirmButtonVariant="success"
            isConfirming={isSubmitting}
          />

          <ImageUpload 
              isOpen={isImageModalOpen}
              onClose={() => setIsImageModalOpen(false)}
              onUpload={handleImageSelect}
              isUploading={false}
          />
      </div>
  );
};
