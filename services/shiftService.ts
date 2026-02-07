
import { getSupabaseSafe } from './client';
import { ShiftRequest, ShiftRequestStatus, ShiftRequestType } from '../types';
import { TABLES } from '../constants';

export const getMyShiftRequests = async (userId: string): Promise<ShiftRequest[]> => {
    const client = getSupabaseSafe();
    // FIX: Select * for relations to ensure phone_number and telegram_chat_id are included for notifications
    const { data, error } = await client
        .from(TABLES.SHIFT_REQUESTS)
        .select('*, requester:requester_id(*), provider:provider_id(*), supervisor:supervisor_id(*)')
        .or(`requester_id.eq.${userId},provider_id.eq.${userId},supervisor_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

// New function for Stats Page
export const getAllApprovedShiftRequests = async (): Promise<ShiftRequest[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.SHIFT_REQUESTS)
        .select('*, requester:requester_id(id, full_name, username), provider:provider_id(id, full_name, username)')
        .eq('status', ShiftRequestStatus.APPROVED);

    if (error) throw error;
    return data || [];
};

export const createShiftRequest = async (request: Omit<ShiftRequest, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<ShiftRequest> => {
    const client = getSupabaseSafe();
    
    // Determine initial status
    let status = ShiftRequestStatus.PENDING_SUPERVISOR;
    if (request.request_type === ShiftRequestType.EXCHANGE) {
        status = ShiftRequestStatus.PENDING_PROVIDER;
    }

    const { data, error } = await client
        .from(TABLES.SHIFT_REQUESTS)
        .insert({ ...request, status })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateShiftRequestStatus = async (id: string, status: ShiftRequestStatus): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client
        .from(TABLES.SHIFT_REQUESTS)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
};

export const getShiftStats = async (userId: string) => {
    const client = getSupabaseSafe();
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const { data: monthData } = await client
        .from(TABLES.SHIFT_REQUESTS)
        .select('request_type, status')
        .eq('requester_id', userId)
        .eq('status', ShiftRequestStatus.APPROVED)
        .gte('created_at', firstDayOfMonth);

    const { data: yearData } = await client
        .from(TABLES.SHIFT_REQUESTS)
        .select('request_type, status')
        .eq('requester_id', userId)
        .eq('status', ShiftRequestStatus.APPROVED)
        .gte('created_at', firstDayOfYear);

    const stats = {
        month: { leave: 0, supply: 0, exchange: 0 },
        year: { leave: 0, supply: 0, exchange: 0 }
    };

    monthData?.forEach(r => {
        if (r.request_type === ShiftRequestType.LEAVE) stats.month.leave++;
        // Supply means current user was a provider in an approved exchange
    });
    
    // Add logic for Supply (where user is Provider)
    const { count: supplyMonth } = await client
        .from(TABLES.SHIFT_REQUESTS)
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', userId)
        .eq('status', ShiftRequestStatus.APPROVED)
        .gte('created_at', firstDayOfMonth);
    
    stats.month.supply = supplyMonth || 0;

    return stats;
};
