
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RecurrenceType, User } from '../../../types';
import { createMaintenanceSchedule, getMaintenanceScheduleById, updateMaintenanceSchedule } from '../../../services/cnsMaintenanceService';
import { getUsers } from '../../../services/authService';
import { getNotificationDefaults, handleNotifications } from '../../../services/notificationService';
import { Button } from '../../ui/Button';
import { Input, TextArea } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';

export const ScheduleForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
      title: '',
      description: '',
      recurrence_type: RecurrenceType.MONTHLY,
      start_date: '',
      warning_days: 5,
      assigned_to: ''
  });

  // Users & Notifications
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [sendSms, setSendSms] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(true);

  useEffect(() => {
      const init = async () => {
          setIsLoading(true);
          try {
              const users = await getUsers();
              setSystemUsers(users);
              
              if (id) {
                  const data = await getMaintenanceScheduleById(id);
                  if (data) {
                      setFormData({
                          title: data.title,
                          description: data.description || '',
                          recurrence_type: data.recurrence_type,
                          start_date: data.start_date,
                          warning_days: data.warning_days,
                          assigned_to: data.assigned_to || ''
                      });
                  }
              } else {
                  setFormData(prev => ({ ...prev, start_date: new Date().toISOString().split('T')[0] }));
                  // Load defaults only for new records
                  const defaults = await getNotificationDefaults();
                  setSendSms(defaults.maintenance.sms.enabled);
                  setSendTelegram(defaults.maintenance.telegram.enabled);
              }
          } catch(e) {
              console.error(e);
          } finally {
              setIsLoading(false);
          }
      };
      init();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          let scheduleId = id;
          if (id) {
              await updateMaintenanceSchedule(id, { ...formData, assigned_to: formData.assigned_to || null });
          } else {
              const newSchedule = await createMaintenanceSchedule({ ...formData, assigned_to: formData.assigned_to || null });
              scheduleId = newSchedule.id;
          }

          // --- Notification ---
          if (formData.assigned_to) {
              const appUrl = window.location.origin + window.location.pathname;
              const link = `${appUrl}#/maintenance/details/${scheduleId}`;
              
              const action = id ? 'ویرایش برنامه نگهداری' : 'برنامه نگهداری جدید';
              
              await handleNotifications(
                  formData.assigned_to,
                  'maintenance',
                  {
                      title: formData.title,
                      recurrence: formData.recurrence_type,
                      startDate: new Date(formData.start_date).toLocaleDateString('fa-IR'),
                      description: formData.description,
                      link
                  },
                  { sms: sendSms, telegram: sendTelegram }
              );
          }

          navigate('/maintenance/list');
      } catch (err) {
          alert('خطا در ذخیره‌سازی');
          setIsLoading(false);
      }
  };

  // Helper to show Jalali date
  const getJalaliDate = (isoDate: string) => {
      if (!isoDate) return '';
      return new Date(isoDate).toLocaleDateString('fa-IR');
  };

  if (isLoading && id && !formData.title) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl max-w-2xl">
      <h2 className="text-2xl font-bold mb-6 border-b pb-4">
          {id ? 'ویرایش برنامه نگهداری' : 'افزودن برنامه نگهداری جدید'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
              label="نام فعالیت *" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              required
              placeholder="مثال: سرویس و تمیزکاری سایت NDB"
          />
          
          <Select 
              label="بازه تکرار *"
              value={formData.recurrence_type}
              onChange={e => setFormData({...formData, recurrence_type: e.target.value as RecurrenceType})}
              options={Object.values(RecurrenceType).map(val => ({ value: val, label: val }))}
          />
          
          <div>
              <Input 
                  label="زمان آغاز انجام کار *" 
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                  required
              />
              {formData.start_date && (
                  <p className="text-xs text-gray-500 mt-1 mr-1">
                      تاریخ انتخابی: <span className="font-bold text-indigo-600">{getJalaliDate(formData.start_date)}</span>
                  </p>
              )}
          </div>
          
          <Input 
              label="آغاز زمان هشدار (روز قبل از سررسید) *" 
              type="number"
              value={formData.warning_days}
              onChange={e => setFormData({...formData, warning_days: parseInt(e.target.value) || 0})}
              required
          />
          
          {/* Assignment Section */}
          <div className="bg-gray-50 p-3 rounded border">
              <label className="block text-sm font-medium text-gray-700 mb-2">مسئول برنامه (اختیاری)</label>
              <Select 
                  options={[{ value: '', label: 'انتخاب کنید...' }, ...systemUsers.map(u => ({ value: u.full_name || u.username, label: u.full_name || u.username }))]}
                  value={formData.assigned_to}
                  onChange={e => setFormData({...formData, assigned_to: e.target.value})}
                  className="mb-3"
              />
              
              {formData.assigned_to && (
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

          <TextArea
              label="توضیحات و دستورالعمل‌ها"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={4}
              placeholder="چک لیست یا توضیحات مربوط به نحوه انجام کار را اینجا وارد کنید..."
          />

          <div className="flex justify-end pt-4 border-t mt-6 space-x-2 space-x-reverse">
              <Button type="button" variant="secondary" onClick={() => navigate('/maintenance/list')}>لغو</Button>
              <Button type="submit" variant="primary" loading={isLoading}>ذخیره</Button>
          </div>
      </form>
    </div>
  );
};
