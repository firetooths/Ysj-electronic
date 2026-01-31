
import { getSupabaseSafe } from './client';
import { TABLES } from '../constants';

// --- API Functions for Asset Dashboard ---
export const getAssetStatusCounts = async (statusNames: string[] = []): Promise<{ [key: string]: number }> => {
  const client = getSupabaseSafe();
  
  // Create queries for each status
  const queries = statusNames.map(status =>
    client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq('status', status)
  );

  // Add a query for Verified Assets (is_verified = true)
  queries.push(
      client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq('is_verified', true)
  );

  // Add a query for External Assets (is_external = true)
  queries.push(
      client.from(TABLES.ASSETS).select('id', { count: 'exact', head: true }).eq('is_external', true)
  );

  const results = await Promise.all(queries);

  // Extract external count (last item)
  const externalResult = results.pop();
  const externalCount = externalResult?.count || 0;

  // Extract verified count (now last item)
  const verifiedResult = results.pop();
  const verifiedCount = verifiedResult?.count || 0;

  const counts: { [key: string]: number } = { total: 0, verified: verifiedCount, external: externalCount };
  
  results.forEach((result, index) => {
    if (result.error) {
      console.error('Error fetching asset count:', result.error.message);
      throw result.error;
    }
    const count = result.count || 0;
    const key = statusNames[index];
    counts[key] = count;
    
    // Do not include 'منتقل شده' in the main active total count
    if (key !== 'منتقل شده') {
      counts.total += count;
    }
  });

  return counts;
};


export const getAssetCountByFilter = async (
  filterType: 'category' | 'location',
  filterValue: string,
  statusFilter: string | 'all',
): Promise<number> => {
  const client = getSupabaseSafe();
  let query = client
    .from(TABLES.ASSETS)
    .select('id', { count: 'exact', head: true });

  if (filterType === 'category') {
    query = query.eq('category_id', filterValue);
  } else if (filterType === 'location') {
    query = query.eq('location_id', filterValue);
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`Error getting asset count for filter:`, error.message);
    throw error;
  }
  return count || 0;
};

// --- API Functions for Phone Line Dashboard ---
export const getPhoneLineStats = async (): Promise<{ totalLines: number; activeFaults: number }> => {
  const client = getSupabaseSafe();
  const { count: totalLines, error: totalError } = await client.from(TABLES.PHONE_LINES).select('*', { count: 'exact', head: true });
  if (totalError) throw totalError;

  const { count: activeFaults, error: faultError } = await client.from(TABLES.PHONE_LINES).select('*', { count: 'exact', head: true }).eq('has_active_fault', true);
  if (faultError) throw faultError;

  return { totalLines: totalLines || 0, activeFaults: activeFaults || 0 };
};

export const getPhoneLineCountByTags = async (tagIds: string[]): Promise<number> => {
  if (tagIds.length === 0) return 0;
  const client = getSupabaseSafe();
  
  const { data, error } = await client
      .from(TABLES.PHONE_LINE_TAGS)
      .select('phone_line_id')
      .in('tag_id', tagIds);

  if (error) throw error;
  
  const uniqueLineIds = new Set(data.map(item => item.phone_line_id));
  return uniqueLineIds.size;
};
