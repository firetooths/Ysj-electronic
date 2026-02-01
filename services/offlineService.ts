
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';
import { Capacitor } from '@capacitor/core';

// Keys for LocalStorage
export const CACHE_KEYS = {
    ASSETS: 'offline_db_assets',
    PHONE_LINES: 'offline_db_phone_lines',
    CONTACTS: 'offline_db_contacts',
    CATEGORIES: 'offline_db_categories',
    LOCATIONS: 'offline_db_locations',
    TAGS: 'offline_db_tags',
    NODES: 'offline_db_nodes',
    WIRE_COLORS: 'offline_db_wire_colors',
    ASSET_STATUSES: 'offline_db_asset_statuses',
    LAST_SYNC: 'offline_last_sync_time',
    MUTATION_QUEUE: 'offline_mutation_queue' // New key for pending changes
};

export interface OfflineAction {
    id: string; // Unique ID for the action
    table: string;
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    recordId: string; // The ID of the record being modified
    timestamp: number;
}

const isNative = () => {
    try {
        return Capacitor.isNativePlatform();
    } catch (e) {
        return false;
    }
};

export const generateUUID = () => {
    // Simple UUID generator for offline items
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Queues an action to be performed when online.
 * Also performs an OPTIMISTIC UPDATE on the local cache.
 */
export const queueOfflineAction = async (
    table: string,
    type: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any,
    recordId: string,
    cacheKey: string // To update the local list immediately
) => {
    console.log(`Queueing offline action: ${type} on ${table}`);

    // 1. Add to Queue
    const queueRaw = localStorage.getItem(CACHE_KEYS.MUTATION_QUEUE);
    const queue: OfflineAction[] = queueRaw ? JSON.parse(queueRaw) : [];
    
    const action: OfflineAction = {
        id: generateUUID(),
        table,
        type,
        payload,
        recordId,
        timestamp: Date.now()
    };
    
    queue.push(action);
    localStorage.setItem(CACHE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));

    // 2. Optimistic Update (Update Local Cache)
    const cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
        let cacheData: any[] = JSON.parse(cacheRaw);
        
        if (type === 'INSERT') {
            // Add new item to cache
            // Ensure payload has the ID
            cacheData.unshift({ ...payload, id: recordId, is_offline_pending: true });
        } else if (type === 'UPDATE') {
            // Update item in cache
            cacheData = cacheData.map(item => 
                item.id === recordId ? { ...item, ...payload, is_offline_pending: true } : item
            );
        } else if (type === 'DELETE') {
            // Remove item from cache
            cacheData = cacheData.filter(item => item.id !== recordId);
        }
        
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    }
};

/**
 * Process the queue and send changes to Supabase
 */
export const processOfflineQueue = async () => {
    if (!navigator.onLine) return;

    const queueRaw = localStorage.getItem(CACHE_KEYS.MUTATION_QUEUE);
    if (!queueRaw) return;

    let queue: OfflineAction[] = JSON.parse(queueRaw);
    if (queue.length === 0) return;

    console.log(`Processing offline queue: ${queue.length} items...`);
    const client = getSupabaseSafe();
    const remainingQueue: OfflineAction[] = [];

    for (const action of queue) {
        try {
            const { table, type, payload, recordId } = action;
            let error = null;

            // Remove internal flags before sending
            const cleanPayload = { ...payload };
            delete cleanPayload.is_offline_pending; 
            // Also remove relations if they exist in payload but shouldn't be sent (like 'category: {...}')
            // This assumes payload is relatively clean from the service.

            if (type === 'INSERT') {
                const { error: insertError } = await client.from(table).insert(cleanPayload);
                error = insertError;
            } else if (type === 'UPDATE') {
                const { error: updateError } = await client.from(table).update(cleanPayload).eq('id', recordId);
                error = updateError;
            } else if (type === 'DELETE') {
                const { error: deleteError } = await client.from(table).delete().eq('id', recordId);
                error = deleteError;
            }

            if (error) {
                console.error(`Failed to sync action ${action.id}:`, error);
                // If it's a conflict (e.g. already deleted), maybe ignore? 
                // For now, keep in queue or move to error queue. 
                // Simple strategy: Keep in queue if network error, drop if logic error (to prevent blocking).
                if (error.message && !error.message.includes('Failed to fetch')) {
                     // Logic error (e.g. duplicate key), remove from queue to unblock
                     console.warn("Removing failed action due to logic error (not network).");
                } else {
                    remainingQueue.push(action);
                }
            } else {
                console.log(`Synced action ${action.id} successfully.`);
            }

        } catch (e) {
            console.error("Exception processing queue item:", e);
            remainingQueue.push(action);
        }
    }

    localStorage.setItem(CACHE_KEYS.MUTATION_QUEUE, JSON.stringify(remainingQueue));
    
    // If queue is cleared, trigger a full sync to get fresh data (IDs, timestamps, etc)
    if (remainingQueue.length === 0) {
        await syncFullDatabase();
    }
};

export const getQueueSize = (): number => {
    const queueRaw = localStorage.getItem(CACHE_KEYS.MUTATION_QUEUE);
    return queueRaw ? JSON.parse(queueRaw).length : 0;
};

/**
 * Downloads the full database versions of critical tables and saves to LocalStorage.
 * This effectively creates a local mirror for offline use.
 */
export const syncFullDatabase = async (): Promise<boolean> => {
    // Only allow sync if online
    if (!navigator.onLine) return false;

    // Process queue first!
    await processOfflineQueue();

    const client = getSupabaseSafe();
    console.log('Starting full database sync...');

    try {
        const results = await Promise.all([
            client.from(TABLES.ASSETS).select('*, category:category_id(*), location:location_id(*)'),
            client.from(TABLES.PHONE_LINES).select('*, tags(*)'),
            client.from(TABLES.CONTACTS).select('*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!contact_group_members(*)'),
            client.from(TABLES.CATEGORIES).select('*'),
            client.from(TABLES.LOCATIONS).select('*'),
            client.from(TABLES.TAGS).select('*'),
            client.from(TABLES.NODES).select('*'),
            client.from(TABLES.ASSET_STATUSES).select('*'),
        ]);

        const [assets, phoneLines, contacts, categories, locations, tags, nodes, assetStatuses] = results;

        if (assets.error) throw assets.error;
        if (phoneLines.error) throw phoneLines.error;
        if (contacts.error) throw contacts.error;

        // Save to Storage
        localStorage.setItem(CACHE_KEYS.ASSETS, JSON.stringify(assets.data || []));
        localStorage.setItem(CACHE_KEYS.PHONE_LINES, JSON.stringify(phoneLines.data || []));
        localStorage.setItem(CACHE_KEYS.CONTACTS, JSON.stringify(contacts.data || []));
        localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories.data || []));
        localStorage.setItem(CACHE_KEYS.LOCATIONS, JSON.stringify(locations.data || []));
        localStorage.setItem(CACHE_KEYS.TAGS, JSON.stringify(tags.data || []));
        localStorage.setItem(CACHE_KEYS.NODES, JSON.stringify(nodes.data || []));
        localStorage.setItem(CACHE_KEYS.ASSET_STATUSES, JSON.stringify(assetStatuses.data || []));
        
        localStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
        
        console.log('Full database sync completed successfully.');
        return true;
    } catch (error) {
        console.error('Sync failed:', error);
        return false;
    }
};

/**
 * Generic function to query local data with basic filtering and pagination
 */
export const queryLocalData = <T>(
    key: string,
    filterFn: (item: T) => boolean,
    page: number = 1,
    pageSize: number = 10,
    sortFn?: (a: T, b: T) => number
): { data: T[], total: number } => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return { data: [], total: 0 };

        let data: T[] = JSON.parse(raw);

        // Apply Filtering
        if (filterFn) {
            data = data.filter(filterFn);
        }

        // Apply Sorting
        if (sortFn) {
            data.sort(sortFn);
        } else {
            // Default sort by created_at desc if available, else nothing
            data.sort((a: any, b: any) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA;
            });
        }

        const total = data.length;

        // Apply Pagination
        const startIndex = (page - 1) * pageSize;
        const slicedData = data.slice(startIndex, startIndex + pageSize);

        return { data: slicedData, total };

    } catch (e) {
        console.error(`Error querying local data for ${key}:`, e);
        return { data: [], total: 0 };
    }
};

export const getLastSyncTime = (): string | null => {
    return localStorage.getItem(CACHE_KEYS.LAST_SYNC);
};
