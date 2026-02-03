
import { getSupabaseSafe } from './client';
import { Node, NodeConfig, NodeType } from '../types';
import { TABLES, STORAGE_BUCKETS } from '../constants';
import { processImageForUpload } from '../utils/imageProcessor';
import { db } from '../db';

// --- API Functions for Phone Line Nodes ---
export const getNodes = async (): Promise<Node[]> => {
    try {
        if (!navigator.onLine) throw new Error('Offline');
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.NODES).select('*').order('name');
        if (error) throw error;
        return data as Node[];
    } catch (error) {
        // Offline
        console.warn('Fetching nodes from local DB');
        return await db.nodes.orderBy('name').toArray() as Node[];
    }
};

export const createNode = async (node: Omit<Node, 'id' | 'created_at'>): Promise<Node> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.NODES).insert(node).select().single();
    if (error) throw error;
    return data as Node;
};

export const updateNode = async (id: string, updates: Partial<Omit<Node, 'id' | 'created_at'>>): Promise<Node> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.NODES).update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Node;
};

export const deleteNode = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.NODES).delete().eq('id', id);
    if (error) throw error;
};

export const getNodeUsageCount = async (id: string): Promise<number> => {
  try {
      if (!navigator.onLine) throw new Error('Offline');
      const client = getSupabaseSafe();
      const { count, error } = await client.from(TABLES.ROUTE_NODES).select('id', { count: 'exact', head: true }).eq('node_id', id);
      if (error) throw error;
      return count || 0;
  } catch (e) {
      return await db.route_nodes.where('node_id').equals(id).count();
  }
};

export const getNodeStats = async (node: Node): Promise<{ total: number, used: number, free: number, lastActivity: { date: string, port: string } | null }> => {
    // 1. Calculate Total Ports
    let total = 0;
    const c = node.config;
    switch(node.type) {
        case NodeType.MDF:
            total = (c.sets || 0) * (c.terminalsPerSet || 0) * (c.portsPerTerminal || 10);
            break;
        case NodeType.SLOT_DEVICE:
            total = (c.slots || 0) * (c.portsPerSlot || 0);
            break;
        case NodeType.CONVERTER:
        case NodeType.SOCKET:
            total = c.ports || 0;
            break;
    }

    let used = 0;
    let lastActivity = null;

    try {
        if (!navigator.onLine) throw new Error('Offline');
        const client = getSupabaseSafe();

        // 2. Get Used Ports
        const { count, error } = await client.from(TABLES.ROUTE_NODES).select('id', { count: 'exact', head: true }).eq('node_id', node.id);
        if (error) throw error;
        used = count || 0;

        // 3. Get Last Activity
        const { data: recentNode, error: recentError } = await client
            .from(TABLES.ROUTE_NODES)
            .select('port_address, phone_line:line_id(updated_at)')
            .eq('node_id', node.id)
            .limit(50); // Fetch a batch
            
        if (!recentError && recentNode && recentNode.length > 0) {
            const validNodes = recentNode.filter((n: any) => n.phone_line?.updated_at);
            validNodes.sort((a: any, b: any) => new Date(b.phone_line.updated_at).getTime() - new Date(a.phone_line.updated_at).getTime());
            
            if (validNodes.length > 0) {
                lastActivity = {
                    date: validNodes[0].phone_line.updated_at,
                    port: validNodes[0].port_address
                };
            }
        }
    } catch (e) {
        // Offline logic
        used = await db.route_nodes.where('node_id').equals(node.id).count();
        
        // Approximation for last activity since we can't join easily in Dexie to sort by phone_line.updated_at
        // We'll just check some entries if needed, but for now skip complex lastActivity in offline mode or keep null
    }

    return {
        total,
        used,
        free: total - used,
        lastActivity
    };
};

export const updateNodeConfig = async (id: string, newConfig: NodeConfig): Promise<Node> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.NODES).update({ config: newConfig }).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const uploadNodeImage = async (nodeId: string, file: File): Promise<string> => {
    const client = getSupabaseSafe();
    const processedBlob = await processImageForUpload(file, 800);
    const filePath = `nodes/${nodeId}/img_${Date.now()}.jpeg`;
    
    // Reuse asset bucket for simplicity
    const bucket = STORAGE_BUCKETS.ASSET_IMAGES; 
    
    const { error } = await client.storage
        .from(bucket)
        .upload(filePath, processedBlob, { contentType: 'image/jpeg', upsert: false });
    
    if (error) throw error;
    
    const { data } = client.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
};
