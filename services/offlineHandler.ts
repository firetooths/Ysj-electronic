
import { db } from '../db';
import { TABLES } from '../constants';

export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const handleOfflineInsert = async <T extends { id?: string }>(
    tableName: string,
    data: any,
    supabaseCall: () => Promise<any>
): Promise<T> => {
    const offlineData = { ...data };
    if (!offlineData.id) {
        offlineData.id = generateUUID();
    }
    
    try {
        const table = (db as any)[tableName];
        if (table) await table.put(offlineData);
    } catch (dbError) {
        console.error("Local DB Insert Error:", dbError);
    }

    await db.syncQueue.add({
        table: tableName,
        action: 'CREATE',
        data: offlineData,
        timestamp: Date.now()
    });

    if (navigator.onLine) {
        supabaseCall().catch(() => {});
    }

    return offlineData as T;
};

export const handleOfflineUpdate = async <T>(
    tableName: string,
    id: string,
    updates: any,
    supabaseCall: () => Promise<any>
): Promise<T> => {
    try {
        const table = (db as any)[tableName];
        if (table) await table.update(id, updates);
    } catch (dbError) { 
        console.error("Local DB Update Error:", dbError); 
    }

    await db.syncQueue.add({
        table: tableName,
        action: 'UPDATE',
        data: { id, ...updates },
        timestamp: Date.now()
    });

    if (navigator.onLine) {
        supabaseCall().catch(() => {});
    }

    return { id, ...updates } as T;
};

export const handleOfflineDelete = async (
    tableName: string,
    id: string,
    supabaseCall: () => Promise<void>
): Promise<void> => {
    try {
        const table = (db as any)[tableName];
        if (table) await table.delete(id);
    } catch (dbError) { console.error("Local DB Delete Error:", dbError); }

    await db.syncQueue.add({
        table: tableName,
        action: 'DELETE',
        data: id,
        timestamp: Date.now()
    });

    if (navigator.onLine) {
        supabaseCall().catch(() => {});
    }
};

/**
 * Robust Read Strategy for APK:
 * 1. If Offline: Return Local Data immediately (NO FETCH ATTEMPT).
 * 2. If Online: Return Local Data immediately, AND sync from network in background.
 */
export const handleOfflineRead = async <T>(
    tableName: string,
    supabaseCall: () => Promise<T>,
    fallbackLogic: () => Promise<T>
): Promise<T> => {
    const localData = await fallbackLogic();
    
    // Check if we are strictly offline
    if (!navigator.onLine) {
        return localData;
    }

    // If online but we already have local data, return it for speed
    const isArray = Array.isArray(localData);
    const hasData = isArray ? localData.length > 0 : !!localData;

    if (hasData) {
        // Fire network call in background to refresh local cache for next time
        supabaseCall().catch(() => {}); 
        return localData;
    }

    // Only if online AND local is empty, we MUST wait for network
    try {
        return await supabaseCall();
    } catch (error) {
        console.warn(`Fetch failed for ${tableName}, using empty fallback`);
        return localData;
    }
};
