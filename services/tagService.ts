
import { getSupabaseSafe } from './client';
import { Tag } from '../types';
import { TABLES } from '../constants';
import { CACHE_KEYS, queryLocalData } from './offlineService';

// --- API Functions for Phone Line Tags ---
export const getTags = async (): Promise<Tag[]> => {
    if (!navigator.onLine) {
        const { data } = queryLocalData<Tag>(CACHE_KEYS.TAGS, () => true, 1, 9999, (a, b) => a.name.localeCompare(b.name));
        return data;
    }

    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.TAGS).select('*').order('name');
    if (error) throw error;
    return data || [];
};

export const createTag = async (tagData: Omit<Tag, 'id' | 'created_at'>): Promise<Tag> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.TAGS).insert(tagData).select().single();
    if (error) throw error;
    return data;
};

export const updateTag = async (tagId: string, tagData: Partial<Omit<Tag, 'id' | 'created_at'>>): Promise<Tag> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.TAGS).update(tagData).eq('id', tagId).select().single();
    if (error) throw error;
    return data;
};

export const deleteTag = async (tagId: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.TAGS).delete().eq('id', tagId);
    if (error) throw error;
};

export const checkTagUsage = async (tagId: string): Promise<number> => {
    const client = getSupabaseSafe();
    const { count, error } = await client.from(TABLES.PHONE_LINE_TAGS).select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId);
    if (error) throw error;
    return count || 0;
};
