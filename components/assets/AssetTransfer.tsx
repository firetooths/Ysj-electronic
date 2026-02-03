import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAssetById, transferAsset } from '../../supabaseService';
import { Asset } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';

export const AssetTransfer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [transferredTo, setTransferredTo] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchAsset = useCallback(async () => {
    if (!id) {
      setError('شناسه تجهیز نامعتبر است.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedAsset = await getAssetById(id);
      if (fetchedAsset) {
        if (fetchedAsset.status === 'منتقل شده') {
            setError('این تجهیز قبلا منتقل شده است و امکان انتقال مجدد وجود ندارد.');
        }
        setAsset(fetchedAsset);
      } else {
        setError('تجهیز یافت نشد.');
      }
    } catch (err: any) {
      setError(`خطا در بارگذاری اطلاعات تجهیز: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAsset();
  }, [fetchAsset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    if (!transferredTo.trim()) {
      setValidationError('نام شخص یا واحد تحویل‌گیرنده اجباری است.');
      return;
    }

    if (!id) return;

    setIsSaving(true);
    try {
      await transferAsset(id, transferredTo.trim());
      alert('تجهیز با موفقیت منتقل شد.');
      navigate('/asset-management/transferred-assets');
    } catch (err: any) {
      setError(`خطا در انتقال تجهیز: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
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
    return <div className="text-center p-4">تجهیز یافت نشد.</div>
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">انتقال تجهیز</h2>
      <div className="p-4 mb-6 bg-gray-50 border rounded-md">
        <p><strong>نام تجهیز:</strong> {asset.name}</p>
        <p><strong>شماره اموال:</strong> {asset.asset_id_number}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="نام شخص یا واحد تحویل‌گیرنده"
          type="text"
          value={transferredTo}
          onChange={(e) => setTransferredTo(e.target.value)}
          error={validationError || undefined}
          fullWidth
          placeholder="مثال: بخش IT، علی رضایی"
        />

        <div className="flex justify-start space-x-4 space-x-reverse mt-8">
          <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
            {isSaving ? 'در حال انتقال...' : 'تایید و انتقال'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(`/asset-management/assets/${id}`)} disabled={isSaving}>
            لغو
          </Button>
        </div>
      </form>
    </div>
  );
};