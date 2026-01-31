
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Category, Location, SupabaseContextType, Node, WireColor, Tag, ContactGroup, AssetStatusItem } from './types';
import { supabase, supabaseConfigError, getCategories, getLocations, seedDefaultData, getNodes, getSetting, getTags, getContactGroups, getSupabaseSafe, getAssetStatuses } from './supabaseService';
import { DEFAULT_WIRE_COLORS, SETTINGS_KEYS } from './constants';

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Asset Management State
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assetStatuses, setAssetStatuses] = useState<AssetStatusItem[]>([]);
  
  // Phone Line Management State
  const [nodes, setNodes] = useState<Node[]>([]);
  const [wireColors, setWireColors] = useState<WireColor[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Contact Management State
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  
  // General State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const fetchedCategories = await getCategories();
      setCategories(fetchedCategories);
    } catch (err: any) {
      console.error(`خطا در بارگذاری دسته بندی‌ها: ${err.message}`);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const fetchedLocations = await getLocations();
      setLocations(fetchedLocations);
    } catch (err: any) {
      console.error(`خطا در بارگذاری محل‌ها: ${err.message}`);
    }
  }, []);

  const fetchAssetStatuses = useCallback(async () => {
    try {
      const statuses = await getAssetStatuses();
      setAssetStatuses(statuses);
    } catch (err: any) {
      console.error(`خطا در بارگذاری وضعیت‌های اموال: ${err.message}`);
    }
  }, []);
  
  const fetchNodes = useCallback(async () => {
    try {
      const fetchedNodes = await getNodes();
      setNodes(fetchedNodes);
    } catch (err: any) {
      console.error(`خطا در بارگذاری گره‌ها: ${err.message}`);
    }
  }, []);

  const fetchWireColors = useCallback(async () => {
    try {
      const colorsJson = await getSetting(SETTINGS_KEYS.PHONE_WIRE_COLORS);
      const colors = colorsJson ? JSON.parse(colorsJson) : DEFAULT_WIRE_COLORS;
      setWireColors(colors);
    } catch (err: any) {
      console.error(`خطا در بارگذاری رنگ‌های زوج سیم: ${err.message}`);
      setWireColors(DEFAULT_WIRE_COLORS);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const fetchedTags = await getTags();
      setTags(fetchedTags);
    } catch (err: any) {
      console.error(`خطا در بارگذاری تگ‌ها: ${err.message}`);
    }
  }, []);

  const fetchContactGroups = useCallback(async () => {
    try {
      const groups = await getContactGroups();
      setContactGroups(groups);
    } catch (err: any) {
      console.error(`خطا در بارگذاری گروه‌های مخاطبین: ${err.message}`);
    }
  }, []);

  const refreshCategories = useCallback(async () => { await fetchCategories(); }, [fetchCategories]);
  const refreshLocations = useCallback(async () => { await fetchLocations(); }, [fetchLocations]);
  const refreshAssetStatuses = useCallback(async () => { await fetchAssetStatuses(); }, [fetchAssetStatuses]);
  const refreshNodes = useCallback(async () => { await fetchNodes(); }, [fetchNodes]);
  const refreshWireColors = useCallback(async () => { await fetchWireColors(); }, [fetchWireColors]);
  const refreshTags = useCallback(async () => { await fetchTags(); }, [fetchTags]);
  const refreshContactGroups = useCallback(async () => { await fetchContactGroups(); }, [fetchContactGroups]);

  useEffect(() => {
    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setIsLoading(false);
      return;
    }

    const initializeData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Quick connectivity check before attempting heavy operations
        const client = getSupabaseSafe();
        const { error: pingError } = await client.from('app_settings').select('key').limit(1).maybeSingle();
        
        if (pingError && pingError.message && pingError.message.includes('Failed to fetch')) {
             throw new Error('عدم دسترسی به سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
        }

        await seedDefaultData();
        await Promise.all([
          fetchCategories(),
          fetchLocations(),
          fetchAssetStatuses(),
          fetchNodes(),
          fetchWireColors(),
          fetchTags(),
          fetchContactGroups(),
        ]);
      } catch (err: any) {
        const msg = err.message || `خطا در مقداردهی اولیه داده‌ها.`;
        setError(msg);
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [fetchCategories, fetchLocations, fetchAssetStatuses, fetchNodes, fetchWireColors, fetchTags, fetchContactGroups]);

  if (supabaseConfigError) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 shadow-md rounded-md text-right max-w-lg mx-auto" role="alert">
          <div className="flex items-center justify-end">
            <p className="font-bold text-lg">خطای پیکربندی Supabase</p>
            <svg className="h-6 w-6 text-red-500 mr-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0V9a1 1 0 10-2 0v4zm1-8a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"></path>
            </svg>
          </div>
          <p className="text-sm mt-2">{supabaseConfigError}</p>
          <p className="text-xs mt-2">لطفاً فایل .env.local را در ریشه پروژه ایجاد کرده و متغیرهای `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` را مطابق دستورالعمل در `supabaseService.ts` تنظیم کنید.</p>
        </div>
      </div>
    );
  }

  const value = {
    supabase,
    categories,
    locations,
    assetStatuses,
    refreshCategories,
    refreshLocations,
    refreshAssetStatuses,
    nodes,
    wireColors,
    tags,
    refreshNodes,
    refreshWireColors,
    refreshTags,
    contactGroups,
    refreshContactGroups,
    isLoading,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabaseContext = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabaseContext must be used within a SupabaseProvider');
  }
  return context;
};
