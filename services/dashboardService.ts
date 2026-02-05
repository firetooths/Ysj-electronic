
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';
import { db } from '../db';
import { handleOfflineRead } from './offlineHandler';

// --- API Functions for Asset Dashboard ---

/**
 * Calculates asset statistics (Total, Verified, External, and by Status)
 * Native Feel: Uses Dexie for calculation when offline.
 */
export const getAssetStatusCounts = async (statusNames: string[] = []): Promise<{ [key: string]: number }> => {
  return handleOfflineRead('asset_stats', 
    async () => {
        const client = getSupabaseSafe();
        const queries = statusNames.map(status =>
            client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq('status', status)
        );
        queries.push(client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq('is_verified', true));
        queries.push(client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq('is_external', true));
        
        const results = await Promise.all(queries);
        const externalCount = results.pop()?.count || 0;
        const verifiedCount = results.pop()?.count || 0;
        const counts: { [key: string]: number } = { total: 0, verified: verifiedCount, external: externalCount };
        
        results.forEach((result, index) => {
            const count = result.count || 0;
            const key = statusNames[index];
            counts[key] = count;
            if (key !== 'منتقل شده') counts.total += count;
        });
        return counts;
    },
    async () => {
        // DEXIE FALLBACK: Calculate stats locally
        const allAssets = await db.assets.toArray();
        const counts: { [key: string]: number } = { total: 0, verified: 0, external: 0 };
        
        statusNames.forEach(name => counts[name] = 0);

        allAssets.forEach(asset => {
            if (asset.is_verified) counts.verified++;
            if (asset.is_external) counts.external++;
            
            if (statusNames.includes(asset.status)) {
                counts[asset.status]++;
                if (asset.status !== 'منتقل شده') counts.total++;
            }
        });
        return counts;
    }
  );
};

export const getAssetCountByFilter = async (
  filterType: 'category' | 'location',
  filterValue: string,
  statusFilter: string | 'all',
): Promise<number> => {
  return handleOfflineRead(`asset_count_${filterType}_${filterValue}`,
    async () => {
        const client = getSupabaseSafe();
        let query = client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true });
        if (filterType === 'category') query = query.eq('category_id', filterValue);
        else query = query.eq('location_id', filterValue);
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        const { count } = await query;
        return count || 0;
    },
    async () => {
        // DEXIE FALLBACK
        let collection = db.assets.toCollection();
        if (filterType === 'category') return await db.assets.where('category_id').equals(filterValue).filter(a => statusFilter === 'all' || a.status === statusFilter).count();
        else return await db.assets.where('location_id').equals(filterValue).filter(a => statusFilter === 'all' || a.status === statusFilter).count();
    }
  );
};

// --- API Functions for Phone Line Dashboard ---

export const getPhoneLineStats = async (): Promise<{ totalLines: number; activeFaults: number }> => {
  return handleOfflineRead('phone_stats',
    async () => {
        const client = getSupabaseSafe();
        const { count: totalLines } = await client.from(TABLES.PHONE_LINES).select('*', { count: 'exact', head: true });
        const { count: activeFaults } = await client.from(TABLES.PHONE_LINES).select('*', { count: 'exact', head: true }).eq('has_active_fault', true);
        return { totalLines: totalLines || 0, activeFaults: activeFaults || 0 };
    },
    async () => {
        const totalLines = await db.phone_lines.count();
        const activeFaults = await db.phone_lines.where('has_active_fault').equals(1).count(); // Dexie uses 1/0 for bool usually if not specified
        return { totalLines, activeFaults: activeFaults || (await db.phone_lines.filter(l => l.has_active_fault === true).count()) };
    }
  );
};

export const getPhoneLineCountByTags = async (tagIds: string[]): Promise<number> => {
  if (tagIds.length === 0) return 0;
  
  return handleOfflineRead(`phone_tag_count_${tagIds.join('_')}`,
    async () => {
        const client = getSupabaseSafe();
        const { data } = await client.from(TABLES.PHONE_LINE_TAGS).select('phone_line_id').in('tag_id', tagIds);
        return new Set((data || []).map(item => item.phone_line_id)).size;
    },
    async () => {
        const lineTags = await db.phone_line_tags.where('tag_id').anyOf(tagIds).toArray();
        return new Set(lineTags.map(lt => lt.phone_line_id)).size;
    }
  );
};
