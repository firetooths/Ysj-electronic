
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Asset, Category, Location, AssetStatusItem } from '../../types';
import {
  createAsset,
  getAssetById,
  updateAsset,
  checkAssetIdNumberExists,
  supabase,
  deleteImage,
  updateAssetImageUrls
} from '../../supabaseService';
import { Input, TextArea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { AddIcon, CameraIcon, FileUploadIcon, DeleteIcon, CloseIcon, CheckIcon } from '../ui/Icons';
import { ImageUpload } from './ImageUpload';
import { useSupabaseContext } from '../../SupabaseContext';
import { processImageForUpload } from '../../utils/imageProcessor';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const buildHierarchyOptions = (items: Array<{id: string, name: string, parent_id: string | null}>) => {
  const options: { value: string; label: string; }[] = [];
  const parents = items.filter(i => !i.parent_id).sort((a,b) => a.name.localeCompare(b.name));
  const childrenByParentId = items.reduce((acc, item) => {
    if (item.parent_id) {
      if (!acc[item.parent_id]) acc[item.parent_id] = [];
      acc[item.parent_id].push(item);
    }
    return acc;
  }, {} as Record<string, typeof items>);

  parents.forEach(parent => {
    options.push({ value: parent.id, label: parent.name });
    if (childrenByParentId[parent.id]) {
        childrenByParentId[parent.id]
        .sort((a,b) => a.name.localeCompare(b.name))
        .forEach(child => {
            options.push({ value: child.id, label: `\u00A0\u00A0\u00A0\u00A0↳ ${child.name}` });
        });
    }
  });
  return options;
};


export const AssetForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { categories, locations, assetStatuses, isLoading: isContextLoading, supabase } = useSupabaseContext();

  const [assetIdNumber, setAssetIdNumber] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isExternal, setIsExternal] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [confirmDeleteImageOpen, setConfirmDeleteImageOpen] = useState(false);
  const [imageToDeleteUrl, setImageToDeleteUrl] = useState<string | null>(null);

  const isEditing = !!id;

  const fetchAsset = useCallback(async () => {
    if (isEditing && id) {
      setIsLoading(true);
      try {
        const fetchedAsset = await getAssetById(id);
        if (fetchedAsset) {
          setAssetIdNumber(fetchedAsset.asset_id_number);
          setName(fetchedAsset.name);
          setCategoryId(fetchedAsset.category_id || '');
          setLocationId(fetchedAsset.location_id || '');
          setStatus(fetchedAsset.status);
          setDescription(fetchedAsset.description || '');
          setImageUrls(fetchedAsset.image_urls || []);
          setIsVerified(fetchedAsset.is_verified || false);
          setIsExternal(fetchedAsset.is_external || false);
        } else {
          setError('تجهیز یافت نشد.');
        }
      } catch (err: any) {
        setError(`خطا در بارگذاری تجهیز: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [id, isEditing]);

  useEffect(() => {
    if (!isContextLoading) {
      fetchAsset();
    }
  }, [fetchAsset, isContextLoading]);

  useEffect(() => {
    if (!isEditing && !isContextLoading) {
      if (categories.length > 0 && !categoryId) {
        setCategoryId(categories.find(c => !c.parent_id)?.id || '');
      }
      if (locations.length > 0 && !locationId) {
        setLocationId(locations.find(l => !l.parent_id)?.id || '');
      }
      if (assetStatuses.length > 0 && !status) {
          setStatus(assetStatuses[0].name);
      }
    }
  }, [isEditing, isContextLoading, categories, locations, assetStatuses, categoryId, locationId, status]);

  const validateForm = useCallback(async (): Promise<boolean> => {
    const errors: { [key: string]: string } = {};
    if (!assetIdNumber.trim()) {
      errors.assetIdNumber = 'شماره اموال اجباری است.';
    } else {
      const exists = await checkAssetIdNumberExists(assetIdNumber, id);
      if (exists) {
        errors.assetIdNumber = 'این شماره اموال قبلاً ثبت شده است.';
      }
    }
    if (!name.trim()) errors.name = 'نام تجهیز اجباری است.';
    if (!categoryId) errors.categoryId = 'دسته بندی اجباری است.';
    if (!locationId) errors.locationId = 'محل قرارگیری اجباری است.';
    if (!status) errors.status = 'وضعیت اجباری است.';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [assetIdNumber, name, categoryId, locationId, status, id]);

  const goBackToList = () => {
    const returnSearch = location.state?.returnSearch || '';
    navigate(`/asset-management/assets${returnSearch}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!await validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const assetData = {
        asset_id_number: assetIdNumber,
        name,
        category_id: categoryId,
        location_id: locationId,
        status,
        description: description || null,
        image_urls: imageUrls,
        is_verified: isVerified,
        is_external: isExternal
      };

      if (isEditing && id) {
        await updateAsset(id, assetData);
        alert('تجهیز با موفقیت ویرایش شد.');
      } else {
        await createAsset(assetData);
        alert('تجهیز با موفقیت ایجاد شد.');
      }
      goBackToList();
    } catch (err: any) {
      setError(`خطا در ذخیره تجهیز: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0 || !supabase) return;

    setIsUploadingImage(true);
    setIsImageUploadModalOpen(false);
    try {
      const uploadedImageUrls: string[] = [];
      const currentAssetId = id || 'temp-asset';

      for (const file of files) {
        const processedBlob = await processImageForUpload(file, 500);
        const { data, error: uploadError } = await supabase.storage.from('asset_images').upload(`${currentAssetId}/${file.name.replace(/\s+/g, '-')}-${Date.now()}.jpeg`, processedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('asset_images').getPublicUrl(data.path);
        uploadedImageUrls.push(publicUrlData.publicUrl);
      }

      const newImageUrls = [...imageUrls, ...uploadedImageUrls];
      setImageUrls(newImageUrls);

      if (isEditing && id) {
        await updateAssetImageUrls(id, newImageUrls);
      }
      alert('تصویر(ها) با موفقیت آپلود شد.');
    } catch (err: any) {
      setError(`خطا در آپلود تصویر: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteImageClick = (url: string) => {
    setImageToDeleteUrl(url);
    setConfirmDeleteImageOpen(true);
  };

  const handleConfirmDeleteImage = async () => {
    if (!imageToDeleteUrl) return;

    setIsSaving(true);
    try {
      await deleteImage(imageToDeleteUrl);
      const updatedImageUrls = imageUrls.filter(url => url !== imageToDeleteUrl);
      setImageUrls(updatedImageUrls);

      if (isEditing && id) {
        await updateAssetImageUrls(id, updatedImageUrls);
      }
      alert('تصویر با موفقیت حذف شد.');
      setImageToDeleteUrl(null);
      setConfirmDeleteImageOpen(false);
    } catch (err: any) {
      setError(`خطا در حذف تصویر: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const categoryOptions = useMemo(() => buildHierarchyOptions(categories), [categories]);
  const locationOptions = useMemo(() => buildHierarchyOptions(locations), [locations]);
  const statusOptions = useMemo(() => assetStatuses.map(s => ({ value: s.name, label: s.name })), [assetStatuses]);

  if (isLoading || isContextLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">
        {isEditing ? 'ویرایش تجهیز' : 'افزودن تجهیز جدید'}
      </h2>

      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
            label="شماره اموال"
            type="text"
            value={assetIdNumber}
            onChange={(e) => setAssetIdNumber(e.target.value.replace(/\D/g, ''))}
            error={validationErrors.assetIdNumber}
            fullWidth
            inputMode="numeric"
            />
            <Input
            label="نام تجهیز"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={validationErrors.name}
            fullWidth
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Select
            label="دسته بندی نوع تجهیز"
            options={[
                { value: '', label: 'انتخاب کنید', disabled: true },
                ...categoryOptions,
            ]}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            error={validationErrors.categoryId}
            fullWidth
            />
            <Select
            label="محل قرارگیری"
            options={[
                { value: '', label: 'انتخاب کنید', disabled: true },
                ...locationOptions,
            ]}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            error={validationErrors.locationId}
            fullWidth
            />
            <Select
            label="وضعیت"
            options={statusOptions}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            error={validationErrors.status}
            fullWidth
            />
        </div>

        <TextArea
          label="توضیحات"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          fullWidth
        />

        {/* Outside Asset Checkbox */}
        <div className="flex items-center space-x-2 space-x-reverse bg-purple-50 p-4 rounded-lg border border-purple-200">
            <input 
                type="checkbox" 
                id="is-external"
                checked={isExternal} 
                onChange={e => setIsExternal(e.target.checked)} 
                className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded ml-3"
            />
            <label htmlFor="is-external" className="flex flex-col cursor-pointer">
                <span className="font-semibold text-purple-900">اموال خارج از شرکت (تهران)</span>
                <span className="text-xs text-purple-700 mt-1">این تجهیز مربوط به اموال مستقر در خارج از فرودگاه (دفتر تهران و ...) می‌باشد.</span>
            </label>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">تصاویر تجهیز</h3>
          <div className="flex flex-wrap gap-4 mb-4">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative group w-32 h-32 rounded-lg overflow-hidden shadow-md">
                <img src={url} alt={`Asset image ${index}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleDeleteImageClick(url)}
                  className="absolute top-1 left-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-6 h-6"
                  title="حذف تصویر"
                >
                  <DeleteIcon />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsImageUploadModalOpen(true)}
            loading={isUploadingImage}
            disabled={isUploadingImage}
          >
            <AddIcon className="ml-2" /> افزودن تصویر
          </Button>
        </div>

        <div className="flex items-center space-x-4 space-x-reverse bg-green-50 p-4 rounded-lg border border-green-200 mt-6">
            <label className="flex items-center cursor-pointer w-full">
                <input 
                    type="checkbox" 
                    checked={isVerified} 
                    onChange={e => setIsVerified(e.target.checked)} 
                    className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded ml-3"
                />
                <div className="flex flex-col">
                    <span className="font-semibold text-green-900">بررسی شد (تایید نهایی اطلاعات)</span>
                    <span className="text-xs text-green-700 mt-1">با تیک زدن این گزینه تایید می‌کنید که اطلاعات و وجود فیزیکی این دستگاه بررسی شده است.</span>
                </div>
            </label>
        </div>

        <div className="flex justify-start space-x-4 space-x-reverse mt-8">
          <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
            {isSaving ? 'در حال ذخیره...' : (isEditing ? 'ذخیره تغییرات' : 'ایجاد تجهیز')}
          </Button>
          <Button type="button" variant="secondary" onClick={goBackToList} disabled={isSaving}>
            لغو
          </Button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={confirmDeleteImageOpen}
        onClose={() => setConfirmDeleteImageOpen(false)}
        onConfirm={handleConfirmDeleteImage}
        title="حذف تصویر"
        message="آیا از حذف این تصویر مطمئن هستید؟ این عمل قابل بازگشت نیست."
        confirmText="حذف"
        isConfirming={isSaving}
      />

      <ImageUpload
        isOpen={isImageUploadModalOpen}
        onClose={() => setIsImageUploadModalOpen(false)}
        onUpload={handleImageUpload}
        isUploading={isUploadingImage}
      />
    </div>
  );
};
