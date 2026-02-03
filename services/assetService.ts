
import { getSupabaseSafe } from './client';
import { logAuditAction } from './auditService';
import { deleteImages } from './storageService';
import { Asset, Location } from '../types';
import { TABLES } from '../constants';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineDelete, handleOfflineRead } from './offlineHandler';

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
  return handleOfflineRead(TABLES.ASSETS, 
    async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client
            .from(TABLES.ASSETS)
            .select('*, category:category_id(*), location:location_id(*)')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },
    async () => {
        const asset = await db.assets.get(id);
        if (!asset) return null;
        // Manual Join
        if (asset.category_id) asset.category = await db.categories.get(asset.category_id);
        if (asset.location_id) asset.location = await db.locations.get(asset.location_id);
        return asset;
    }
  );
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
    
    // Fallback Logic for Dexie
    const offlineFallback = async () => {
        let collection = db.assets.toCollection();
        
        // Apply filters in memory (Dexie filtering is basic)
        let allAssets = await collection.toArray();
        
        // Filter: Status != 'منتقل شده' (default logic)
        allAssets = allAssets.filter(a => a.status !== 'منتقل شده');

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            allAssets = allAssets.filter(a => 
                (a.name && a.name.toLowerCase().includes(lower)) ||
                (a.asset_id_number && String(a.asset_id_number).includes(lower)) ||
                (a.description && a.description.toLowerCase().includes(lower))
            );
        }
        if (statusFilter) allAssets = allAssets.filter(a => a.status === statusFilter);
        if (categoryFilter) allAssets = allAssets.filter(a => a.category_id === categoryFilter);
        if (locationFilter) allAssets = allAssets.filter(a => a.location_id === locationFilter);
        if (verifiedFilter !== null) allAssets = allAssets.filter(a => a.is_verified === verifiedFilter);
        if (externalFilter !== null) allAssets = allAssets.filter(a => a.is_external === externalFilter);

        // Sort descending by created_at (simulate)
        allAssets.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

        const total = allAssets.length;
        const from = (page - 1) * pageSize;
        const sliced = allAssets.slice(from, from + pageSize);

        // Join Category & Location
        const enriched = await Promise.all(sliced.map(async (asset) => {
            const a = { ...asset };
            if (a.category_id) a.category = await db.categories.get(a.category_id);
            if (a.location_id) a.location = await db.locations.get(a.location_id);
            return a;
        }));

        return { assets: enriched, total };
    };

    return handleOfflineRead(TABLES.ASSETS, async () => {
        const client = getSupabaseSafe();
        let query = client.from(TABLES.ASSETS)
            .select('*, category:category_id(*), location:location_id(*)', { count: 'exact' })
            .neq('status', 'منتقل شده');

        if (searchTerm) query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,asset_id_number.ilike.%${searchTerm}%`);
        if (statusFilter) query = query.eq('status', statusFilter);
        if (categoryFilter) query = query.eq('category_id', categoryFilter);
        if (locationFilter) query = query.eq('location_id', locationFilter);
        if (verifiedFilter !== null) query = query.eq('is_verified', verifiedFilter);
        if (externalFilter !== null) query = query.eq('is_external', externalFilter);

        const { data, error, count } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
        if (error) throw error;
        return { assets: data || [], total: count || 0 };
    }, offlineFallback);
};

export const getTransferredAssets = async (searchTerm: string = '', page: number = 1, pageSize: number = 10): Promise<{ assets: Asset[]; total: number }> => {
    const offlineFallback = async () => {
        let allAssets = await db.assets.where('status').equals('منتقل شده').toArray();
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            allAssets = allAssets.filter(a => a.name.toLowerCase().includes(lower) || String(a.asset_id_number).includes(lower));
        }
        allAssets.sort((a, b) => new Date(b.transferred_at || 0).getTime() - new Date(a.transferred_at || 0).getTime());
        const total = allAssets.length;
        const sliced = allAssets.slice((page - 1) * pageSize, page * pageSize);
        
        const enriched = await Promise.all(sliced.map(async (asset) => {
            const a = { ...asset };
            if (a.category_id) a.category = await db.categories.get(a.category_id);
            if (a.location_id) a.location = await db.locations.get(a.location_id);
            return a;
        }));
        return { assets: enriched, total };
    };

    return handleOfflineRead(TABLES.ASSETS, async () => {
        const client = getSupabaseSafe();
        let query = client.from(TABLES.ASSETS).select('*, category:category_id(*), location:location_id(*)', { count: 'exact' }).eq('status', 'منتقل شده');
        if (searchTerm) query = query.or(`name.ilike.%${searchTerm}%,transferred_to.ilike.%${searchTerm}%,asset_id_number.ilike.%${searchTerm}%`);
        const { data, error, count } = await query.order('transferred_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
        if (error) throw error;
        return { assets: data || [], total: count || 0 };
    }, offlineFallback);
};

export const getAssetCountByField = async (fieldName: 'category_id' | 'location_id', id: string): Promise<number> => {
    return handleOfflineRead(TABLES.ASSETS, 
        async () => {
            const client = getSupabaseSafe();
            const { count, error } = await client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq(fieldName, id);
            if (error) throw error;
            return count || 0;
        },
        async () => {
            return await db.assets.where(fieldName).equals(id).count();
        }
    );
};

export const createAsset = async (asset: any): Promise<Asset> => {
    const payload = { ...asset, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    
    const result = await handleOfflineInsert<Asset>(TABLES.ASSETS, payload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.ASSETS).insert(asset).select('*, category:category_id(*), location:location_id(*)').single();
        if (error) throw error;
        return data;
    });
    
    // We don't await audit logging to prevent blocking UI, and audit logic handles its own offline queue
    logAuditAction(result.id, 'ایجاد تجهیز جدید', getCurrentUserForLog(), null, JSON.stringify(result));
    return result;
};

export const updateAsset = async (id: string, updates: any): Promise<Asset> => {
    // Audit Logic Preparation (Needs to happen before update logic ideally, but for offline simple queue we log after)
    const oldAsset = await getAssetById(id);
    
    const result = await handleOfflineUpdate<Asset>(TABLES.ASSETS, id, { ...updates, updated_at: new Date().toISOString() }, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.ASSETS).update(updates).eq('id', id).select('*, category:category_id(*), location:location_id(*)').single();
        if (error) throw error;
        return data;
    });

    // Simple Audit log for offline actions (Full detail audit is complex offline)
    if (oldAsset) {
        logAuditAction(id, `بروزرسانی تجهیز (حالت آفلاین/آنلاین)`, getCurrentUserForLog(), 'general', 'old', 'new');
    }
    return result;
};

export const transferAsset = async (id: string, transferredTo: string): Promise<Asset> => {
    const updates = {
        status: 'منتقل شده',
        transferred_to: transferredTo,
        transferred_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    const result = await updateAsset(id, updates);
    logAuditAction(id, `تجهیز به '${transferredTo}' منتقل شد`, getCurrentUserForLog());
    return result;
};

export const deleteAsset = async (id: string): Promise<void> => {
    const asset = await getAssetById(id);
    if (asset?.image_urls && asset.image_urls.length > 0) {
        deleteImages(asset.image_urls).catch(e => console.warn("Offline image delete skip", e));
    }
    await handleOfflineDelete(TABLES.ASSETS, id, async () => {
        const client = getSupabaseSafe();
        const { error } = await client.from(TABLES.ASSETS).delete().eq('id', id);
        if (error) throw error;
    });
};

export const checkAssetIdNumberExists = async (asset_id_number: string, excludeId?: string): Promise<boolean> => {
    return handleOfflineRead(TABLES.ASSETS,
        async () => {
            const client = getSupabaseSafe();
            let query = client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq('asset_id_number', asset_id_number);
            if (excludeId) query = query.neq('id', excludeId);
            const { count, error } = await query;
            if (error) throw error;
            return count !== null && count > 0;
        },
        async () => {
            // Dexie check
            const found = await db.assets.where('asset_id_number').equals(asset_id_number).first();
            if (!found) return false;
            if (excludeId && found.id === excludeId) return false;
            return true;
        }
    );
};

export const updateAssetImageUrls = async (assetId: string, newImageUrls: string[]): Promise<Asset> => {
    return updateAsset(assetId, { image_urls: newImageUrls });
};
