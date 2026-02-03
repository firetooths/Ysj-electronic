
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineRead } from './offlineHandler';

export const getSetting = async (key: string): Promise<any | null> => {
    return handleOfflineRead(TABLES.APP_SETTINGS, 
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.APP_SETTINGS).select('value').eq('key', key).single();
            if (error && error.code !== 'PGRST116') console.warn(`Error getting setting "${key}":`, error.message);
            return data?.value || null;
        },
        async () => {
            const setting = await db.app_settings.get(key);
            return setting?.value || null;
        }
    );
};

export const setSetting = async (key: string, value: any): Promise<void> => {
    // Check if exists first to decide Insert vs Update (Upsert)
    // Offline handler for Upsert is tricky, we treat as Update if exists locally, else Insert
    const existing = await db.app_settings.get(key);
    
    if (existing) {
        await handleOfflineUpdate(TABLES.APP_SETTINGS, key, { value }, async () => {
            const client = getSupabaseSafe();
            const { error } = await client.from(TABLES.APP_SETTINGS).upsert({ key, value });
            if (error) throw error;
        });
    } else {
        await handleOfflineInsert(TABLES.APP_SETTINGS, { key, value }, async () => {
            const client = getSupabaseSafe();
            const { error } = await client.from(TABLES.APP_SETTINGS).upsert({ key, value });
            if (error) throw error;
        });
    }
};
