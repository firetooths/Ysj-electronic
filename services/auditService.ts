import { getSupabaseSafe } from './client';
import { AuditLog } from '../types';
import { TABLES } from '../constants';

// --- API Functions for Audit Logs ---
export const getAuditLogsByAssetId = async (
  assetId: string,
): Promise<AuditLog[]> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.AUDIT_LOGS)
    .select('*')
    .eq('asset_id', assetId)
    .order('changed_at', { ascending: false });
  if (error) {
    console.error('Error fetching audit logs:', error.message);
    throw error;
  }
  return data || [];
};

export const logAuditAction = async (
  assetId: string,
  changeDescription: string,
  userId: string,
  fieldName: string | null = null,
  oldValue: string | null = null,
  newValue: string | null = null,
): Promise<AuditLog> => {
  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.AUDIT_LOGS)
    .insert({
      asset_id: assetId,
      change_description: changeDescription,
      user_id: userId,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
    })
    .select('*')
    .single();
  if (error) {
    console.error('Error logging audit action:', error.message);
    throw error;
  }
  return data;
};
