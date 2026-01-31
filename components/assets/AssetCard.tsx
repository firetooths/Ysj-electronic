
import React from 'react';
import { Asset } from '../../types';
import { Button } from '../ui/Button';
import { DeleteIcon, DetailsIcon, EditIcon } from '../ui/Icons';

interface AssetCardProps {
  asset: Asset;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onViewDetails: (asset: Asset) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onEdit, onDelete, onViewDetails }) => {
  const hasImage = asset.image_urls && asset.image_urls.length > 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'در حال استفاده':
        return 'bg-green-100 text-green-700';
      case 'نیاز به تعمیر':
        return 'bg-yellow-100 text-yellow-700';
      case 'در انبار':
        return 'bg-blue-100 text-blue-700';
      case 'از رده خارج':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Verification Ring Logic
  const ringColorClass = asset.is_verified ? 'border-green-500 ring-2 ring-green-100' : 'border-red-500 ring-2 ring-red-100';

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col sm:flex-row items-center p-4">
      <div className={`flex-shrink-0 mb-4 sm:mb-0 sm:ml-4 w-16 h-16 rounded-full border-2 flex items-center justify-center bg-gray-100 ${ringColorClass}`}>
        {hasImage ? (
          <img
            src={asset.image_urls[0]}
            alt={asset.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : asset.category?.icon ? (
          <i className={`${asset.category.icon} text-3xl text-gray-500`} title={asset.category.name}></i>
        ) : (
          <i className="fas fa-box text-3xl text-gray-500" title="تجهیز"></i>
        )}
      </div>
      <div className="flex-grow text-center sm:text-right mb-4 sm:mb-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{asset.name}</h3>
        <p className="text-sm text-gray-600 mb-1">شماره اموال: <span className="font-mono">{asset.asset_id_number}</span></p>
        <p className="text-sm text-gray-600 mb-2">
          دسته بندی: {asset.category?.name || 'نامشخص'} | محل: {asset.location?.name || 'نامشخص'}
        </p>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
          {asset.status}
        </span>
      </div>
      <div className="flex flex-shrink-0 space-x-2 space-x-reverse justify-center sm:justify-start">
        <Button variant="secondary" size="sm" onClick={() => onViewDetails(asset)} title="مشاهده جزئیات">
          <DetailsIcon />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onEdit(asset)} title="ویرایش">
          <EditIcon />
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(asset)} title="حذف">
          <DeleteIcon />
        </Button>
      </div>
    </div>
  );
};
