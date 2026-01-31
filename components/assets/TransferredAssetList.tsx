
import React, { useState, useEffect, useCallback } from 'react';
import { Asset } from '../../types';
import { getTransferredAssets } from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { DetailsIcon, TransferredListIcon } from '../ui/Icons';
import { useNavigate } from 'react-router-dom';

const ITEMS_PER_PAGE = 10;

const TransferredAssetCard: React.FC<{ asset: Asset; onViewDetails: (asset: Asset) => void; }> = ({ asset, onViewDetails }) => {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col sm:flex-row items-center p-4 border-l-4 border-purple-500">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:ml-4 w-16 h-16 rounded-full border border-gray-200 flex items-center justify-center bg-gray-100">
        {asset.category?.icon ? (
          <i className={`${asset.category.icon} text-3xl text-gray-500`} title={asset.category.name}></i>
        ) : (
          <i className="fas fa-box text-3xl text-gray-500" title="تجهیز"></i>
        )}
      </div>
      <div className="flex-grow text-center sm:text-right mb-4 sm:mb-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{asset.name}</h3>
        <p className="text-sm text-gray-600 mb-1">شماره اموال: <span className="font-mono">{asset.asset_id_number}</span></p>
        <p className="text-sm text-purple-700 font-semibold mb-2">
          منتقل شده به: {asset.transferred_to}
        </p>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          تاریخ انتقال: {asset.transferred_at ? new Date(asset.transferred_at).toLocaleDateString('fa-IR') : 'نامشخص'}
        </span>
      </div>
      <div className="flex flex-shrink-0">
        <Button variant="secondary" size="sm" onClick={() => onViewDetails(asset)} title="مشاهده جزئیات">
          <DetailsIcon />
        </Button>
      </div>
    </div>
  );
};


export const TransferredAssetList: React.FC = () => {
  const navigate = useNavigate();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { assets: fetchedAssets, total } = await getTransferredAssets(
        searchTerm,
        currentPage,
        ITEMS_PER_PAGE,
      );
      setAssets(fetchedAssets);
      setTotalAssets(total);
    } catch (err: any) {
      setError(`خطا در بارگذاری تجهیزات منتقل شده: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, currentPage]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(totalAssets / ITEMS_PER_PAGE);

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
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">لیست اموال منتقل شده</h2>
      </div>

      <div className="mb-6">
        <Input
          type="text"
          placeholder="جستجو (نام، شماره اموال، تحویل‌گیرنده)"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          fullWidth
        />
      </div>

      <div className="space-y-4 mb-8">
        {assets.length === 0 ? (
          <div className="text-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <TransferredListIcon className="mx-auto text-4xl text-gray-400 mb-4" />
            <p>هیچ تجهیز منتقل شده‌ای با این مشخصات یافت نشد.</p>
          </div>
        ) : (
          assets.map((asset) => (
            <TransferredAssetCard
              key={asset.id}
              asset={asset}
              onViewDetails={(a) => navigate(`/asset-management/assets/${a.id}`)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 space-x-reverse mt-8">
          <Button
            variant="secondary"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            size="sm"
          >
            قبلی
          </Button>
          <span className="text-gray-700 font-medium">
            صفحه {currentPage} از {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            size="sm"
          >
            بعدی
          </Button>
        </div>
      )}
    </div>
  );
};
