
import { getSupabaseSafe } from './client';
import { Category } from '../types';
import { TABLES } from '../constants';
import { CACHE_KEYS, queryLocalData } from './offlineService';

// --- API Functions for Categories ---
export const getCategories = async (): Promise<Category[]> => {
  if (!navigator.onLine) {
      const { data } = queryLocalData<Category>(CACHE_KEYS.CATEGORIES, () => true, 1, 9999, (a, b) => a.name.localeCompare(b.name));
      return data;
  }

  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.CATEGORIES)
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    console.error('Error fetching categories:', error.message);
    throw error;
  }
  return data || [];
};

export const createCategory = async (name: string, icon: string | null, parent_id: string | null): Promise<Category> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.CATEGORIES)
    .insert({ name, icon, parent_id })
    .select('*')
    .single();
  if (error) {
    console.error('Error creating category:', error.message);
    throw error;
  }
  return data;
};

export const updateCategory = async (id: string, name: string, icon: string | null, parent_id: string | null): Promise<Category> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.CATEGORIES)
    .update({ name, icon, parent_id })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('Error updating category:', error.message);
    throw error;
  }
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  const client = getSupabaseSafe();
  const { error } = await client
    .from(TABLES.CATEGORIES)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting category:', error.message);
    throw error;
  }
};

export const reassignAssetsAndDeleteCategory = async (
  oldCategoryId: string,
  newCategoryId: string,
): Promise<void> => {
  const client = getSupabaseSafe();
  // Step 1: Reassign assets
  const { error: updateError } = await client
    .from(TABLES.ASSETS)
    .update({ category_id: newCategoryId })
    .eq('category_id', oldCategoryId);

  if (updateError) {
    console.error('Error reassigning assets for category:', updateError.message);
    throw updateError;
  }

  // Step 2: Delete the old category
  await deleteCategory(oldCategoryId);
};
