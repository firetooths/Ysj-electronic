
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
 * Handles Insert Operations (Online First -> Offline Fallback)
 * 1. Tries Supabase Insert.
 * 2. If fails (Offline), generates ID, saves to Local DB (for UI), saves to SyncQueue.
 */
export const handleOfflineInsert = async <T extends { id?: string }>(
    tableName: string,
    data: any,
    supabaseCall: () => Promise<any>
): Promise<T> => {
    try {
        if (!navigator.onLine) throw new Error('Offline');
        return await supabaseCall();
    } catch (error: any) {
        console.warn(`Offline Insert for ${tableName}:`, error);
        
        // Generate a temporary ID if not present
        const offlineData = { ...data };
        if (!offlineData.id) {
            offlineData.id = generateUUID();
        }
        
        // 1. Save to Local DB (for immediate UI update)
        try {
            const table = (db as any)[tableName];
            if (table) {
                await table.put(offlineData);
            }
        } catch (dbError) {
            console.error("Local DB Insert Error:", dbError);
        }

        // 2. Add to Sync Queue
        await db.syncQueue.add({
            table: tableName,
            action: 'CREATE',
            data: offlineData,
            timestamp: Date.now()
        });

        return offlineData as T;
    }
};

/**
 * Handles Update Operations
 */
export const handleOfflineUpdate = async <T>(
    tableName: string,
    id: string,
    updates: any,
    supabaseCall: () => Promise<any>
): Promise<T> => {
    try {
        if (!navigator.onLine) throw new Error('Offline');
        return await supabaseCall();
    } catch (error: any) {
        console.warn(`Offline Update for ${tableName}:`, error);

        // 1. Update Local DB
        try {
            const table = (db as any)[tableName];
            if (table) {
                await table.update(id, updates);
            }
        } catch (dbError) { console.error("Local DB Update Error:", dbError); }

        // 2. Add to Queue
        await db.syncQueue.add({
            table: tableName,
            action: 'UPDATE',
            data: { id, ...updates },
            timestamp: Date.now()
        });

        // Return merged data (approximation)
        return { id, ...updates } as T;
    }
};

/**
 * Handles Delete Operations
 */
export const handleOfflineDelete = async (
    tableName: string,
    id: string,
    supabaseCall: () => Promise<void>
): Promise<void> => {
    try {
        if (!navigator.onLine) throw new Error('Offline');
        await supabaseCall();
    } catch (error: any) {
        console.warn(`Offline Delete for ${tableName}:`, error);

        // 1. Delete from Local DB
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
            data: id, // For delete, data is the ID
            timestamp: Date.now()
        });
    }
};

/**
 * Handles Read Operations with Join Simulation for specific tables
 */
export const handleOfflineRead = async <T>(
    tableName: string,
    supabaseCall: () => Promise<T>,
    fallbackLogic: () => Promise<T>
): Promise<T> => {
    try {
        if (!navigator.onLine) throw new Error('Offline');
        return await supabaseCall();
    } catch (error: any) {
        console.warn(`Offline Read for ${tableName}:`, error);
        return await fallbackLogic();
    }
};
