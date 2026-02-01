
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
    
    // New Tables for Full Sync
    PHONE_FAULTS: 'offline_db_phone_faults',
    PHONE_LOGS: 'offline_db_phone_logs',
    ROUTE_NODES: 'offline_db_route_nodes',
    CNS_EQUIPMENT: 'offline_db_cns_equipment',
    CNS_FAULTS: 'offline_db_cns_faults',
    MAINTENANCE_SCHEDULES: 'offline_db_maintenance_schedules',
    TASKS: 'offline_db_tasks',
    USERS: 'offline_db_users',
    ROLES: 'offline_db_roles',
    SHIFT_REQUESTS: 'offline_db_shift_requests',

    LAST_SYNC: 'offline_last_sync_time',
    MUTATION_QUEUE: 'offline_mutation_queue'
};

export interface OfflineAction {
    id: string;
    table: string;
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    recordId: string;
    timestamp: number;
}

export const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Queue offline changes
 */
export const queueOfflineAction = async (
    table: string,
    type: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any,
    recordId: string,
    cacheKey: string
) => {
    console.log(`Queueing offline action: ${type} on ${table}`);
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

    // Optimistic Update
    const cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
        let cacheData: any[] = JSON.parse(cacheRaw);
        if (type === 'INSERT') {
            cacheData.unshift({ ...payload, id: recordId, is_offline_pending: true });
        } else if (type === 'UPDATE') {
            cacheData = cacheData.map(item => 
                item.id === recordId ? { ...item, ...payload, is_offline_pending: true } : item
            );
        } else if (type === 'DELETE') {
            cacheData = cacheData.filter(item => item.id !== recordId);
        }
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    }
};

/**
 * Process queue
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
            const cleanPayload = { ...payload };
            delete cleanPayload.is_offline_pending; 

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
                if (error.message && !error.message.includes('Failed to fetch')) {
                     console.warn("Removing failed action due to logic error.");
                } else {
                    remainingQueue.push(action);
                }
            }
        } catch (e) {
            console.error("Exception processing queue item:", e);
            remainingQueue.push(action);
        }
    }

    localStorage.setItem(CACHE_KEYS.MUTATION_QUEUE, JSON.stringify(remainingQueue));
    if (remainingQueue.length === 0) {
        await syncFullDatabase();
    }
};

export const getQueueSize = (): number => {
    const queueRaw = localStorage.getItem(CACHE_KEYS.MUTATION_QUEUE);
    return queueRaw ? JSON.parse(queueRaw).length : 0;
};

/**
 * Downloads ALL critical tables to LocalStorage.
 */
export const syncFullDatabase = async (): Promise<boolean> => {
    if (!navigator.onLine) return false;

    // First push changes
    await processOfflineQueue();

    const client = getSupabaseSafe();
    console.log('Starting full database sync...');

    try {
        // We fetch in batches or groups to avoid massive Promise.all failure
        // Group 1: Core Definitions
        const group1 = await Promise.all([
            client.from(TABLES.CATEGORIES).select('*'),
            client.from(TABLES.LOCATIONS).select('*'),
            client.from(TABLES.TAGS).select('*'),
            client.from(TABLES.NODES).select('*'),
            client.from(TABLES.ASSET_STATUSES).select('*'),
            client.from(TABLES.ROLES).select('*'),
            client.from(TABLES.USERS).select('*, role:role_id(*)'),
        ]);

        // Group 2: Assets & Phones
        const group2 = await Promise.all([
            client.from(TABLES.ASSETS).select('*, category:category_id(*), location:location_id(*)'),
            client.from(TABLES.PHONE_LINES).select('*, tags(*)'),
            client.from(TABLES.ROUTE_NODES).select('*, node:node_id(*), phone_line:line_id(*)'),
            client.from(TABLES.PHONE_LINE_FAULTS).select('*, phone_line:phone_line_id(*)'),
        ]);

        // Group 3: Contacts, CNS, Tasks, Shifts
        const group3 = await Promise.all([
            client.from(TABLES.CONTACTS).select('*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!contact_group_members(*)'),
            client.from(TABLES.CNS_EQUIPMENT).select('*'),
            client.from(TABLES.CNS_FAULT_REPORTS).select('*, equipment:equipment_id(*)'),
            client.from(TABLES.CNS_MAINTENANCE_SCHEDULES).select('*'),
            client.from(TABLES.TASKS).select('*'),
            client.from(TABLES.SHIFT_REQUESTS).select('*, requester:requester_id(*), provider:provider_id(*), supervisor:supervisor_id(*)'),
        ]);

        // Save Group 1
        localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(group1[0].data || []));
        localStorage.setItem(CACHE_KEYS.LOCATIONS, JSON.stringify(group1[1].data || []));
        localStorage.setItem(CACHE_KEYS.TAGS, JSON.stringify(group1[2].data || []));
        localStorage.setItem(CACHE_KEYS.NODES, JSON.stringify(group1[3].data || []));
        localStorage.setItem(CACHE_KEYS.ASSET_STATUSES, JSON.stringify(group1[4].data || []));
        localStorage.setItem(CACHE_KEYS.ROLES, JSON.stringify(group1[5].data || []));
        localStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(group1[6].data || []));

        // Save Group 2
        localStorage.setItem(CACHE_KEYS.ASSETS, JSON.stringify(group2[0].data || []));
        localStorage.setItem(CACHE_KEYS.PHONE_LINES, JSON.stringify(group2[1].data || []));
        localStorage.setItem(CACHE_KEYS.ROUTE_NODES, JSON.stringify(group2[2].data || []));
        localStorage.setItem(CACHE_KEYS.PHONE_FAULTS, JSON.stringify(group2[3].data || []));

        // Save Group 3
        localStorage.setItem(CACHE_KEYS.CONTACTS, JSON.stringify(group3[0].data || []));
        localStorage.setItem(CACHE_KEYS.CNS_EQUIPMENT, JSON.stringify(group3[1].data || []));
        localStorage.setItem(CACHE_KEYS.CNS_FAULTS, JSON.stringify(group3[2].data || []));
        localStorage.setItem(CACHE_KEYS.MAINTENANCE_SCHEDULES, JSON.stringify(group3[3].data || []));
        localStorage.setItem(CACHE_KEYS.TASKS, JSON.stringify(group3[4].data || []));
        localStorage.setItem(CACHE_KEYS.SHIFT_REQUESTS, JSON.stringify(group3[5].data || []));
        
        const now = new Date().toISOString();
        localStorage.setItem(CACHE_KEYS.LAST_SYNC, now);
        
        console.log('Full database sync completed successfully at', now);
        return true;
    } catch (error) {
        console.error('Sync failed:', error);
        return false;
    }
};

/**
 * Loads data directly from local storage key
 */
export const loadFromCache = <T>(key: string): T[] => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error(`Error loading cache for ${key}`, e);
        return [];
    }
};

/**
 * Query local data with basic filtering
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

        if (filterFn) {
            data = data.filter(filterFn);
        }

        if (sortFn) {
            data.sort(sortFn);
        } else {
            // Default sort by created_at desc
            data.sort((a: any, b: any) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA;
            });
        }

        const total = data.length;
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

export const exportLocalDataToJson = () => {
    const backup: any = {};
    for (const key in CACHE_KEYS) {
        const storageKey = (CACHE_KEYS as any)[key];
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            backup[key] = JSON.parse(raw);
        }
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "airport_app_backup_" + new Date().toISOString() + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};
