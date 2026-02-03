
import { getSupabaseSafe } from './client';
import { CNSEquipment, CNSFaultReport, CNSActionLog, CNSFaultStatus, Asset } from '../types';
import { TABLES, STORAGE_BUCKETS } from '../constants';
import { processImageForUpload } from '../utils/imageProcessor';

// --- Equipment ---
export const getCNSEquipments = async (searchTerm: string = ''): Promise<CNSEquipment[]> => {
    const client = getSupabaseSafe();
    let query = client.from(TABLES.CNS_EQUIPMENT).select('*');
    
    if (searchTerm) {
        query = query.or(`name_cns.ilike.%${searchTerm}%,asset_number.ilike.%${searchTerm}%`);
    }
    
    const { data, error } = await query.order('name_cns');
    if (error) throw error;
    return data || [];
};

export const getCNSEquipmentById = async (id: string): Promise<CNSEquipment | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.CNS_EQUIPMENT).select('*').eq('id', id).single();
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
};

export const checkCNSEquipmentDuplicate = async (
    name: string, 
    assetNumber: string | null, 
    excludeId?: string
): Promise<boolean> => {
    const client = getSupabaseSafe();
    
    // Basic query matching the name exactly (case-insensitive usually preferred, but prompt said "exactly similar")
    let query = client.from(TABLES.CNS_EQUIPMENT)
        .select('id, name_cns, asset_number')
        .ilike('name_cns', name); // Using ilike for case-insensitive match, change to 'eq' for strict

    if (excludeId) {
        query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) return false;

    // Filter results based on asset number logic in JS for flexibility
    // Condition: Asset numbers match OR both are empty/null
    const isDuplicate = data.some(item => {
        const dbAsset = item.asset_number ? item.asset_number.trim() : '';
        const newAsset = assetNumber ? assetNumber.trim() : '';

        // Both empty/null
        if (!dbAsset && !newAsset) return true;
        
        // Both match
        if (dbAsset === newAsset) return true;

        return false;
    });

    return isDuplicate;
};

export const createCNSEquipment = async (equipment: Omit<CNSEquipment, 'id' | 'created_at' | 'updated_at'>): Promise<CNSEquipment> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.CNS_EQUIPMENT).insert(equipment).select().single();
    if (error) throw error;
    return data;
};

export const bulkCreateCNSEquipment = async (equipments: Omit<CNSEquipment, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> => {
    const client = getSupabaseSafe();
    if (equipments.length === 0) return;
    const { error } = await client.from(TABLES.CNS_EQUIPMENT).insert(equipments);
    if (error) throw error;
};

export const updateCNSEquipment = async (id: string, updates: Partial<CNSEquipment>): Promise<CNSEquipment> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.CNS_EQUIPMENT).update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteCNSEquipment = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.CNS_EQUIPMENT).delete().eq('id', id);
    if (error) throw error;
};

// --- Fault Reports ---
export const getCNSFaultReports = async (
    statusFilter: CNSFaultStatus | 'ALL' = 'ALL',
    searchTerm: string = ''
): Promise<CNSFaultReport[]> => {
    const client = getSupabaseSafe();
    let query = client.from(TABLES.CNS_FAULT_REPORTS).select('*, equipment:equipment_id(*)');
    
    if (statusFilter !== 'ALL') {
        if (statusFilter === CNSFaultStatus.CLOSED) {
            query = query.eq('status', CNSFaultStatus.CLOSED);
        } else {
            query = query.neq('status', CNSFaultStatus.CLOSED);
        }
    }
    
    const { data, error } = await query.order('start_time', { ascending: false });
    
    if (error) throw error;
    // Basic search filtering in JS if searchTerm is provided (since equipment name is joined)
    let results = data as CNSFaultReport[];
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        results = results.filter(r => 
            r.equipment?.name_cns.toLowerCase().includes(lowerTerm) ||
            r.fault_type.toLowerCase().includes(lowerTerm) ||
            r.equipment?.asset_number?.includes(lowerTerm)
        );
    }
    return results;
};

export const getFaultsByEquipmentId = async (equipmentId: string): Promise<CNSFaultReport[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.CNS_FAULT_REPORTS)
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('start_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
};

export const getCNSFaultById = async (id: string): Promise<CNSFaultReport | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.CNS_FAULT_REPORTS)
        .select('*, equipment:equipment_id(*), action_logs:cns_action_logs(*)')
        .eq('id', id)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    // Sort action logs
    if (data.action_logs) {
        data.action_logs.sort((a: any, b: any) => new Date(b.action_time).getTime() - new Date(a.action_time).getTime());
    }
    return data as CNSFaultReport;
};

export const createCNSFaultReport = async (
    report: Omit<CNSFaultReport, 'id' | 'created_at' | 'updated_at' | 'action_logs' | 'image_urls'>,
    audioBlob: Blob | null,
    images: File[] = []
): Promise<CNSFaultReport> => {
    const client = getSupabaseSafe();
    
    // 1. Insert report basic data first to get ID
    const { data: fault, error } = await client.from(TABLES.CNS_FAULT_REPORTS).insert({
        ...report,
        image_urls: [] // Will update later
    }).select().single();
    if (error) throw error;
    
    // 2. Process and Upload Images
    const imageUrls: string[] = [];
    for (const img of images) {
        try {
            const compressedBlob = await processImageForUpload(img, 800);
            const filePath = `cns/${fault.id}/fault_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpeg`;
            const { error: upErr } = await client.storage
                .from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments')
                .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: false });
            
            if (!upErr) {
                const { data: publicUrlData } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments').getPublicUrl(filePath);
                imageUrls.push(publicUrlData.publicUrl);
            }
        } catch (e) {
            console.error("Image processing failed", e);
        }
    }

    // Update the report with image URLs
    if (imageUrls.length > 0) {
        await client.from(TABLES.CNS_FAULT_REPORTS).update({ image_urls: imageUrls }).eq('id', fault.id);
    }
    
    // 3. Create Initial Action Log
    let audioUrl = null;
    if (audioBlob) {
        const filePath = `cns/${fault.id}/initial_audio_${Date.now()}.m4a`;
        const { error: uploadError } = await client.storage
            .from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments')
            .upload(filePath, audioBlob, { contentType: 'audio/mp4', upsert: false });
        
        if (!uploadError) {
            const { data: publicUrlData } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments').getPublicUrl(filePath);
            audioUrl = publicUrlData.publicUrl;
        }
    }
    
    await client.from(TABLES.CNS_ACTION_LOGS).insert({
        report_id: fault.id,
        action_user: report.reporter_user,
        action_description: `ثبت گزارش اولیه: ${report.description}`,
        audio_url: audioUrl,
        status_change: 'ایجاد شد'
    });
    
    return fault;
};

export const updateCNSFaultStatus = async (id: string, status: CNSFaultStatus, reason: string = ''): Promise<CNSFaultReport> => {
    const client = getSupabaseSafe();
    
    const updates: any = { 
        status: status,
        updated_at: new Date().toISOString()
    };

    if (status === CNSFaultStatus.CLOSED) {
        updates.close_time = new Date().toISOString();
    } else {
        updates.close_time = null; // Clear close_time if reopening or in progress
        if (status === CNSFaultStatus.REOPENED) {
            updates.reopen_reason = reason;
        }
    }
    
    // Explicitly select all columns or at least the ID to confirm update
    const { data, error } = await client
        .from(TABLES.CNS_FAULT_REPORTS)
        .update(updates)
        .eq('id', id)
        .select('*') 
        .single();

    if (error) {
        throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
    }

    return data;
};

export const deleteCNSFaultReport = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    // Delete action logs first
    await client.from(TABLES.CNS_ACTION_LOGS).delete().eq('report_id', id);
    // Delete the report
    const { error } = await client.from(TABLES.CNS_FAULT_REPORTS).delete().eq('id', id);
    if (error) throw error;
};

// --- Action Logs ---
export const addCNSActionLog = async (
    log: Omit<CNSActionLog, 'id' | 'created_at' | 'action_time'>,
    audioBlob: Blob | null,
    images: File[]
): Promise<CNSActionLog> => {
    const client = getSupabaseSafe();
    
    let audioUrl = null;
    if (audioBlob) {
        const filePath = `cns/${log.report_id}/action_audio_${Date.now()}.m4a`;
        const { error: uploadError } = await client.storage
             .from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments')
             .upload(filePath, audioBlob, { contentType: 'audio/mp4', upsert: false });
        if (!uploadError) {
             const { data } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments').getPublicUrl(filePath);
             audioUrl = data.publicUrl;
        }
    }
    
    const imageUrls: string[] = [];
    for (const img of images) {
         try {
             const compressedBlob = await processImageForUpload(img, 800);
             const filePath = `cns/${log.report_id}/action_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpeg`;
             const { error: upErr } = await client.storage
                 .from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments')
                 .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: false });
             if (!upErr) {
                 const { data } = client.storage.from(STORAGE_BUCKETS.CNS_ATTACHMENTS || 'cns_attachments').getPublicUrl(filePath);
                 imageUrls.push(data.publicUrl);
             }
         } catch (e) {
             console.error("Image processing failed in action log", e);
         }
    }
    
    const { data, error } = await client.from(TABLES.CNS_ACTION_LOGS).insert({
        ...log,
        audio_url: audioUrl,
        image_urls: imageUrls
    }).select().single();
    
    if (error) throw error;
    return data;
};

// --- Helper ---
export const searchAssetsForCNS = async (term: string): Promise<Asset[]> => {
    const client = getSupabaseSafe();
    if (term.length < 2) return [];
    
    let query = client.from(TABLES.ASSETS).select('*');

    // Simplified search assuming asset_id_number is now text
    query = query.or(`asset_id_number.ilike.%${term}%,name.ilike.%${term}%`);
    
    const { data, error } = await query.limit(10);
        
    if (error) return [];
    return data as Asset[];
};
