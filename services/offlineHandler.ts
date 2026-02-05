
import { db } from '../db';
import { TABLES } from '../constants';

// Helper to generate UUID v4 for offline items
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Handles Insert Operations (Native feel: Save locally first, sync in background)
 */
export const handleOfflineInsert = async <T extends { id?: string }>(
    tableName: string,
    data: any,
    supabaseCall: () => Promise<any>
): Promise<T> => {
    // 1. Generate ID and save to Local DB IMMEDIATELY
    const offlineData = { ...data };
    if (!offlineData.id) {
        offlineData.id = generateUUID();
    }
    
    try {
        const table = (db as any)[tableName];
        if (table) {
            await table.put(offlineData);
        }
    } catch (dbError) {
        console.error("Local DB Insert Error:", dbError);
    }

    // 2. Add to Sync Queue for background processing
    await db.syncQueue.add({
        table: tableName,
        action: 'CREATE',
        data: offlineData,
        timestamp: Date.now()
    });

    // 3. Try to sync with Supabase in background if online
    if (navigator.onLine) {
        supabaseCall().catch(err => console.warn("Background sync failed, will retry later.", err));
    }

    return offlineData as T;
};

/**
 * Handles Update Operations (Native feel: Update locally first)
 */
export const handleOfflineUpdate = async <T>(
    tableName: string,
    id: string,
    updates: any,
    supabaseCall: () => Promise<any>
): Promise<T> => {
    // 1. Update Local DB immediately
    try {
        const table = (db as any)[tableName];
        if (table) {
            await table.update(id, updates);
        }
    } catch (dbError) { 
        console.error("Local DB Update Error:", dbError); 
    }

    // 2. Add to Queue
    await db.syncQueue.add({
        table: tableName,
        action: 'UPDATE',
        data: { id, ...updates },
        timestamp: Date.now()
    });

    // 3. Background sync
    if (navigator.onLine) {
        supabaseCall().catch(err => console.warn("Background update sync failed", err));
    }

    return { id, ...updates } as T;
};

/**
 * Handles Delete Operations
 */
export const handleOfflineDelete = async (
    tableName: string,
    id: string,
    supabaseCall: () => Promise<void>
): Promise<void> => {
    // 1. Delete from Local DB immediately
    try {
        const table = (db as any)[tableName];
        if (table) {
            await table.delete(id);
        }
    } catch (dbError) { console.error("Local DB Delete Error:", dbError); }

    // 2. Add to Queue
    await db.syncQueue.add({
        table: tableName,
        action: 'DELETE',
        data: id,
        timestamp: Date.now()
    });

    // 3. Background sync
    if (navigator.onLine) {
        supabaseCall().catch(err => console.warn("Background delete sync failed", err));
    }
};

/**
 * Handles Read Operations (CRITICAL FOR NATIVE FEEL)
 * Strategy: Return Local Data immediately, but provide a way to refresh.
 * To keep it simple for now, we prioritize local and only fetch from network if local is empty.
 */
export const handleOfflineRead = async <T>(
    tableName: string,
    supabaseCall: () => Promise<T>,
    fallbackLogic: () => Promise<T>
): Promise<T> => {
    // NATIVE STRATEGY: Try local first. If it has data, return it.
    // This removes the "Loading..." spinner on almost all page transitions.
    const localData = await fallbackLogic();
    
    const isArray = Array.isArray(localData);
    const hasData = isArray ? localData.length > 0 : !!localData;

    if (hasData) {
        // If we are online, we could trigger a background refresh, 
        // but for a smooth UI, we return the local data NOW.
        if (navigator.onLine) {
            // We fire and forget the supabase call to update our local cache for NEXT time
            supabaseCall().then(freshData => {
                // Background update local DB logic could go here
            }).catch(() => {});
        }
        return localData;
    }

    // Only if local is empty, we wait for network
    try {
        if (!navigator.onLine) return localData; // Return empty local
        return await supabaseCall();
    } catch (error) {
        return localData;
    }
};
