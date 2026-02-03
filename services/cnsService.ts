
import { getSupabaseSafe } from './client';
import { CNSEquipment, CNSFaultReport, CNSActionLog, CNSFaultStatus, Asset } from '../types';
import { TABLES, STORAGE_BUCKETS } from '../constants';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineDelete, handleOfflineRead } from './offlineHandler';

export const getCNSEquipments = async (searchTerm: string = ''): Promise<CNSEquipment[]> => {
    return handleOfflineRead(TABLES.CNS_EQUIPMENT,
        async () => {
            const client = getSupabaseSafe();
            let query = client.from(TABLES.CNS_EQUIPMENT).select('*');
            if (searchTerm) query = query.or(`name_cns.ilike.%${searchTerm}%,asset_number.ilike.%${searchTerm}%`);
            const { data, error } = await query.order('name_cns');
            if (error) throw error;
            return data || [];
        },
        async () => {
            let data = await db.cns_equipment.orderBy('name_cns').toArray();
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                data = data.filter(e => e.name_cns.toLowerCase().includes(lower) || (e.asset_number && e.asset_number.includes(lower)));
            }
            return data as CNSEquipment[];
        }
    );
};

export const getCNSEquipmentById = async (id: string) => handleOfflineRead(TABLES.CNS_EQUIPMENT, async () => (await getSupabaseSafe().from(TABLES.CNS_EQUIPMENT).select('*').eq('id', id).single()).data, async () => db.cns_equipment.get(id));

export const createCNSEquipment = async (equipment: any): Promise<CNSEquipment> => {
    const payload = { ...equipment, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    return handleOfflineInsert(TABLES.CNS_EQUIPMENT, payload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.CNS_EQUIPMENT).insert(payload).select().single();
        if (error) throw error;
        return data;
    });
};

export const updateCNSEquipment = async (id: string, updates: any) => handleOfflineUpdate(TABLES.CNS_EQUIPMENT, id, updates, async () => (await getSupabaseSafe().from(TABLES.CNS_EQUIPMENT).update(updates).eq('id', id).select().single()).data);
export const deleteCNSEquipment = async (id: string) => handleOfflineDelete(TABLES.CNS_EQUIPMENT, id, async () => (await getSupabaseSafe().from(TABLES.CNS_EQUIPMENT).delete().eq('id', id)));

export const searchAssetsForCNS = async (term: string): Promise<Asset[]> => {
    return handleOfflineRead(TABLES.ASSETS, 
        async () => {
            const client = getSupabaseSafe();
            const { data } = await client.from(TABLES.ASSETS).select('*, location:location_id(*)').or(`name.ilike.%${term}%,asset_id_number.ilike.%${term}%`).limit(10);
            return data || [];
        },
        async () => {
            const lower = term.toLowerCase();
            const assets = await db.assets.filter(a => a.name.toLowerCase().includes(lower) || String(a.asset_id_number).includes(lower)).limit(10).toArray();
            return assets as Asset[];
        }
    );
};

export const checkCNSEquipmentDuplicate = async (name: string, assetNumber: string | null, excludeId?: string): Promise<boolean> => {
    return handleOfflineRead('cns_dup_check',
        async () => {
            const client = getSupabaseSafe();
            let query = client.from(TABLES.CNS_EQUIPMENT).select('id');
            if (assetNumber) {
                query = query.eq('name_cns', name).eq('asset_number', assetNumber);
            } else {
                query = query.eq('name_cns', name);
            }
            if (excludeId) query = query.neq('id', excludeId);
            const { data } = await query.limit(1);
            return (data && data.length > 0);
        },
        async () => {
            // Dexie filtering
            const found = await db.cns_equipment.filter(e => {
                const nameMatch = e.name_cns === name;
                const assetMatch = assetNumber ? e.asset_number === assetNumber : true;
                const idMatch = excludeId ? e.id !== excludeId : true;
                return nameMatch && assetMatch && idMatch;
            }).first();
            return !!found;
        }
    );
};

export const getCNSFaultReports = async (statusFilter: CNSFaultStatus | 'ALL' = 'ALL', searchTerm: string = ''): Promise<CNSFaultReport[]> => {
    const offlineFallback = async () => {
        let all = await db.cns_fault_reports.toArray();
        // Manual Join Equipment
        all = await Promise.all(all.map(async (f) => {
            const eq = await db.cns_equipment.get(f.equipment_id);
            return { ...f, equipment: eq };
        }));
        
        if (statusFilter !== 'ALL') {
            if (statusFilter === CNSFaultStatus.CLOSED) all = all.filter(f => f.status === CNSFaultStatus.CLOSED);
            else all = all.filter(f => f.status !== CNSFaultStatus.CLOSED);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            all = all.filter(f => f.equipment?.name_cns.toLowerCase().includes(lower) || f.fault_type.toLowerCase().includes(lower));
        }
        return all.sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    };

    return handleOfflineRead(TABLES.CNS_FAULT_REPORTS, async () => {
        const client = getSupabaseSafe();
        let query = client.from(TABLES.CNS_FAULT_REPORTS).select('*, equipment:equipment_id(*)');
        if (statusFilter !== 'ALL') {
            if (statusFilter === CNSFaultStatus.CLOSED) query = query.eq('status', CNSFaultStatus.CLOSED);
            else query = query.neq('status', CNSFaultStatus.CLOSED);
        }
        const { data, error } = await query.order('start_time', { ascending: false });
        if (error) throw error;
        let results = data as CNSFaultReport[];
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            results = results.filter(r => r.equipment?.name_cns.toLowerCase().includes(lowerTerm) || r.fault_type.toLowerCase().includes(lowerTerm));
        }
        return results;
    }, offlineFallback);
};

export const getCNSFaultById = async (id: string): Promise<CNSFaultReport | null> => {
    return handleOfflineRead(TABLES.CNS_FAULT_REPORTS,
        async () => {
            const client = getSupabaseSafe();
            const { data } = await client.from(TABLES.CNS_FAULT_REPORTS).select('*, equipment:equipment_id(*), action_logs:cns_action_logs(*)').eq('id', id).single();
            if (data?.action_logs) data.action_logs.sort((a: any, b: any) => new Date(b.action_time).getTime() - new Date(a.action_time).getTime());
            return data;
        },
        async () => {
            const f = await db.cns_fault_reports.get(id);
            if (!f) return null;
            f.equipment = await db.cns_equipment.get(f.equipment_id);
            f.action_logs = await db.cns_action_logs.where('report_id').equals(id).reverse().sortBy('action_time');
            return f;
        }
    );
};

export const createCNSFaultReport = async (report: any, audioBlob: Blob | null, images: File[] = []): Promise<CNSFaultReport> => {
    // 1. Create Report Offline
    const payload = { ...report, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), image_urls: [] };
    const fault = await handleOfflineInsert<CNSFaultReport>(TABLES.CNS_FAULT_REPORTS, payload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.CNS_FAULT_REPORTS).insert(payload).select().single();
        if (error) throw error;
        return data;
    });
    
    // 2. Add Initial Action Log
    const logPayload = {
        report_id: fault.id,
        action_user: report.reporter_user,
        action_description: `ثبت گزارش اولیه: ${report.description}`,
        status_change: 'ایجاد شد',
        action_time: new Date().toISOString(),
        created_at: new Date().toISOString()
    };
    await handleOfflineInsert(TABLES.CNS_ACTION_LOGS, logPayload, async () => {
        const client = getSupabaseSafe();
        await client.from(TABLES.CNS_ACTION_LOGS).insert(logPayload);
    });

    return fault;
};

export const deleteCNSFaultReport = async (id: string) => handleOfflineDelete(TABLES.CNS_FAULT_REPORTS, id, async () => (await getSupabaseSafe().from(TABLES.CNS_FAULT_REPORTS).delete().eq('id', id)));

export const addCNSActionLog = async (log: any, audioBlob: Blob | null, images: File[]) => {
    const payload = { ...log, id: undefined, created_at: new Date().toISOString() }; 
    await handleOfflineInsert(TABLES.CNS_ACTION_LOGS, payload, async () => {
        const client = getSupabaseSafe();
        await client.from(TABLES.CNS_ACTION_LOGS).insert(payload);
    });
};

export const updateCNSFaultStatus = async (id: string, status: string, reopenReason: string | null = null) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === CNSFaultStatus.CLOSED) updates.close_time = new Date().toISOString();
    if (reopenReason) updates.reopen_reason = reopenReason;
    
    await handleOfflineUpdate(TABLES.CNS_FAULT_REPORTS, id, updates, async () => {
        await getSupabaseSafe().from(TABLES.CNS_FAULT_REPORTS).update(updates).eq('id', id);
    });
};

export const getFaultsByEquipmentId = async (id: string): Promise<CNSFaultReport[]> => {
    return handleOfflineRead(TABLES.CNS_FAULT_REPORTS,
        async () => {
            const client = getSupabaseSafe();
            const { data } = await client.from(TABLES.CNS_FAULT_REPORTS).select('*').eq('equipment_id', id).order('start_time', { ascending: false });
            return data || [];
        },
        async () => db.cns_fault_reports.where('equipment_id').equals(id).reverse().sortBy('start_time')
    );
};

export const bulkCreateCNSEquipment = async (equipments: any[]) => {
    for (const eq of equipments) {
        await createCNSEquipment(eq);
    }
};
