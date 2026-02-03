import { getSupabaseSafe } from './client';
import { PhoneLineLog } from '../types';
import { TABLES } from '../constants';

const getCurrentUserForLog = (): string => {
  try {
    const userStr = localStorage.getItem('user_data');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.full_name || user.username || 'کاربر ناشناس';
    }
  } catch (e) {
    console.error('Error getting user for log:', e);
  }
  return 'system';
};

export const logPhoneLineAction = async (phone_line_id: string, change_description: string): Promise<void> => {
  const client = getSupabaseSafe();
  const { error } = await client.from(TABLES.PHONE_LINE_LOGS).insert({
      phone_line_id,
      change_description,
      user_id: getCurrentUserForLog(),
  });
  if (error) {
      console.error("Failed to log phone line action:", error);
      // We don't throw here to not break the main operation
  }
};

export const getLogsByPhoneLineId = async (phoneLineId: string): Promise<PhoneLineLog[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.PHONE_LINE_LOGS).select('*').eq('phone_line_id', phoneLineId).order('changed_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getAllPhoneLineLogs = async (): Promise<PhoneLineLog[]> => {
    const client = getSupabaseSafe();
    // The `!inner` join ensures a single object is returned for the 'phone_line' relation.
    const { data, error } = await client.from(TABLES.PHONE_LINE_LOGS).select('*, phone_line:phone_line_id!inner(phone_number)').order('changed_at', { ascending: false });
    if (error) throw error;
    return data || [];
};