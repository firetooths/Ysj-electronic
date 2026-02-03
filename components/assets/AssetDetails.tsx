
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Asset, MaintenanceLog, Category, Location } from '../../types';
import { supabase, getAssetById, getMaintenanceLogsByAssetId, getAuditLogsByAssetId, deleteImage, updateAssetImageUrls, updateAsset } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AuditLogSection } from '../audit/AuditLogSection';
import { MaintenanceLogSection } from '../maintenance/MaintenanceLogSection';
import { AddIcon, DeleteIcon, EditIcon, CloseIcon, TransferIcon, CnsFaultIcon, CheckIcon } from '../ui/Icons';
import { ImageUpload } from './ImageUpload';
import { useSupabaseContext } from '../../SupabaseContext';
import { processImageForUpload } from '../../utils/imageProcessor';

export const AssetDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const locationState = useLocation();
  const { categories, locations, supabase } = useSupabaseContext();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [confirmDeleteImageOpen, setConfirmDeleteImageOpen] = useState(false);
  const [imageToDeleteUrl, setImageToDeleteUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  const [isTogglingVerify, setIsTogglingVerify] = useState(false);

  const fetchAssetDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const fetchedAsset = await getAssetById(id);
      if (fetchedAsset) {
        setAsset(fetchedAsset);
      } else {
        setError('Asset not found.');
      }
    } catch (err: any) {
      setError(`Failed to fetch asset details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAssetDetails();
  }, [fetchAssetDetails]);

  const handleToggleVerify = async () => {
      if (!asset) return;
      setIsTogglingVerify(true);
      try {
          const newStatus = !asset.is_verified;
          await updateAsset(asset.id, { is_verified: newStatus });
          setAsset(prev => prev ? ({ ...prev, is_verified: newStatus }) : null);
      } catch (err: any) {
          alert(`خطا در تغییر وضعیت تایید: ${err.message}`);
      } finally {
          setIsTogglingVerify(false);
      }
  };

  const goBackToList = () => {
    const returnSearch = locationState.state?.returnSearch || '';
    navigate(`/asset-management/assets${returnSearch}`);
  };

  const handleDeleteImageClick = (imageUrl: string) => {
    setImageToDeleteUrl(imageUrl);
    setConfirmDeleteImageOpen(true);
  };

  const handleConfirmDeleteImage = async () => {
    if (!asset || !imageToDeleteUrl) return;

    setIsDeletingImage(true);
    try {
      await deleteImage(imageToDeleteUrl);
      const newImageUrls = asset.image_urls.filter(url => url !== imageToDeleteUrl);
      const updatedAsset = await updateAssetImageUrls(asset.id, newImageUrls);
      setAsset(updatedAsset);
      setImageToDeleteUrl(null);
      setConfirmDeleteImageOpen(false);
      alert('تصویر با موفقیت حذف شد.');
    } catch (err: any) {
      alert(`خطا در حذف تصویر: ${err.message}`);
    } finally {
      setIsDeletingImage(false);
    }
  };

  const handleImageUpload = async (files: File[]) => {
    if (!asset || files.length === 0 || !supabase) return;

    setIsUploadingImage(true);
    setIsImageUploadModalOpen(false);
    try {
      const uploadedImageUrls: string[] = [];
      for (const file of files) {
        const processedBlob = await processImageForUpload(file, 500);
        const { data, error: uploadError } = await supabase.storage.from('asset_images').upload(`${asset.id}/${file.name.replace(/\s+/g, '-')}-${Date.now()}.jpeg`, processedBlob, {
          cacheControl: '300',
          upsert: false,
          contentType: 'image/jpeg',
        });
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from('asset_images').getPublicUrl(data.path);
        uploadedImageUrls.push(publicUrlData.publicUrl);
      }

      const newImageUrls = [...(asset.image_urls || []), ...uploadedImageUrls];
      const updatedAsset = await updateAssetImageUrls(asset.id, newImageUrls);
      setAsset(updatedAsset);
      alert('تصویر(ها) با موفقیت آپلود شد.');
    } catch (err: any) {
      alert(`خطا در آپلود تصویر: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };
  
  const getFullPathName = (
    itemId: string | undefined,
    items: Array<{ id: string; name: string; parent_id: string | null }>,
  ): string => {
    if (!itemId) return 'نامشخص';
    const item = items.find((i) => i.id === itemId);
    if (!item) return 'نامشخص';
    if (item.parent_id) {
      const parent = items.find((p) => p.id === item.parent_id);
      return parent ? `${parent.name} > ${item.name}` : item.name;
    }
    return item.name;
  };


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

  if (!asset) {
    return <div className="text-gray-600 p-4 bg-gray-100 rounded-lg">تجهیز یافت نشد.</div>;
  }

  const isTransferred = asset.status === 'منتقل شده';

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900">جزئیات تجهیز: {asset.name}</h2>
            {asset.is_external && (
                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded w-fit mt-1">
                    <i className="fas fa-city ml-1"></i> اموال خارج از شرکت (تهران)
                </span>
            )}
        </div>
        {!isTransferred && (
            <div className="flex items-center space-x-2 space-x-reverse">
                <Button variant="outline" onClick={() => navigate(`/cns/equipment/new?importFromAsset=${asset.id}`)} title="افزودن به لیست تجهیزات CNS">
                    <CnsFaultIcon className="ml-2" /> افزودن به CNS
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/asset-management/assets/transfer/${asset.id}`, { state: locationState.state })}>
                    <TransferIcon className="ml-2" /> انتقال
                </Button>
                <Button variant="primary" onClick={() => navigate(`/asset-management/assets/edit/${asset.id}`, { state: locationState.state })}>
                    <EditIcon className="ml-2" /> ویرایش
                </Button>
                <Button variant="ghost" onClick={goBackToList}>بازگشت</Button>
            </div>
        )}
      </div>

      {isTransferred && (
        <div className="p-4 mb-6 text-lg text-center text-purple-800 bg-purple-100 rounded-lg shadow-sm">
            این تجهیز در تاریخ {new Date(asset.transferred_at!).toLocaleDateString('fa-IR')} به <strong>{asset.transferred_to}</strong> منتقل شده است.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-xl font-semibold text-gray-800">اطلاعات اصلی</h3>
              <div className="flex items-center">
                  <button 
                    onClick={handleToggleVerify}
                    disabled={isTogglingVerify}
                    className={`flex items-center px-3 py-1 rounded-full border transition-all ${asset.is_verified ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                  >
                      {isTogglingVerify ? <Spinner className="w-4 h-4 ml-2" /> : (
                          asset.is_verified ? <CheckIcon className="ml-1" /> : <div className="w-4 h-4 border rounded ml-2 border-gray-400"></div>
                      )}
                      <span className="text-sm font-medium">{asset.is_verified ? 'بررسی و تایید شده' : 'بررسی نشده'}</span>
                  </button>
              </div>
          </div>
          <div className="space-y-3">
            <p className="text-gray-700"><strong>شماره اموال:</strong> <span className="font-mono">{asset.asset_id_number}</span></p>
            <p className="text-gray-700"><strong>نام تجهیز:</strong> {asset.name}</p>
            <p className="text-gray-700"><strong>دسته بندی:</strong> {getFullPathName(asset.category_id, categories)}</p>
            <p className="text-gray-700"><strong>محل قرارگیری:</strong> {getFullPathName(asset.location_id, locations)}</p>
            <p className="text-gray-700"><strong>وضعیت:</strong> <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
              asset.status === 'در حال استفاده' ? 'bg-green-100 text-green-700' :
              asset.status === 'نیاز به تعمیر' ? 'bg-yellow-100 text-yellow-700' :
              asset.status === 'در انبار' ? 'bg-blue-100 text-blue-700' :
              asset.status === 'از رده خارج' ? 'bg-red-100 text-red-700' :
              asset.status === 'منتقل شده' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {asset.status}
            </span></p>
            <p className="text-gray-700"><strong>توضیحات:</strong> {asset.description || 'ندارد'}</p>
            <p className="text-gray-700"><strong>تاریخ ایجاد:</strong> {new Date(asset.created_at).toLocaleDateString('fa-IR')}</p>
            <p className="text-gray-700"><strong>تاریخ آخرین بروزرسانی:</strong> {new Date(asset.updated_at).toLocaleDateString('fa-IR')}</p>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">تصاویر</h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {asset.image_urls && asset.image_urls.length > 0 ? (
                asset.image_urls.map((url, index) => (
                  <div key={index} className="relative group w-32 h-32 rounded-lg overflow-hidden shadow-md">
                    <img
                      src={url}
                      alt={`${asset.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {!isTransferred && (
                        <button
                          onClick={() => handleDeleteImageClick(url)}
                          className="absolute top-1 left-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-6 h-6"
                          title="حذف تصویر"
                        >
                          <DeleteIcon />
                        </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center w-32 h-32 bg-gray-100 rounded-lg text-gray-500 border border-dashed border-gray-300">
                  تصویری موجود نیست
                </div>
              )}
            </div>
            {!isTransferred && (
                <Button
                  variant="secondary"
                  onClick={() => setIsImageUploadModalOpen(true)}
                  loading={isUploadingImage}
                  disabled={isUploadingImage}
                >
                  <AddIcon className="ml-2" /> افزودن تصویر
                </Button>
            )}
          </div>
        </div>
      </div>

      {!isTransferred && (
        <div className="mb-8">
          <MaintenanceLogSection assetId={asset.id} categories={categories} locations={locations} />
        </div>
      )}

      <div>
        <AuditLogSection assetId={asset.id} />
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteImageOpen}
        onClose={() => setConfirmDeleteImageOpen(false)}
        onConfirm={handleConfirmDeleteImage}
        title="حذف تصویر"
        message="آیا از حذف این تصویر مطمئن هستید؟ این عمل قابل بازگشت نیست."
        confirmText="حذف"
        isConfirming={isDeletingImage}
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
