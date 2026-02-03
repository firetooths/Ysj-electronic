
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contact, ContactGroup } from '../../types';
import { getContacts, deleteContact } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, ExportIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useSupabaseContext } from '../../SupabaseContext';
import { Tag } from '../ui/Tag';
import * as XLSX from 'xlsx';
import { Select } from '../ui/Select';

// Debounce hook
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export const ContactList: React.FC = () => {
  const navigate = useNavigate();
  const { contactGroups, isLoading: isContextLoading } = useSupabaseContext();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
        const { contacts: data, total } = await getContacts(debouncedSearchTerm, filterGroupId || null, currentPage, ITEMS_PER_PAGE);
        setContacts(data);
        setTotalContacts(total);
    } catch (err) {
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [debouncedSearchTerm, filterGroupId, currentPage]);

  useEffect(() => {
    if (!isContextLoading) {
        fetchContacts();
    }
  }, [fetchContacts, isContextLoading]);

  useEffect(() => {
      setCurrentPage(1);
  }, [debouncedSearchTerm, filterGroupId]);

  const handleDeleteClick = (contact: Contact) => {
      setContactToDelete(contact);
      setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!contactToDelete) return;
      setIsDeleting(true);
      try {
          await deleteContact(contactToDelete.id);
          fetchContacts();
          setConfirmDeleteOpen(false);
      } catch (err) {
          alert('خطا در حذف مخاطب');
      } finally {
          setIsDeleting(false);
          setContactToDelete(null);
      }
  };

  const handleExport = async () => {
      setIsExporting(true);
      try {
          const { contacts: all } = await getContacts(debouncedSearchTerm, filterGroupId || null, 1, 9999);
          const data = all.map(c => ({
              'نام': c.first_name,
              'نام خانوادگی': c.last_name,
              'سازمان': c.organization,
              'سمت': c.job_title,
              'شماره‌ها': c.phone_numbers?.map(p => `${p.phone_number} (${p.type})`).join(', '),
              'ایمیل‌ها': c.emails?.map(e => `${e.email} (${e.type})`).join(', '),
              'گروه‌ها': c.groups?.map(g => g.name).join(', '),
              'توضیحات': c.notes
          }));
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Contacts");
          XLSX.writeFile(wb, `Contacts_Export_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xlsx`);
      } catch (err) {
          alert('خطا در خروجی اکسل');
      } finally {
          setIsExporting(false);
      }
  };

  const totalPages = Math.ceil(totalContacts / ITEMS_PER_PAGE);

  if (isContextLoading) return <div className="flex justify-center pt-10"><Spinner /></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold text-gray-900">لیست مخاطبین</h2>
            <div className="flex space-x-2 space-x-reverse">
                <Button variant="secondary" onClick={handleExport} loading={isExporting} disabled={isExporting}>
                    <ExportIcon className="ml-2" /> خروجی Excel
                </Button>
                <Button variant="primary" onClick={() => navigate('/contacts/new')}>
                    <AddIcon className="ml-2" /> افزودن مخاطب
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border">
            <Input 
                placeholder="جستجوی نام، سازمان..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
            />
            <Select 
                options={[{value: '', label: 'همه گروه‌ها'}, ...contactGroups.map(g => ({value: g.id, label: g.name}))]}
                value={filterGroupId}
                onChange={e => setFilterGroupId(e.target.value)}
            />
        </div>

        <div className="overflow-x-auto custom-scrollbar rounded-lg shadow-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام و نام خانوادگی</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">سازمان / سمت</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">شماره تماس</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">گروه‌ها</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">عملیات</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading ? (
                        <tr><td colSpan={5} className="text-center py-10"><Spinner /></td></tr>
                    ) : contacts.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-10 text-gray-500">مخاطبی یافت نشد.</td></tr>
                    ) : (
                        contacts.map(contact => (
                            <tr key={contact.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                    {contact.first_name} {contact.last_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {contact.organization} {contact.job_title ? `- ${contact.job_title}` : ''}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dir-ltr text-right">
                                    {contact.phone_numbers && contact.phone_numbers.length > 0 
                                        ? (
                                            <div className="flex items-center justify-end space-x-2 space-x-reverse">
                                                {contact.phone_numbers && contact.phone_numbers.length > 1 && (
                                                    <span className="text-xs text-gray-400 mr-2 cursor-help" title={contact.phone_numbers.slice(1).map(p => `${p.phone_number} (${p.type})`).join('\n')}>
                                                        (+{contact.phone_numbers.length - 1})
                                                    </span>
                                                )}
                                                <a 
                                                    href={`tel:${contact.phone_numbers[0].phone_number}`}
                                                    className="flex items-center text-indigo-600 hover:text-white hover:bg-indigo-600 px-2 py-1 rounded transition-all duration-200 border border-transparent hover:border-indigo-600 group"
                                                    title="تماس"
                                                >
                                                    <span className="font-mono font-semibold ml-2">{contact.phone_numbers[0].phone_number}</span>
                                                    <i className="fas fa-phone-alt text-xs group-hover:animate-pulse"></i>
                                                </a>
                                            </div>
                                        ) 
                                        : '---'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-wrap gap-1">
                                        {contact.groups?.map(g => (
                                            <Tag key={g.id} name={g.name} color={g.color} />
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <div className="flex justify-center space-x-2 space-x-reverse">
                                        <Button variant="ghost" size="sm" onClick={() => navigate(`/contacts/edit/${contact.id}`)}><EditIcon /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(contact)}><DeleteIcon className="text-red-600" /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 space-x-reverse mt-8">
          <Button variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isLoading} size="sm">قبلی</Button>
          <span className="text-gray-700 font-medium">صفحه {currentPage} از {totalPages}</span>
          <Button variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || isLoading} size="sm">بعدی</Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="حذف مخاطب"
        message={`آیا از حذف ${contactToDelete?.first_name} ${contactToDelete?.last_name} مطمئن هستید؟`}
        confirmText="حذف"
        isConfirming={isDeleting}
      />
    </div>
  );
};
