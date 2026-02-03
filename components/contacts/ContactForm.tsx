
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSupabaseContext } from '../../SupabaseContext';
import { createContact, getContactById, updateContact } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { Select } from '../ui/Select';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon } from '../ui/Icons';

// Add type definition for the Contact Picker API
declare global {
  interface Navigator {
    contacts?: {
      select: (properties: string[], options?: { multiple?: boolean }) => Promise<any[]>;
    };
  }
  interface Window {
    ContactsManager?: any;
  }
}

interface PhoneField { value: string; type: string; }
interface EmailField { value: string; type: string; }

export const ContactForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { contactGroups, isLoading: isContextLoading } = useSupabaseContext();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [organization, setOrganization] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [groupIds, setGroupIds] = useState<string[]>([]);
    
    const [phones, setPhones] = useState<PhoneField[]>([{ value: '', type: 'موبایل' }]);
    const [emails, setEmails] = useState<EmailField[]>([{ value: '', type: 'شخصی' }]);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contactPickerSupported, setContactPickerSupported] = useState(false);

    useEffect(() => {
        if (!isContextLoading) {
             if (id) loadContact();
             // Check for Contact Picker support
             if ('contacts' in navigator && 'ContactsManager' in window) {
                 setContactPickerSupported(true);
             }
        }
    }, [id, isContextLoading]);

    const loadContact = async () => {
        setIsLoading(true);
        try {
            const data = await getContactById(id!);
            if (data) {
                setFirstName(data.first_name);
                setLastName(data.last_name || '');
                setOrganization(data.organization || '');
                setJobTitle(data.job_title || '');
                setNotes(data.notes || '');
                setGroupIds(data.groups?.map(g => g.id) || []);
                
                if (data.phone_numbers && data.phone_numbers.length > 0) {
                    setPhones(data.phone_numbers.map(p => ({ value: p.phone_number, type: p.type })));
                }
                if (data.emails && data.emails.length > 0) {
                    setEmails(data.emails.map(e => ({ value: e.email, type: e.type })));
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportFromDevice = async () => {
        if (!navigator.contacts) return;
        try {
            const props = ['name', 'tel', 'email', 'organization'];
            const opts = { multiple: false };
            const contacts = await navigator.contacts.select(props, opts);
            
            if (contacts.length > 0) {
                const c = contacts[0];
                // Name mapping is tricky as API returns array
                if (c.name && c.name.length > 0) {
                    // Very basic splitting, not perfect for all locales
                    const parts = c.name[0].split(' ');
                    setFirstName(parts[0] || '');
                    setLastName(parts.slice(1).join(' ') || '');
                }
                
                // Phones
                if (c.tel && c.tel.length > 0) {
                    const newPhones = c.tel.map((t: string) => ({ value: t, type: 'موبایل' }));
                    setPhones(newPhones);
                }

                // Emails
                if (c.email && c.email.length > 0) {
                    const newEmails = c.email.map((e: string) => ({ value: e, type: 'شخصی' }));
                    setEmails(newEmails);
                }
                
                /* Note: 'organization' support in API varies by browser/OS version, 
                   often not returned even if requested. */
            }
        } catch (err) {
            console.error("Contact picker error", err);
            // Don't alert on simple cancellation
        }
    };

    // Dynamic Field Handlers
    const addPhone = () => setPhones([...phones, { value: '', type: 'موبایل' }]);
    const removePhone = (index: number) => setPhones(phones.filter((_, i) => i !== index));
    const updatePhone = (index: number, field: keyof PhoneField, value: string) => {
        const newPhones = [...phones];
        newPhones[index][field] = value;
        setPhones(newPhones);
    };

    const addEmail = () => setEmails([...emails, { value: '', type: 'شخصی' }]);
    const removeEmail = (index: number) => setEmails(emails.filter((_, i) => i !== index));
    const updateEmail = (index: number, field: keyof EmailField, value: string) => {
        const newEmails = [...emails];
        newEmails[index][field] = value;
        setEmails(newEmails);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName.trim()) {
            alert('نام اجباری است');
            return;
        }
        
        setIsSaving(true);
        setError(null);
        
        const contactData = {
            first_name: firstName,
            last_name: lastName || null,
            organization: organization || null,
            job_title: jobTitle || null,
            notes: notes || null
        };
        
        const cleanPhones = phones.filter(p => p.value.trim()).map(p => ({ phone_number: p.value, type: p.type }));
        const cleanEmails = emails.filter(e => e.value.trim()).map(e => ({ email: e.value, type: e.type }));

        try {
            if (id) {
                await updateContact(id, contactData, cleanPhones, cleanEmails, groupIds);
                alert('مخاطب ویرایش شد');
            } else {
                await createContact(contactData, cleanPhones, cleanEmails, groupIds);
                alert('مخاطب ایجاد شد');
            }
            navigate('/contacts/list');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || isContextLoading) return <div className="flex justify-center pt-10"><Spinner /></div>;

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl max-w-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
                <h2 className="text-2xl font-bold text-gray-900">{id ? 'ویرایش مخاطب' : 'افزودن مخاطب جدید'}</h2>
                {contactPickerSupported && !id && (
                    <Button variant="secondary" onClick={handleImportFromDevice} type="button">
                        <i className="fas fa-mobile-alt ml-2"></i> وارد کردن از گوشی
                    </Button>
                )}
            </div>

            {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="نام *" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                    <Input label="نام خانوادگی" value={lastName} onChange={e => setLastName(e.target.value)} />
                    <Input label="سازمان / شرکت" value={organization} onChange={e => setOrganization(e.target.value)} />
                    <Input label="عنوان شغلی" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                </div>

                <MultiSelectDropdown 
                    label="گروه‌ها"
                    options={contactGroups.map(g => ({ value: g.id, label: g.name }))}
                    selectedValues={groupIds}
                    onChange={setGroupIds}
                />

                {/* Phones */}
                <div className="bg-gray-50 p-4 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-2">شماره‌های تماس</label>
                    {phones.map((phone, index) => (
                        <div key={index} className="flex space-x-2 space-x-reverse mb-2">
                            <Input 
                                placeholder="شماره..." 
                                value={phone.value} 
                                onChange={e => updatePhone(index, 'value', e.target.value)} 
                                className="flex-grow"
                                dir="ltr"
                            />
                            <Select 
                                value={phone.type}
                                onChange={e => updatePhone(index, 'type', e.target.value)}
                                options={[{value: 'موبایل', label: 'موبایل'}, {value: 'محل کار', label: 'محل کار'}, {value: 'منزل', label: 'منزل'}, {value: 'فکس', label: 'فکس'}]}
                                className="w-32"
                            />
                            {phones.length > 1 && (
                                <button type="button" onClick={() => removePhone(index)} className="text-red-500 p-2"><DeleteIcon /></button>
                            )}
                        </div>
                    ))}
                    <Button type="button" size="sm" variant="secondary" onClick={addPhone}><AddIcon className="ml-1" /> افزودن شماره</Button>
                </div>

                {/* Emails */}
                <div className="bg-gray-50 p-4 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-2">ایمیل‌ها</label>
                    {emails.map((email, index) => (
                        <div key={index} className="flex space-x-2 space-x-reverse mb-2">
                            <Input 
                                placeholder="ایمیل..." 
                                value={email.value} 
                                onChange={e => updateEmail(index, 'value', e.target.value)} 
                                className="flex-grow"
                                dir="ltr"
                                type="email"
                            />
                            <Select 
                                value={email.type}
                                onChange={e => updateEmail(index, 'type', e.target.value)}
                                options={[{value: 'شخصی', label: 'شخصی'}, {value: 'کاری', label: 'کاری'}]}
                                className="w-32"
                            />
                            {emails.length > 0 && (email.value || emails.length > 1) && (
                                <button type="button" onClick={() => removeEmail(index)} className="text-red-500 p-2"><DeleteIcon /></button>
                            )}
                        </div>
                    ))}
                     <Button type="button" size="sm" variant="secondary" onClick={addEmail}><AddIcon className="ml-1" /> افزودن ایمیل</Button>
                </div>

                <TextArea label="یادداشت‌ها" value={notes} onChange={e => setNotes(e.target.value)} rows={3} fullWidth />

                <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t">
                    <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>ذخیره</Button>
                    <Button type="button" variant="secondary" onClick={() => navigate('/contacts/list')} disabled={isSaving}>لغو</Button>
                </div>
            </form>
        </div>
    );
};