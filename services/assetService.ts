
import { getSupabaseSafe } from './client';
import { logAuditAction } from './auditService';
import { deleteImages } from './storageService';
import { Asset, Location } from '../types';
import { TABLES } from '../constants';
import { CACHE_KEYS, queryLocalData, queueOfflineAction, generateUUID } from './offlineService';

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
  // Always query local data first if offline
  if (!navigator.onLine) {
      const { data } = queryLocalData<Asset>(CACHE_KEYS.ASSETS, (item) => item.id === id, 1, 1);
      return data.length > 0 ? data[0] : null;
  }

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
      console.warn('Network request failed, falling back to local cache:', err);
      const { data } = queryLocalData<Asset>(CACHE_KEYS.ASSETS, (item) => item.id === id, 1, 1);
      if (data.length > 0) return data[0];
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
  
  // Helper to fetch from local storage (used for both offline mode and error fallback)
  const fetchLocal = () => {
      const result = queryLocalData<Asset>(
          CACHE_KEYS.ASSETS,
          (item) => {
              // 1. Exclude transferred
              if (item.status === 'منتقل شده') return false;

              // 2. Search Term
              if (searchTerm) {
                  const term = searchTerm.toLowerCase();
                  const matches = (
                      (item.name && item.name.toLowerCase().includes(term)) ||
                      (item.description && item.description.toLowerCase().includes(term)) ||
                      (item.asset_id_number && String(item.asset_id_number).includes(term))
                  );
                  if (!matches) return false;
              }

              // 3. Filters
              if (statusFilter && item.status !== statusFilter) return false;
              if (categoryFilter && item.category_id !== categoryFilter) return false;
              if (locationFilter && item.location_id !== locationFilter) return false;
              if (verifiedFilter !== null && item.is_verified !== verifiedFilter) return false;
              if (externalFilter !== null && item.is_external !== externalFilter) return false;

              return true;
          },
          page,
          pageSize
      );
      return { assets: result.data, total: result.total };
  };

  // 1. Explicit Offline Check
  if (!navigator.onLine) {
      return fetchLocal();
  }

  // 2. Try Online, Fallback to Local on Error
  const client = getSupabaseSafe();
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

      return { assets: data || [], total: count || 0 };

  } catch (error: any) {
      console.warn('Error fetching assets from server, switching to offline data:', error.message);
      return fetchLocal();
  }
};

export const getTransferredAssets = async (
  searchTerm: string = '',
  page: number = 1,
  pageSize: number = 10,
): Promise<{ assets: Asset[]; total: number }> => {
  
  const fetchLocal = () => {
      const result = queryLocalData<Asset>(
          CACHE_KEYS.ASSETS,
          (item) => {
              if (item.status !== 'منتقل شده') return false;
              if (searchTerm) {
                  const term = searchTerm.toLowerCase();
                  return (
                      (item.name && item.name.toLowerCase().includes(term)) ||
                      (item.transferred_to && item.transferred_to.toLowerCase().includes(term)) ||
                      (item.asset_id_number && String(item.asset_id_number).includes(term))
                  );
              }
              return true;
          },
          page,
          pageSize
      );
      return { assets: result.data, total: result.total };
  };

  if (!navigator.onLine) {
      return fetchLocal();
  }

  const client = getSupabaseSafe();
  try {
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

      if (error) throw error;

      return { assets: data || [], total: count || 0 };
  } catch (error: any) {
      console.warn('Error fetching transferred assets, fallback to local:', error);
      return fetchLocal();
  }
};

export const getAssetCountByField = async (
  fieldName: 'category_id' | 'location_id',
  id: string
): Promise<number> => {
  if (!navigator.onLine) {
      const { total } = queryLocalData<Asset>(CACHE_KEYS.ASSETS, (item) => (item as any)[fieldName] === id, 1, 999999);
      return total;
  }

  const client = getSupabaseSafe();
  try {
      const { count, error } = await client
        .from(TABLES.ASSETS)
        .select('id', { count: 'exact', head: true })
        .eq(fieldName, id);

      if (error) throw error;
      return count || 0;
  } catch (e) {
      console.warn("Count fetch failed, using local", e);
      const { total } = queryLocalData<Asset>(CACHE_KEYS.ASSETS, (item) => (item as any)[fieldName] === id, 1, 999999);
      return total;
  }
};

export const createAsset = async (asset: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'transferred_to' | 'transferred_at'>): Promise<Asset> => {
  // Offline Creation or Fallback
  const performOfflineInsert = async () => {
      const newId = generateUUID();
      const newAsset = { ...asset, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await queueOfflineAction(TABLES.ASSETS, 'INSERT', newAsset, newId, CACHE_KEYS.ASSETS);
      return newAsset as Asset;
  };

  if (!navigator.onLine) {
      return performOfflineInsert();
  }

  const client = getSupabaseSafe();
  try {
      const { data, error } = await client
        .from(TABLES.ASSETS)
        .insert(asset)
        .select('*, category:category_id(*), location:location_id(*)')
        .single();
      if (error) throw error;
      
      // Update cache in background
      logAuditAction(data.id, 'ایجاد تجهیز جدید', getCurrentUserForLog(), null, JSON.stringify(data));
      return data;
  } catch (e) {
      console.warn("Online create failed, queuing offline action", e);
      return performOfflineInsert();
  }
};

export const updateAsset = async (
  id: string,
  updates: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'image_urls'>>,
): Promise<Asset> => {
  
  const performOfflineUpdate = async () => {
      const updatedData = { ...updates, updated_at: new Date().toISOString() };
      await queueOfflineAction(TABLES.ASSETS, 'UPDATE', updatedData, id, CACHE_KEYS.ASSETS);
      const oldAsset = await getAssetById(id);
      return { ...oldAsset, ...updatedData } as Asset;
  };

  if (!navigator.onLine) {
      return performOfflineUpdate();
  }

  const client = getSupabaseSafe();
  try {
      const oldAsset = await getAssetById(id); // This might fetch from local if net is shaky, which is fine
      
      const { data, error } = await client
        .from(TABLES.ASSETS)
        .update(updates)
        .eq('id', id)
        .select('*, category:category_id(*), location:location_id(*)')
        .single();
      if (error) throw error;

      // Log Audit (Optimistic execution not needed for logging strictly)
      const currentUser = getCurrentUserForLog();
      if (oldAsset && data) {
        for (const key in updates) {
          if (Object.prototype.hasOwnProperty.call(updates, key) && (oldAsset as any)[key] !== (data as any)[key]) {
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

            // We don't await this to keep UI snappy
            logAuditAction(id, description, currentUser, key, String(oldValue), String(newValue));
          }
        }
      }
      return data;
  } catch (e) {
      console.warn("Online update failed, queuing offline action", e);
      return performOfflineUpdate();
  }
};

export const transferAsset = async (
  id: string,
  transferredTo: string,
): Promise<Asset> => {
  const updates = {
    status: 'منتقل شده',
    transferred_to: transferredTo,
    transferred_at: new Date().toISOString(),
  };

  if (!navigator.onLine) {
      await queueOfflineAction(TABLES.ASSETS, 'UPDATE', updates, id, CACHE_KEYS.ASSETS);
      const oldAsset = await getAssetById(id);
      return { ...oldAsset, ...updates } as Asset;
  }

  const client = getSupabaseSafe();
  try {
      const oldAsset = await getAssetById(id);
      if (!oldAsset) throw new Error("تجهیز برای انتقال یافت نشد.");

      const { data, error } = await client
        .from(TABLES.ASSETS)
        .update(updates)
        .eq('id', id)
        .select('*, category:category_id(*), location:location_id(*)')
        .single();

      if (error) throw error;

      await logAuditAction(
        id,
        `تجهیز به '${transferredTo}' منتقل شد`,
        getCurrentUserForLog(),
        'status',
        oldAsset.status,
        'منتقل شده',
      );

      return data;
  } catch (e) {
      console.warn("Online transfer failed, queuing offline action", e);
      // Fallback
      await queueOfflineAction(TABLES.ASSETS, 'UPDATE', updates, id, CACHE_KEYS.ASSETS);
      const oldAsset = await getAssetById(id);
      return { ...oldAsset, ...updates } as Asset;
  }
};


export const deleteAsset = async (id: string): Promise<void> => {
  const performOfflineDelete = async () => {
      await queueOfflineAction(TABLES.ASSETS, 'DELETE', {}, id, CACHE_KEYS.ASSETS);
  };

  if (!navigator.onLine) {
      return performOfflineDelete();
  }

  const client = getSupabaseSafe();
  try {
      const assetToDelete = await getAssetById(id);
      if (assetToDelete?.image_urls && assetToDelete.image_urls.length > 0) {
        await deleteImages(assetToDelete.image_urls);
      }

      const { error } = await client.from(TABLES.ASSETS).delete().eq('id', id);
      if (error) throw error;
  } catch (e) {
      console.warn("Online delete failed, queuing offline action", e);
      return performOfflineDelete();
  }
};

export const checkAssetIdNumberExists = async (
  asset_id_number: string,
  excludeId?: string,
): Promise<boolean> => {
  // Always check local first for speed/offline support
  const { data } = queryLocalData<Asset>(CACHE_KEYS.ASSETS, a => a.asset_id_number === asset_id_number && a.id !== excludeId);
  if (data.length > 0) return true;

  if (!navigator.onLine) return false;

  const client = getSupabaseSafe();
  try {
      let query = client
        .from(TABLES.ASSETS)
        .select('id', { count: 'exact', head: true })
        .eq('asset_id_number', asset_id_number);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count !== null && count > 0;
  } catch (e) {
      console.warn("Check ID failed, assuming not duplicate from server (local check passed)", e);
      return false;
  }
};

export const updateAssetImageUrls = async (
  assetId: string,
  newImageUrls: string[],
): Promise<Asset> => {
  // Images are hard to handle offline. We assume if you are updating image URLs,
  // you just successfully uploaded them (which requires online).
  // So we only try/catch the DB update part.
  
  const client = getSupabaseSafe();
  try {
      const { data, error } = await client
        .from(TABLES.ASSETS)
        .update({ image_urls: newImageUrls })
        .eq('id', assetId)
        .select('*, category:category_id(*), location:location_id(*)')
        .single();
      if (error) throw error;
      
      await logAuditAction(
        assetId,
        'تصاویر تجهیز بروزرسانی شد',
        getCurrentUserForLog(),
        'image_urls',
        null,
        'تعداد تصاویر: ' + newImageUrls.length
      );
      
      return data;
  } catch (e) {
      // If DB update fails but image upload succeeded, we are in inconsistent state.
      // Queueing offline action for image URL update is safe.
      await queueOfflineAction(TABLES.ASSETS, 'UPDATE', { image_urls: newImageUrls }, assetId, CACHE_KEYS.ASSETS);
      const oldAsset = await getAssetById(assetId);
      return { ...oldAsset, image_urls: newImageUrls } as Asset;
  }
};
