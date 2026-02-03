import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Location } from '../../types';
import {
  createLocation,
  deleteLocation,
  updateLocation,
  getAssetCountByField,
  reassignAssetsAndDeleteLocation,
} from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, InfoIcon, LocationIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useSupabaseContext } from '../../SupabaseContext';
import { Modal } from '../ui/Modal';
import { ReassignDialog } from '../ui/ReassignDialog';
import { Select } from '../ui/Select';

const LocationItem: React.FC<{
    location: Location;
    onEdit: (location: Location) => void;
    onDelete: (location: Location) => void;
    isChild?: boolean;
}> = ({ location, onEdit, onDelete, isChild = false }) => (
    <div
        className={`bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between hover:shadow-md transition-shadow ${isChild ? 'mr-8 border-r-4 border-indigo-200' : 'border-gray-200'}`}
    >
        <div className="flex items-center">
            <div className="w-8 h-8 ml-3 text-indigo-600 flex-shrink-0 flex items-center justify-center">
                <LocationIcon className="fa-2x" />
            </div>
            <span className="text-lg font-medium text-gray-800">{location.name}</span>
        </div>
        <div className="flex space-x-2 space-x-reverse">
            <Button variant="secondary" size="sm" onClick={() => onEdit(location)} title="ویرایش">
                <EditIcon />
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(location)} title="حذف">
                <DeleteIcon />
            </Button>
        </div>
    </div>
);

export const LocationManagement: React.FC = () => {
  const { locations, refreshLocations, isLoading: isContextLoading } = useSupabaseContext();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [itemType, setItemType] = useState<'parent' | 'child'>('parent');
  const [parentId, setParentId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [locationToReassign, setLocationToReassign] = useState<Location | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [isReassigning, setIsReassigning] = useState(false);

  useEffect(() => {
    if (!isContextLoading) {
      setIsLoading(false);
    }
  }, [isContextLoading]);

  const handleOpenCreate = () => {
    setCurrentLocation(null);
    setLocationName('');
    setItemType('parent');
    setParentId(null);
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (location: Location) => {
    setCurrentLocation(location);
    setLocationName(location.name);
    setItemType(location.parent_id ? 'child' : 'parent');
    setParentId(location.parent_id);
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    if (!locationName.trim()) {
      setValidationError('نام محل قرارگیری نمی‌تواند خالی باشد.');
      return;
    }

    if (itemType === 'child' && !parentId) {
      setValidationError('لطفا یک محل والد انتخاب کنید.');
      return;
    }

    if (currentLocation && currentLocation.id === parentId) {
        setValidationError('یک محل نمیتواند والد خودش باشد.');
        return;
    }

    const isDuplicate = locations.some(
      (l) =>
        l.name.toLowerCase() === locationName.trim().toLowerCase() &&
        (l.parent_id || null) === (itemType === 'child' ? parentId : null) &&
        l.id !== currentLocation?.id,
    );
    if (isDuplicate) {
      setValidationError('این نام در این سطح از محل قرارگیری قبلاً وجود دارد.');
      return;
    }

    setIsSaving(true);
    const finalParentId = itemType === 'child' ? parentId : null;
    try {
      if (currentLocation) {
        await updateLocation(currentLocation.id, locationName.trim(), finalParentId);
        alert('محل قرارگیری با موفقیت ویرایش شد.');
      } else {
        await createLocation(locationName.trim(), finalParentId);
        alert('محل قرارگیری با موفقیت ایجاد شد.');
      }
      refreshLocations();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(`خطا در ذخیره محل قرارگیری: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (location: Location) => {
    setError(null);
    const hasChildren = locations.some(l => l.parent_id === location.id);
    if (hasChildren) {
        alert('این محل دارای زیرمجموعه است. ابتدا باید زیرمجموعه ها را حذف یا منتقل کنید.');
        return;
    }

    try {
      const count = await getAssetCountByField('location_id', location.id);
      if (count > 0) {
        setAssetCount(count);
        setLocationToReassign(location);
        setIsReassignModalOpen(true);
      } else {
        setLocationToDelete(location);
        setConfirmDeleteOpen(true);
      }
    } catch (err: any) {
      const errorMessage = `خطا در بررسی تجهیزات مرتبط: ${err.message}`;
      setError(errorMessage);
      alert(errorMessage);
    }
  };

  const handleConfirmDelete = async () => {
    if (!locationToDelete) return;
    setIsDeleting(true);
    try {
      await deleteLocation(locationToDelete.id);
      alert('محل قرارگیری با موفقیت حذف شد.');
      refreshLocations();
      setConfirmDeleteOpen(false);
    } catch (err: any) {
      const errorMessage = `خطا در حذف محل قرارگیری: ${err.message}`;
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
      setLocationToDelete(null);
    }
  };

  const handleConfirmReassignAndDelete = async (newLocationId: string) => {
    if (!locationToReassign) return;
    setIsReassigning(true);
    setError(null);
    try {
      await reassignAssetsAndDeleteLocation(locationToReassign.id, newLocationId);
      alert('تجهیزات با موفقیت منتقل و محل قرارگیری حذف شد.');
      refreshLocations();
      setIsReassignModalOpen(false);
    } catch (err: any) {
      const errorMessage = `خطا در انتقال و حذف: ${err.message}`;
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsReassigning(false);
      setLocationToReassign(null);
    }
  };

  const parentLocations = useMemo(() => locations.filter(l => !l.parent_id).sort((a,b) => a.name.localeCompare(b.name)), [locations]);

  const hierarchicalLocations = useMemo(() => {
    return parentLocations
    .map(parent => ({
        ...parent,
        children: locations.filter(child => child.parent_id === parent.id).sort((a,b) => a.name.localeCompare(b.name))
    }));
  }, [locations, parentLocations]);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4 bg-red-100 rounded-lg">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">مدیریت محل قرارگیری</h2>
        <Button variant="primary" onClick={handleOpenCreate}>
          <AddIcon className="ml-2" /> افزودن محل جدید
        </Button>
      </div>

      {locations.length === 0 ? (
        <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <InfoIcon className="fa-lg ml-3 text-blue-500" />
          <span>هنوز هیچ محل قرارگیری ثبت نشده است.</span>
        </div>
      ) : (
        <div className="space-y-4">
            {hierarchicalLocations.map((parent) => (
                <div key={parent.id} className="bg-gray-50 p-4 rounded-lg">
                    <LocationItem
                        location={parent}
                        onEdit={handleOpenEdit}
                        onDelete={handleDeleteClick}
                    />
                    {parent.children.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {parent.children.map(child => (
                                <LocationItem
                                    key={child.id}
                                    location={child}
                                    onEdit={handleOpenEdit}
                                    onDelete={handleDeleteClick}
                                    isChild={true}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentLocation ? 'ویرایش محل قرارگیری' : 'افزودن محل قرارگیری'}>
        <form onSubmit={handleSaveLocation} className="space-y-4 p-4">
          <div className="flex items-center space-x-4 space-x-reverse">
            <label className="flex items-center">
              <input type="radio" name="itemType" value="parent" checked={itemType === 'parent'} onChange={() => setItemType('parent')} className="ml-2" />
              محل اصلی
            </label>
            <label className="flex items-center">
              <input type="radio" name="itemType" value="child" checked={itemType === 'child'} onChange={() => setItemType('child')} className="ml-2" />
              زیرمجموعه
            </label>
          </div>
          {itemType === 'child' && (
            <Select
                label="انتخاب محل والد"
                options={parentLocations.map(p => ({ value: p.id, label: p.name }))}
                value={parentId || ''}
                onChange={(e) => setParentId(e.target.value)}
                fullWidth
            />
          )}
          <Input
            label="نام محل قرارگیری"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            error={validationError}
            fullWidth
          />
          <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t border-gray-200">
            <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : 'ذخیره'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              لغو
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="حذف محل قرارگیری"
        message={`آیا از حذف محل قرارگیری "${locationToDelete?.name}" مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        confirmText="حذف"
        isConfirming={isDeleting}
      />

      <ReassignDialog
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        onConfirm={handleConfirmReassignAndDelete}
        title="حذف محل و انتقال تجهیزات"
        message={`محل قرارگیری "${locationToReassign?.name}" دارای ${assetCount} تجهیز است. برای حذف، لطفاً یک محل جایگزین برای انتقال تجهیزات انتخاب کنید.`}
        options={locations
          .filter((l) => l.id !== locationToReassign?.id)
          .map((l) => ({ value: l.id, label: `${l.name} ${l.parent_id ? '(زیرمجموعه)' : ''}` }))}
        isConfirming={isReassigning}
      />
    </div>
  );
};