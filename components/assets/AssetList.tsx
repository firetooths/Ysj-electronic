
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Asset, Category, Location, AssetStatusItem } from '../../types';
import { deleteAsset, getAssets, checkAssetIdNumberExists } from '../../supabaseService';
import { AssetCard } from './AssetCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, ExportIcon, DetailsIcon, EditIcon, CnsFaultIcon, SearchIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSupabaseContext } from '../../SupabaseContext';
import { exportToExcel, exportToPDF } from '../../utils/fileExporter';

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

export const AssetList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories, locations, assetStatuses, isLoading: isContextLoading } = useSupabaseContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize state from URL params
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  
  // Local state for input field to prevent keyboard closing on mobile
  const [localSearchInput, setLocalSearchInput] = useState<string>(searchParams.get('search') || '');
  
  const [statusFilter, setStatusFilter] = useState<string | ''>(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState<string | ''>(searchParams.get('category') || '');
  const [locationFilter, setLocationFilter] = useState<string | ''>(searchParams.get('location') || '');
  const [verifiedFilter, setVerifiedFilter] = useState<string | ''>(searchParams.get('verified') || '');
  const [externalFilter, setExternalFilter] = useState<string | ''>(searchParams.get('external') || '');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const verifiedBool = verifiedFilter === 'true' ? true : verifiedFilter === 'false' ? false : null;
      const externalBool = externalFilter === 'true' ? true : externalFilter === 'false' ? false : null;
      
      const { assets: fetchedAssets, total } = await getAssets(
        searchTerm,
        statusFilter,
        categoryFilter,
        locationFilter,
        currentPage,
        itemsPerPage,
        verifiedBool,
        externalBool
      );
      setAssets(fetchedAssets);
      setTotalAssets(total);
    } catch (err: any) {
      setError(`خطا در بارگذاری تجهیزات: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter, categoryFilter, locationFilter, verifiedFilter, externalFilter, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!isContextLoading) {
      fetchAssets();
    }
  }, [fetchAssets, isContextLoading]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (locationFilter) params.set('location', locationFilter);
    if (verifiedFilter) params.set('verified', verifiedFilter);
    if (externalFilter) params.set('external', externalFilter);
    
    setSearchParams(params, { replace: true });
  }, [searchTerm, statusFilter, categoryFilter, locationFilter, verifiedFilter, externalFilter, setSearchParams]);

  const handleSearchClick = () => {
      setSearchTerm(localSearchInput);
      setCurrentPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleSearchClick();
      }
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleLocationFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocationFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleVerifiedFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setVerifiedFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleExternalFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setExternalFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setItemsPerPage(Number(e.target.value));
      setCurrentPage(1);
  };

  // Improved navigation with state preservation
  const navigateWithState = (url: string) => {
      navigate(url, { state: { returnSearch: location.search } });
  };

  const handleEdit = (asset: Asset) => {
    navigateWithState(`/asset-management/assets/edit/${asset.id}`);
  };

  const handleViewDetails = (asset: Asset) => {
    navigateWithState(`/asset-management/assets/${asset.id}`);
  };
  
  const handleAddToCNS = (asset: Asset) => {
    navigateWithState(`/cns/equipment/new?importFromAsset=${asset.id}`);
  };

  const handleDeleteClick = (asset: Asset) => {
    setAssetToDelete(asset);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    setIsDeleting(true);
    try {
      await deleteAsset(assetToDelete.id);
      alert('تجهیز با موفقیت حذف شد.');
      fetchAssets();
      setConfirmDeleteOpen(false);
    } catch (err: any) {
      alert(`خطا در حذف تجهیز: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setAssetToDelete(null);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(totalAssets / itemsPerPage);

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'همه دسته بندی‌ها' },
      ...buildHierarchyOptions(categories),
    ],
    [categories],
  );

  const locationOptions = useMemo(
    () => [
      { value: '', label: 'همه محل‌ها' },
      ...buildHierarchyOptions(locations),
    ],
    [locations],
  );

  const handleExport = async (format: 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      const verifiedBool = verifiedFilter === 'true' ? true : verifiedFilter === 'false' ? false : null;
      const externalBool = externalFilter === 'true' ? true : externalFilter === 'false' ? false : null;
      
      const { assets: allFilteredAssets } = await getAssets(
        searchTerm,
        statusFilter,
        categoryFilter,
        locationFilter,
        1,
        totalAssets || 999999,
        verifiedBool,
        externalBool
      );

      if (allFilteredAssets.length === 0) {
        alert('هیچ داده‌ای برای خروجی گرفتن وجود ندارد.');
        return;
      }

      const fileName = `خروجی_اموال_فرودگاه_یاسوج_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}`;
      if (format === 'excel') {
        exportToExcel(allFilteredAssets, categories, locations, fileName);
      } else if (format === 'pdf') {
        await exportToPDF(allFilteredAssets, categories, locations, fileName);
      }
    } catch (err: any) {
      alert(`خطا در ایجاد خروجی: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Custom AssetCard internal component for consistent navigation
  const ExtendedAssetCard: React.FC<{
      asset: Asset;
      onEdit: (asset: Asset) => void;
      onDelete: (asset: Asset) => void;
      onViewDetails: (asset: Asset) => void;
      onAddToCNS: (asset: Asset) => void;
      assetStatuses: AssetStatusItem[];
  }> = ({ asset, onEdit, onDelete, onViewDetails, onAddToCNS, assetStatuses }) => {
      const hasImage = asset.image_urls && asset.image_urls.length > 0;
      
      const getStatusColor = (statusName: string) => {
          const statusItem = assetStatuses.find(s => s.name === statusName);
          return statusItem?.color || 'bg-gray-100 text-gray-700';
      };

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
              <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 justify-center sm:justify-start">
                <h3 className="text-lg font-semibold text-gray-900">{asset.name}</h3>
                {asset.is_external && (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded whitespace-nowrap">
                        <i className="fas fa-city ml-1"></i> اموال تهران
                    </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">شماره اموال: <span className="font-mono">{asset.asset_id_number}</span></p>
              <p className="text-sm text-gray-600 mb-2">
              دسته بندی: {asset.category?.name || 'نامشخص'} | محل: {asset.location?.name || 'نامشخص'}
              </p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
              {asset.status}
              </span>
          </div>
          <div className="flex flex-shrink-0 space-x-2 space-x-reverse justify-center sm:justify-start">
              <Button variant="ghost" size="sm" onClick={() => onAddToCNS(asset)} title="افزودن به CNS">
                  <CnsFaultIcon className="text-indigo-600" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleViewDetails(asset)} title="مشاهده جزئیات">
                  <DetailsIcon />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleEdit(asset)} title="ویرایش">
                  <EditIcon />
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDeleteClick(asset)} title="حذف">
                  <DeleteIcon />
              </Button>
          </div>
          </div>
      );
  };

  if (isLoading || isContextLoading) {
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
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">مدیریت تجهیزات</h2>
        <div className="flex space-x-2 space-x-reverse w-full sm:w-auto">
          <Button variant="primary" onClick={() => navigateWithState('/asset-management/assets/new')}>
            <AddIcon className="ml-2" /> افزودن تجهیز جدید
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="lg:col-span-2 flex space-x-2 space-x-reverse">
            <Input
                type="text"
                placeholder="جستجو در نام، شماره اموال یا توضیحات..."
                value={localSearchInput}
                onChange={(e) => setLocalSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
            />
            <Button onClick={handleSearchClick} variant="secondary">
                <SearchIcon />
            </Button>
        </div>
        <Select
          options={[
            { value: '', label: 'همه وضعیت‌ها' },
            ...assetStatuses.map((s) => ({ value: s.name, label: s.name })),
          ]}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          fullWidth
        />
        <Select
          options={categoryOptions}
          value={categoryFilter}
          onChange={handleCategoryFilterChange}
          fullWidth
        />
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <Select
          options={locationOptions}
          value={locationFilter}
          onChange={handleLocationFilterChange}
          fullWidth
        />
        <Select
          options={[
            { value: '', label: 'همه موارد تایید' },
            { value: 'true', label: 'فقط تایید شده' },
            { value: 'false', label: 'فقط تایید نشده' },
          ]}
          value={verifiedFilter}
          onChange={handleVerifiedFilterChange}
          fullWidth
        />
        <Select
          options={[
            { value: '', label: 'همه (داخلی و خارجی)' },
            { value: 'true', label: 'فقط اموال خارجی (تهران)' },
            { value: 'false', label: 'فقط اموال داخلی (فرودگاه)' },
          ]}
          value={externalFilter}
          onChange={handleExternalFilterChange}
          fullWidth
        />
      </div>

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex space-x-2 space-x-reverse">
            <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('excel')}
            loading={isExporting}
            disabled={isExporting}
            >
            <ExportIcon className="ml-2" /> خروجی Excel
            </Button>
            <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('pdf')}
            loading={isExporting}
            disabled={isExporting}
            >
            <ExportIcon className="ml-2" /> خروجی PDF
            </Button>
        </div>
        <div className="flex items-center">
            <span className="text-sm text-gray-600 ml-2">نمایش در هر صفحه:</span>
            <select 
                className="border border-gray-300 rounded-md text-sm p-1"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
            >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
            </select>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        {assets.length === 0 ? (
          <div className="text-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
            تجهیزی با معیارهای فعلی یافت نشد.
          </div>
        ) : (
          assets.map((asset) => (
            <ExtendedAssetCard
              key={asset.id}
              asset={asset}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onViewDetails={handleViewDetails}
              onAddToCNS={handleAddToCNS}
              assetStatuses={assetStatuses}
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
            صفحه {currentPage} از {totalPages} (کل موارد: {totalAssets})
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

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="حذف تجهیز"
        message={`آیا از حذف تجهیز "${assetToDelete?.name}" (شماره اموال: ${assetToDelete?.asset_id_number}) مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        confirmText="حذف"
        isConfirming={isDeleting}
      />
    </div>
  );
};
