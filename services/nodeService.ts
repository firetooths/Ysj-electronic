
import { getSupabaseSafe } from './client';
import { Node, NodeConfig, NodeType } from '../types';
import { TABLES, STORAGE_BUCKETS } from '../constants';
import { processImageForUpload } from '../utils/imageProcessor';
import { CACHE_KEYS, queryLocalData } from './offlineService';

// --- API Functions for Phone Line Nodes ---
export const getNodes = async (): Promise<Node[]> => {
    if (!navigator.onLine) {
        const { data } = queryLocalData<Node>(CACHE_KEYS.NODES, () => true, 1, 9999, (a, b) => a.name.localeCompare(b.name));
        return data;
    }

    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.NODES).select('*').order('name');
    if (error) throw error;
    return data as Node[];
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
  const client = getSupabaseSafe();
  const { count, error } = await client.from(TABLES.ROUTE_NODES).select('id', { count: 'exact', head: true }).eq('node_id', id);
  if (error) throw error;
  return count || 0;
};

export const getNodeStats = async (node: Node): Promise<{ total: number, used: number, free: number, lastActivity: { date: string, port: string } | null }> => {
    const client = getSupabaseSafe();
    
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

    // 2. Get Used Ports
    const { count, error } = await client.from(TABLES.ROUTE_NODES).select('id', { count: 'exact', head: true }).eq('node_id', node.id);
    if (error) throw error;
    const used = count || 0;

    // 3. Get Last Activity
    // We try to find the most recently updated phone line connected to this node
    let lastActivity = null;
    const { data: recentNode, error: recentError } = await client
        .from(TABLES.ROUTE_NODES)
        .select('port_address, phone_line:line_id(updated_at)')
        .eq('node_id', node.id)
        // We can't sort by phone_line.updated_at directly easily in simple join without complex query
        // So we just fetch some and sort in JS or use another approach.
        // Better: Query route_nodes, fetch associated lines, sort. 
        // OR: Assume created_at of route_node is close enough? RouteNodes don't have created_at usually.
        // Let's rely on PhoneLine updated_at.
        .limit(50); // Fetch a batch
        
    if (!recentError && recentNode && recentNode.length > 0) {
        // Filter and sort
        const validNodes = recentNode.filter((n: any) => n.phone_line?.updated_at);
        validNodes.sort((a: any, b: any) => new Date(b.phone_line.updated_at).getTime() - new Date(a.phone_line.updated_at).getTime());
        
        if (validNodes.length > 0) {
            lastActivity = {
                date: validNodes[0].phone_line.updated_at,
                port: validNodes[0].port_address
            };
        }
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
