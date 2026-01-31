
import { getSupabaseSafe } from './client';
import { logAuditAction } from './auditService';
import { deleteImages } from './storageService';
import { Asset, Location } from '../types';
import { TABLES } from '../constants';

const CACHE_KEY_PREFIX = 'offline_assets_cache_';

const getCurrentUserForLog = (): string => {
  try {
    const userStr = localStorage.getItem('user_data');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.full_name || user.username || 'کاربر ناشناس';
    }
  } catch (e) {
    console.error('Error getting user for log:', e);
  }
  return 'system';
};

export const getAssetById = async (id: string): Promise<Asset | null> => {
  const client = getSupabaseSafe();
  try {
    const { data, error } = await client
        .from(TABLES.ASSETS)
        .select('*, category:category_id(*), location:location_id(*)')
        .eq('id', id)
        .single();
    if (error && error.code !== 'PGRST116') {
        throw error;
    }
    return data;
  } catch (err: any) {
      // Offline fallback: check if we have this asset in our list cache
      // Note: This is a simple fallback and relies on the user having visited the list page.
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('Network request failed'))) {
          console.warn('Network error, attempting to find asset in local cache...');
          const cacheKey = `${CACHE_KEY_PREFIX}all`; // Try general cache
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
              const { assets } = JSON.parse(cached);
              const found = assets.find((a: Asset) => a.id === id);
              if (found) return found;
          }
      }
      throw err;
  }
};

export const getAssets = async (
  searchTerm: string = '',
  statusFilter: string | '' = '',
  categoryFilter: string | '' = '',
  locationFilter: string | '' = '',
  page: number = 1,
  pageSize: number = 10,
  verifiedFilter: boolean | null = null,
  externalFilter: boolean | null = null,
): Promise<{ assets: Asset[]; total: number }> => {
  const client = getSupabaseSafe();
  
  // Construct a cache key based on filters to allow partial caching
  const cacheKey = `${CACHE_KEY_PREFIX}${page}_${searchTerm}_${statusFilter}_${categoryFilter}_${locationFilter}`;
  
  try {
      let query = client
        .from(TABLES.ASSETS)
        .select('*, category:category_id(*), location:location_id(*)', {
          count: 'exact',
        })
        .neq('status', 'منتقل شده');

      if (searchTerm && searchTerm.trim() !== '') {
        query = query.or(
          `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,asset_id_number.ilike.%${searchTerm}%`
        );
      }

      if (statusFilter) query = query.eq('status', statusFilter);
      if (categoryFilter) query = query.eq('category_id', categoryFilter);
      if (locationFilter) query = query.eq('location_id', locationFilter);
      if (verifiedFilter !== null) query = query.eq('is_verified', verifiedFilter);
      if (externalFilter !== null) query = query.eq('is_external', externalFilter);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const result = { assets: data || [], total: count || 0 };
      
      // Save to cache on success
      try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
          // Also cache a generic "latest" key for fallback if user is on page 1 with no filters
          if (page === 1 && !searchTerm && !statusFilter && !categoryFilter) {
               localStorage.setItem(`${CACHE_KEY_PREFIX}all`, JSON.stringify(result));
          }
      } catch (e) {
          console.warn('Failed to cache assets to localStorage (likely quota exceeded).');
      }

      return result;

  } catch (error: any) {
      // Offline Strategy
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Network request failed'))) {
          console.warn('Network error, loading assets from cache...');
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
              return JSON.parse(cachedData);
          }
          // Fallback to "all" cache if specific filter cache missing
          const allCached = localStorage.getItem(`${CACHE_KEY_PREFIX}all`);
          if (allCached) {
              return JSON.parse(allCached);
          }
      }
      console.error('Error fetching assets:', error.message);
      throw error;
  }
};

export const getTransferredAssets = async (
  searchTerm: string = '',
  page: number = 1,
  pageSize: number = 10,
): Promise<{ assets: Asset[]; total: number }> => {
  const client = getSupabaseSafe();
  let query = client
    .from(TABLES.ASSETS)
    .select('*, category:category_id(*), location:location_id(*)', {
      count: 'exact',
    })
    .eq('status', 'منتقل شده');

  if (searchTerm && searchTerm.trim() !== '') {
    query = query.or(
      `name.ilike.%${searchTerm}%,transferred_to.ilike.%${searchTerm}%,asset_id_number.ilike.%${searchTerm}%`
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('transferred_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching transferred assets:', error.message);
    throw error;
  }

  return { assets: data || [], total: count || 0 };
};

export const getAssetCountByField = async (
  fieldName: 'category_id' | 'location_id',
  id: string
): Promise<number> => {
  const client = getSupabaseSafe();
  const { count, error } = await client
    .from(TABLES.ASSETS)
    .select('id', { count: 'exact', head: true })
    .eq(fieldName, id);

  if (error) {
    console.error(`Error getting asset count for ${fieldName}:`, error.message);
    throw error;
  }
  return count || 0;
};

export const createAsset = async (asset: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'transferred_to' | 'transferred_at'>): Promise<Asset> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.ASSETS)
    .insert(asset)
    .select('*, category:category_id(*), location:location_id(*)')
    .single();
  if (error) {
    console.error('Error creating asset:', error.message);
    throw error;
  }
  await logAuditAction(data.id, 'ایجاد تجهیز جدید', getCurrentUserForLog(), null, JSON.stringify(data));
  return data;
};

export const updateAsset = async (
  id: string,
  updates: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'image_urls'>>,
): Promise<Asset> => {
  const client = getSupabaseSafe();
  const oldAsset = await getAssetById(id);
  const { data, error } = await client
    .from(TABLES.ASSETS)
    .update(updates)
    .eq('id', id)
    .select('*, category:category_id(*), location:location_id(*)')
    .single();
  if (error) {
    console.error('Error updating asset:', error.message);
    throw error;
  }

  const currentUser = getCurrentUserForLog();

  if (oldAsset && data) {
    for (const key in updates) {
      if (
        Object.prototype.hasOwnProperty.call(updates, key) &&
        (oldAsset as any)[key] !== (data as any)[key]
      ) {
        let oldValue = (oldAsset as any)[key];
        let newValue = (data as any)[key];
        let description = `بروزرسانی فیلد ${key}`;

        if (key === 'location_id') {
          const oldLocation = (oldAsset?.location as Location)?.name || 'نامشخص';
          const newLocation = (data?.location as Location)?.name || 'نامشخص';
          description = `تغییر محل از '${oldLocation}' به '${newLocation}'`;
          oldValue = oldLocation;
          newValue = newLocation;
        } else if (key === 'status') {
          description = `تغییر وضعیت از '${oldAsset.status}' به '${data.status}'`;
        } else if (key === 'is_verified') {
            description = newValue ? 'اموال توسط کاربر بررسی و تایید شد' : 'وضعیت تایید اموال لغو شد';
            oldValue = oldValue ? 'تایید شده' : 'بررسی نشده';
            newValue = newValue ? 'تایید شده' : 'بررسی نشده';
        } else if (key === 'is_external') {
            description = newValue ? 'تجهیز به عنوان اموال خارج از شرکت علامت‌گذاری شد' : 'وضعیت اموال خارج از شرکت لغو شد';
            oldValue = oldValue ? 'خارج از شرکت' : 'داخل شرکت';
            newValue = newValue ? 'خارج از شرکت' : 'داخل شرکت';
        }

        await logAuditAction(
          id,
          description,
          currentUser,
          key,
          String(oldValue),
          String(newValue)
        );
      }
    }
  }

  return data;
};

export const transferAsset = async (
  id: string,
  transferredTo: string,
): Promise<Asset> => {
  const client = getSupabaseSafe();
  const oldAsset = await getAssetById(id);
  if (!oldAsset) throw new Error("تجهیز برای انتقال یافت نشد.");

  const updates = {
    status: 'منتقل شده',
    transferred_to: transferredTo,
    transferred_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from(TABLES.ASSETS)
    .update(updates)
    .eq('id', id)
    .select('*, category:category_id(*), location:location_id(*)')
    .single();

  if (error) {
    console.error('Error transferring asset:', error.message);
    throw error;
  }

  await logAuditAction(
    id,
    `تجهیز به '${transferredTo}' منتقل شد`,
    getCurrentUserForLog(),
    'status',
    oldAsset.status,
    'منتقل شده',
  );

  return data;
};


export const deleteAsset = async (id: string): Promise<void> => {
  const client = getSupabaseSafe();
  const assetToDelete = await getAssetById(id);
  if (assetToDelete?.image_urls && assetToDelete.image_urls.length > 0) {
    await deleteImages(assetToDelete.image_urls);
  }

  const { error } = await client.from(TABLES.ASSETS).delete().eq('id', id);
  if (error) {
    console.error('Error deleting asset:', error.message);
    throw error;
  }
};

export const checkAssetIdNumberExists = async (
  asset_id_number: string,
  excludeId?: string,
): Promise<boolean> => {
  const client = getSupabaseSafe();
  let query = client
    .from(TABLES.ASSETS)
    .select('id', { count: 'exact', head: true })
    .eq('asset_id_number', asset_id_number);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { count, error } = await query;
  if (error) {
    console.error('Error checking asset ID number:', error.message);
    throw error;
  }
  return count !== null && count > 0;
};

export const updateAssetImageUrls = async (
  assetId: string,
  newImageUrls: string[],
): Promise<Asset> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.ASSETS)
    .update({ image_urls: newImageUrls })
    .eq('id', assetId)
    .select('*, category:category_id(*), location:location_id(*)')
    .single();
  if (error) {
    console.error('Error updating asset image URLs:', error.message);
    throw error;
  }
  
  await logAuditAction(
    assetId,
    'تصاویر تجهیز بروزرسانی شد',
    getCurrentUserForLog(),
    'image_urls',
    null,
    'تعداد تصاویر: ' + newImageUrls.length
  );
  
  return data;
};
