
import { getSupabaseSafe } from './client';
import { AssetStatusItem } from '../types';
import { TABLES } from '../constants';

export const getAssetStatuses = async (): Promise<AssetStatusItem[]> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.ASSET_STATUSES)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching asset statuses:', error.message);
    throw error;
  }
  return data || [];
};

export const createAssetStatus = async (name: string, color: string | null): Promise<AssetStatusItem> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.ASSET_STATUSES)
    .insert({ name, color, is_system: false })
    .select('*')
    .single();
  if (error) {
    console.error('Error creating asset status:', error.message);
    throw error;
  }
  return data;
};

export const updateAssetStatus = async (id: string, updates: Partial<Pick<AssetStatusItem, 'name' | 'color'>>): Promise<AssetStatusItem> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.ASSET_STATUSES)
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('Error updating asset status:', error.message);
    throw error;
  }
  return data;
};

export const deleteAssetStatus = async (id: string): Promise<void> => {
  const client = getSupabaseSafe();
  const { error } = await client
    .from(TABLES.ASSET_STATUSES)
    .delete()
    .eq('id', id)
    .eq('is_system', false); // Protection
  if (error) {
    console.error('Error deleting asset status:', error.message);
    throw error;
  }
};
