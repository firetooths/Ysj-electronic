
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createCNSEquipment, getCNSEquipmentById, updateCNSEquipment, searchAssetsForCNS, checkCNSEquipmentDuplicate } from '../../services/cnsService';
import { getContacts, createContact } from '../../services/contactService';
import { getAssetById } from '../../services/assetService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { Asset, Contact } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const AREAS = ['ناوبری', 'ارتباطی', 'نظارتی', 'کمک بازرسی', 'برق و تاسیسات', 'سایر'];

export const EquipmentForm: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  const importFromAssetId = searchParams.get('importFromAsset');
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
      name_cns: '',
      operational_area: 'ناوبری',
      asset_number: '',
      serial_number: '',
      manufacturer: '',
      location: '',
      support_contact: '',
      is_imported_from_amval: false
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Asset Link States
  const [assetSearchResults, setAssetSearchResults] = useState<Asset[]>([]);
  const [isSearchingAsset, setIsSearchingAsset] = useState(false);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');

  // Contact Link States
  const [contactMode, setContactMode] = useState<'search' | 'new'>('search');
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<Contact[]>([]);
  const [isSearchingContact, setIsSearchingContact] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // New Contact Form States
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // Duplicate Warning
  const [isDuplicateWarningOpen, setIsDuplicateWarningOpen] = useState(false);


  useEffect(() => {
      if (id) {
          // Edit Mode
          setIsLoading(true);
          getCNSEquipmentById(id).then(data => {
              if (data) {
                  setFormData({
                    name_cns: data.name_cns,
                    operational_area: data.operational_area,
                    asset_number: data.asset_number || '',
                    serial_number: data.serial_number || '',
                    manufacturer: data.manufacturer || '',
                    location: data.location || '',
                    support_contact: data.support_contact || '',
                    is_imported_from_amval: data.is_imported_from_amval
                  });
                  if (data.support_contact) {
                      setContactSearchTerm(data.support_contact);
                  }
              }
              setIsLoading(false);
          });
      } else if (copyFromId) {
          // Copy Mode
          setIsLoading(true);
          getCNSEquipmentById(copyFromId).then(data => {
              if (data) {
                  setFormData({
                    name_cns: data.name_cns + ' (کپی)',
                    operational_area: data.operational_area,
                    asset_number: data.asset_number || '',
                    serial_number: '', // Serial number usually unique
                    manufacturer: data.manufacturer || '',
                    location: data.location || '',
                    support_contact: data.support_contact || '',
                    is_imported_from_amval: data.is_imported_from_amval
                  });
                  if (data.support_contact) {
                      setContactSearchTerm(data.support_contact);
                  }
              }
              setIsLoading(false);
          });
      } else if (importFromAssetId) {
          // Import from Asset Mode
          setIsLoading(true);
          getAssetById(importFromAssetId).then(asset => {
              if (asset) {
                  setFormData({
                    name_cns: asset.name,
                    operational_area: 'ناوبری', // Default
                    asset_number: String(asset.asset_id_number),
                    serial_number: '',
                    manufacturer: '',
                    location: asset.location?.name || '',
                    support_contact: '',
                    is_imported_from_amval: true
                  });
              }
              setIsLoading(false);
          });
      }
  }, [id, copyFromId, importFromAssetId]);

  // --- Asset Search Logic ---
  const handleAssetSearch = async (term: string) => {
      setAssetSearchTerm(term);
      if (term.length >= 3) {
          setIsSearchingAsset(true);
          const results = await searchAssetsForCNS(term);
          setAssetSearchResults(results);
          setIsSearchingAsset(false);
      } else {
          setAssetSearchResults([]);
      }
  };

  const selectAsset = (asset: Asset) => {
      setFormData(prev => ({
          ...prev,
          asset_number: String(asset.asset_id_number),
          is_imported_from_amval: true,
          name_cns: prev.name_cns || asset.name,
          location: prev.location || asset.location?.name || ''
      }));
      setAssetSearchResults([]);
      setAssetSearchTerm('');
  };

  // --- Contact Search Logic ---
  const handleContactSearch = async (term: string) => {
      setContactSearchTerm(term);
      setFormData(prev => ({ ...prev, support_contact: term }));
      
      if (term.length >= 3) {
          setIsSearchingContact(true);
          try {
              const { contacts } = await getContacts(term, null, 1, 5);
              setContactSearchResults(contacts);
          } catch (e) {
              console.error(e);
          } finally {
              setIsSearchingContact(false);
          }
      } else {
          setContactSearchResults([]);
      }
  };

  const selectContact = (contact: Contact) => {
      const phone = contact.phone_numbers?.[0]?.phone_number || '';
      const contactString = `${contact.first_name} ${contact.last_name || ''} - ${phone}`;
      
      setSelectedContact(contact);
      setContactSearchTerm(contactString);
      setFormData(prev => ({ ...prev, support_contact: contactString }));
      setContactSearchResults([]);
  };

  const executeSave = async () => {
      setIsLoading(true);
      try {
          let finalContactString = formData.support_contact;

          if (contactMode === 'new') {
              if (!newContactName.trim() || !newContactPhone.trim()) {
                  alert('نام و شماره تلفن مخاطب الزامی است.');
                  setIsLoading(false);
                  return;
              }

              const nameParts = newContactName.trim().split(' ');
              const firstName = nameParts[0];
              const lastName = nameParts.slice(1).join(' ');

              await createContact(
                  { 
                      first_name: firstName, 
                      last_name: lastName || null, 
                      organization: 'پشتیبان CNS', 
                      job_title: 'پشتیبان فنی',
                      notes: 'ایجاد شده خودکار از طریق فرم تجهیزات CNS'
                  },
                  [{ phone_number: newContactPhone, type: 'موبایل' }],
                  [], 
                  []
              );

              finalContactString = `${newContactName} - ${newContactPhone}`;
          } 

          const payload = { ...formData, support_contact: finalContactString, image_urls: [] };
          
          if (id) {
              await updateCNSEquipment(id, payload);
          } else {
              await createCNSEquipment(payload);
          }
          navigate('/cns/equipment');
      } catch (err: any) {
          alert(`خطا در ذخیره‌سازی: ${err.message}`);
      } finally {
          setIsLoading(false);
          setIsDuplicateWarningOpen(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Check for duplicates before saving
      try {
          const isDuplicate = await checkCNSEquipmentDuplicate(
              formData.name_cns, 
              formData.asset_number || null, 
              id
          );

          if (isDuplicate) {
              setIsDuplicateWarningOpen(true);
          } else {
              executeSave();
          }
      } catch (e) {
          console.error("Error checking for duplicates", e);
          // If check fails, proceed with save anyway or show error? Let's proceed to avoid blocking.
          executeSave(); 
      }
  };

  if (isLoading && id && !formData.name_cns) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl max-w-3xl">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">
            {id ? 'ویرایش تجهیز CNS' : (copyFromId ? 'افزودن تجهیز جدید (کپی)' : 'افزودن تجهیز CNS')}
        </h2>
        
        {importFromAssetId && (
            <div className="mb-6 bg-indigo-50 p-4 rounded border border-indigo-100 text-indigo-800 flex items-center">
                <i className="fas fa-info-circle ml-2 text-xl"></i>
                <div>
                    <p className="font-bold">در حال افزودن از لیست اموال</p>
                    <p className="text-sm">برخی اطلاعات به صورت خودکار از اموال انتخاب شده پر شده‌اند.</p>
                </div>
            </div>
        )}
        
        {/* Asset Link Section */}
        {!importFromAssetId && (
            <div className="mb-8 bg-blue-50 p-4 rounded border border-blue-100">
                <h4 className="font-bold text-blue-800 mb-2">لینک به اموال (اختیاری)</h4>
                <div className="relative">
                    <Input 
                        placeholder="جستجوی شماره اموال یا نام تجهیز (حداقل ۳ حرف)..."
                        value={assetSearchTerm}
                        onChange={e => handleAssetSearch(e.target.value)}
                        fullWidth
                    />
                    {isSearchingAsset && <div className="absolute left-3 top-3"><Spinner className="h-4 w-4" /></div>}
                    {assetSearchResults.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border rounded shadow-lg mt-1 max-h-48 overflow-auto">
                            {assetSearchResults.map(asset => (
                                <li key={asset.id} 
                                    className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                                    onClick={() => selectAsset(asset)}
                                >
                                    <div className="font-bold">{asset.name}</div>
                                    <div className="text-xs text-gray-500">شماره اموال: {asset.asset_id_number} | محل: {asset.location?.name}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                    label="نام دستگاه (در بخش CNS) *" 
                    value={formData.name_cns} 
                    onChange={e => setFormData({...formData, name_cns: e.target.value})} 
                    required 
                />
                <Select 
                    label="حوزه عملیاتی *" 
                    value={formData.operational_area}
                    onChange={e => setFormData({...formData, operational_area: e.target.value})}
                    options={AREAS.map(a => ({value: a, label: a}))}
                />
                <Input 
                    label="شماره اموال" 
                    value={formData.asset_number} 
                    onChange={e => setFormData({...formData, asset_number: e.target.value})} 
                />
                <Input 
                    label="شماره سریال" 
                    value={formData.serial_number} 
                    onChange={e => setFormData({...formData, serial_number: e.target.value})} 
                />
                <Input 
                    label="سازنده" 
                    value={formData.manufacturer} 
                    onChange={e => setFormData({...formData, manufacturer: e.target.value})} 
                />
                <Input 
                    label="محل قرارگیری" 
                    value={formData.location} 
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                />
                
                {/* Support Contact Section */}
                <div className="md:col-span-2 bg-gray-50 p-4 rounded border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">اطلاعات تماس پشتیبان</label>
                    
                    <div className="flex items-center space-x-4 space-x-reverse mb-3">
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="radio" 
                                checked={contactMode === 'search'} 
                                onChange={() => setContactMode('search')} 
                                className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="mr-2 text-sm">جستجو در مخاطبین</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="radio" 
                                checked={contactMode === 'new'} 
                                onChange={() => setContactMode('new')} 
                                className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="mr-2 text-sm">ثبت مخاطب جدید</span>
                        </label>
                    </div>

                    {contactMode === 'search' ? (
                        <div className="relative">
                            <Input 
                                placeholder="نام یا شماره مخاطب را وارد کنید (حداقل ۳ کاراکتر)..."
                                value={contactSearchTerm}
                                onChange={e => handleContactSearch(e.target.value)}
                                fullWidth
                            />
                            {isSearchingContact && <div className="absolute left-3 top-3"><Spinner className="h-4 w-4" /></div>}
                            {contactSearchResults.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border rounded shadow-lg mt-1 max-h-48 overflow-auto">
                                    {contactSearchResults.map(c => (
                                        <li key={c.id} 
                                            className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                                            onClick={() => selectContact(c)}
                                        >
                                            <div className="font-bold">{c.first_name} {c.last_name}</div>
                                            <div className="text-xs text-gray-500">
                                                {c.organization ? `${c.organization} - ` : ''}
                                                {c.phone_numbers?.[0]?.phone_number || 'بدون شماره'}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {selectedContact && (
                                <div className="mt-2 text-xs text-green-700 flex items-center">
                                    <i className="fas fa-check-circle ml-1"></i>
                                    مخاطب انتخاب شده: {selectedContact.first_name} {selectedContact.last_name}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input 
                                placeholder="نام و نام خانوادگی *" 
                                value={newContactName} 
                                onChange={e => setNewContactName(e.target.value)} 
                            />
                            <Input 
                                placeholder="شماره تلفن *" 
                                value={newContactPhone} 
                                onChange={e => setNewContactPhone(e.target.value)} 
                                dir="ltr"
                            />
                            <div className="md:col-span-2 text-xs text-gray-500">
                                <i className="fas fa-info-circle ml-1"></i>
                                با ذخیره فرم، این شخص به لیست مخاطبین اپلیکیشن اضافه خواهد شد.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t mt-6 space-x-2 space-x-reverse">
                <Button type="button" variant="secondary" onClick={() => navigate('/cns/equipment')}>لغو</Button>
                <Button type="submit" variant="primary" loading={isLoading}>ذخیره</Button>
            </div>
        </form>

        <ConfirmDialog 
            isOpen={isDuplicateWarningOpen}
            onClose={() => setIsDuplicateWarningOpen(false)}
            onConfirm={executeSave}
            title="دستگاه تکراری"
            message={`دستگاهی با نام "${formData.name_cns}" و شماره اموال مشابه (یا بدون شماره اموال) قبلاً در سیستم ثبت شده است. آیا از ثبت مجدد آن اطمینان دارید؟`}
            confirmText="بله، ذخیره کن"
            cancelText="لغو"
            confirmButtonVariant="warning"
        />
    </div>
  );
};
