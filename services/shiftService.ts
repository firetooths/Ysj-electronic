
import { getSupabaseSafe } from './client';
import { ShiftRequest, ShiftRequestStatus, ShiftRequestType } from '../types';
import { TABLES } from '../constants';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineRead } from './offlineHandler';

export const getMyShiftRequests = async (userId: string): Promise<ShiftRequest[]> => {
    const offlineFallback = async () => {
        let all = await db.shift_requests.toArray();
        all = all.filter(r => r.requester_id === userId || r.provider_id === userId || r.supervisor_id === userId);
        all.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        return await Promise.all(all.map(async r => {
            const req = await db.users.get(r.requester_id);
            const prov = r.provider_id ? await db.users.get(r.provider_id) : null;
            const sup = await db.users.get(r.supervisor_id);
            return { ...r, requester: req, provider: prov, supervisor: sup };
        }));
    };

    return handleOfflineRead(TABLES.SHIFT_REQUESTS, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.SHIFT_REQUESTS).select('*, requester:requester_id(*), provider:provider_id(*), supervisor:supervisor_id(*)').or(`requester_id.eq.${userId},provider_id.eq.${userId},supervisor_id.eq.${userId}`).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }, offlineFallback);
};

export const createShiftRequest = async (request: any): Promise<ShiftRequest> => {
    let status = ShiftRequestStatus.PENDING_SUPERVISOR;
    if (request.request_type === ShiftRequestType.EXCHANGE) status = ShiftRequestStatus.PENDING_PROVIDER;
    
    const payload = { ...request, status, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    
    return handleOfflineInsert(TABLES.SHIFT_REQUESTS, payload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.SHIFT_REQUESTS).insert(payload).select().single();
        if (error) throw error;
        return data;
    });
};

export const updateShiftRequestStatus = async (id: string, status: ShiftRequestStatus): Promise<void> => {
    await handleOfflineUpdate(TABLES.SHIFT_REQUESTS, id, { status, updated_at: new Date().toISOString() }, async () => {
        const client = getSupabaseSafe();
        const { error } = await client.from(TABLES.SHIFT_REQUESTS).update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
    });
};

export const getShiftStats = async (userId: string) => {
    return handleOfflineRead('shift_stats_user_' + userId, 
        async () => {
            const client = getSupabaseSafe();
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            
            const { data: monthData } = await client.from(TABLES.SHIFT_REQUESTS).select('request_type, status').eq('requester_id', userId).eq('status', ShiftRequestStatus.APPROVED).gte('created_at', firstDayOfMonth);
            const { count: supplyMonth } = await client.from(TABLES.SHIFT_REQUESTS).select('*', { count: 'exact', head: true }).eq('provider_id', userId).eq('status', ShiftRequestStatus.APPROVED).gte('created_at', firstDayOfMonth);
            
            const stats = { month: { leave: 0, supply: 0, exchange: 0 }, year: { leave: 0, supply: 0, exchange: 0 } };
            monthData?.forEach(r => { 
                if (r.request_type === ShiftRequestType.LEAVE) stats.month.leave++;
                if (r.request_type === ShiftRequestType.EXCHANGE) stats.month.exchange++;
            });
            stats.month.supply = supplyMonth || 0;
            return stats;
        }, 
        async () => {
            // DEXIE FALLBACK: Calculate from local DB
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            
            const allReqs = await db.shift_requests.toArray();
            const stats = { month: { leave: 0, supply: 0, exchange: 0 }, year: { leave: 0, supply: 0, exchange: 0 } };

            allReqs.forEach(req => {
                if (req.status !== ShiftRequestStatus.APPROVED) return;
                const reqTime = new Date(req.created_at).getTime();

                if (reqTime >= firstDayOfMonth) {
                    if (req.requester_id === userId) {
                        if (req.request_type === ShiftRequestType.LEAVE) stats.month.leave++;
                        if (req.request_type === ShiftRequestType.EXCHANGE) stats.month.exchange++;
                    }
                    if (req.provider_id === userId) {
                        stats.month.supply++;
                    }
                }
            });
            return stats;
        }
    );
};

export const getAllApprovedShiftRequests = async (): Promise<ShiftRequest[]> => {
    return handleOfflineRead(TABLES.SHIFT_REQUESTS + '_approved',
        async () => {
            const client = getSupabaseSafe();
            const { data } = await client.from(TABLES.SHIFT_REQUESTS).select('*, requester:requester_id(*), provider:provider_id(*), supervisor:supervisor_id(*)').eq('status', ShiftRequestStatus.APPROVED);
            return data || [];
        },
        async () => {
            let all = await db.shift_requests.where('status').equals(ShiftRequestStatus.APPROVED).toArray();
            return await Promise.all(all.map(async r => {
                const req = await db.users.get(r.requester_id);
                const prov = r.provider_id ? await db.users.get(r.provider_id) : null;
                const sup = await db.users.get(r.supervisor_id);
                return { ...r, requester: req, provider: prov, supervisor: sup };
            }));
        }
    );
};
