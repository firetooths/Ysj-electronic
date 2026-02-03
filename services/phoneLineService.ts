
import { getSupabaseSafe } from './client';
import { PhoneLine, RouteNode, Node, Tag, BulkPhoneLine } from '../types';
import { TABLES } from '../constants';
import { logPhoneLineAction } from './phoneLogService';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineDelete, handleOfflineRead, generateUUID } from './offlineHandler';

export const getPhoneLines = async (page: number, pageSize: number, searchTerm: string = '', tagIds: string[] = []): Promise<{ lines: PhoneLine[], total: number }> => {
    try {
        if (!navigator.onLine) throw new Error('Offline');
        const client = getSupabaseSafe();
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let lineIdsFromTags: string[] | null = null;
        if (tagIds.length > 0) {
            const { data: lineTagData, error: tagFilterError } = await client.from(TABLES.PHONE_LINE_TAGS).select('phone_line_id').in('tag_id', tagIds);
            if (tagFilterError) throw tagFilterError;
            lineIdsFromTags = lineTagData ? [...new Set((lineTagData as any[]).map((d: any) => d.phone_line_id))] : [];
            if (lineIdsFromTags.length === 0) return { lines: [], total: 0 };
        }
        let query = client.from(TABLES.PHONE_LINES).select('*, tags(*)', { count: 'exact' });
        if (searchTerm.length >= 3) query = query.or(`phone_number.ilike.%${searchTerm}%,consumer_unit.ilike.%${searchTerm}%`);
        if (lineIdsFromTags !== null) query = query.in('id', lineIdsFromTags);
        const { data, error, count } = await query.order('phone_number').range(from, to);
        if (error) throw error;
        return { lines: data as PhoneLine[], total: count || 0 };
    } catch (error) {
        let collection = db.phone_lines.toCollection();
        if (searchTerm.length >= 3) {
            const lowerTerm = searchTerm.toLowerCase();
            collection = collection.filter(l => l.phone_number.includes(lowerTerm) || (l.consumer_unit && l.consumer_unit.toLowerCase().includes(lowerTerm)));
        }
        const count = await collection.count();
        const data = await collection.offset((page - 1) * pageSize).limit(pageSize).toArray();
        const linesWithTags = await Promise.all(data.map(async (line) => {
            const lineTagsRel = await db.phone_line_tags.where('phone_line_id').equals(line.id).toArray();
            const tags = await db.tags.where('id').anyOf(lineTagsRel.map(r => r.tag_id)).toArray();
            return { ...line, tags };
        }));
        return { lines: linesWithTags as PhoneLine[], total: count };
    }
};

export const getPhoneLinesByTagId = async (tagId: string): Promise<PhoneLine[]> => {
    return handleOfflineRead(TABLES.PHONE_LINES, 
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.PHONE_LINES).select('*, route_nodes(*, node:nodes(*)), phone_line_tags!inner(tag_id)').eq('phone_line_tags.tag_id', tagId).order('phone_number');
            if (error) throw error;
            const lines = data as PhoneLine[];
            lines.forEach(line => { if (line.route_nodes) line.route_nodes.sort((a, b) => a.sequence - b.sequence); });
            return lines;
        },
        async () => {
            const lineTags = await db.phone_line_tags.where('tag_id').equals(tagId).toArray();
            const lines = await db.phone_lines.where('id').anyOf(lineTags.map(lt => lt.phone_line_id)).toArray();
            const enriched = await Promise.all(lines.map(async (line) => {
                const routeNodes = await db.route_nodes.where('line_id').equals(line.id).toArray();
                const enrichedNodes = await Promise.all(routeNodes.map(async (rn) => {
                    const node = await db.nodes.get(rn.node_id);
                    return { ...rn, node };
                }));
                enrichedNodes.sort((a, b) => a.sequence - b.sequence);
                return { ...line, route_nodes: enrichedNodes };
            }));
            return enriched as PhoneLine[];
        }
    );
};

export const getPhoneLineById = async (id: string): Promise<PhoneLine | null> => {
    return handleOfflineRead(TABLES.PHONE_LINES,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.PHONE_LINES).select('*, route_nodes:route_nodes(*, node:nodes(*)), tags(*)').eq('id', id).single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data?.route_nodes) data.route_nodes.sort((a: any, b: any) => a.sequence - b.sequence);
            return data as PhoneLine;
        },
        async () => {
            const line = await db.phone_lines.get(id);
            if (!line) return null;
            const routeNodes = await db.route_nodes.where('line_id').equals(id).toArray();
            const enrichedNodes = await Promise.all(routeNodes.map(async (rn) => {
                const node = await db.nodes.get(rn.node_id);
                return { ...rn, node };
            }));
            enrichedNodes.sort((a, b) => a.sequence - b.sequence);
            const lineTagsRel = await db.phone_line_tags.where('phone_line_id').equals(id).toArray();
            const tags = await db.tags.where('id').anyOf(lineTagsRel.map(r => r.tag_id)).toArray();
            return { ...line, route_nodes: enrichedNodes, tags } as PhoneLine;
        }
    );
};

export const getPhoneLineByNumber = async (phoneNumber: string): Promise<PhoneLine | null> => {
    return handleOfflineRead(TABLES.PHONE_LINES,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.PHONE_LINES).select('*, route_nodes:route_nodes(*, node:nodes(*)), tags(*)').eq('phone_number', phoneNumber).single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data?.route_nodes) data.route_nodes.sort((a: any, b: any) => a.sequence - b.sequence);
            return data as PhoneLine;
        },
        async () => {
            const line = await db.phone_lines.where('phone_number').equals(phoneNumber).first();
            if (!line) return null;
            const routeNodes = await db.route_nodes.where('line_id').equals(line.id).toArray();
            const enrichedNodes = await Promise.all(routeNodes.map(async (rn) => {
                const node = await db.nodes.get(rn.node_id);
                return { ...rn, node };
            }));
            enrichedNodes.sort((a, b) => a.sequence - b.sequence);
            const lineTagsRel = await db.phone_line_tags.where('phone_line_id').equals(line.id).toArray();
            const tags = await db.tags.where('id').anyOf(lineTagsRel.map(r => r.tag_id)).toArray();
            return { ...line, route_nodes: enrichedNodes, tags } as PhoneLine;
        }
    );
};

export const deleteRouteNodes = async (routeNodeIds: string[]): Promise<void> => {
    if (routeNodeIds.length === 0) return;
    for (const id of routeNodeIds) {
        await handleOfflineDelete(TABLES.ROUTE_NODES, id, async () => {
            const client = getSupabaseSafe();
            const { error } = await client.from(TABLES.ROUTE_NODES).delete().eq('id', id);
            if (error) throw error;
        });
    }
};

export const createPhoneLine = async (
    lineData: Omit<PhoneLine, 'id' | 'created_at' | 'has_active_fault' | 'tags'>, 
    routeNodesData: Omit<RouteNode, 'id' | 'line_id'>[],
    tagIds: string[],
    conflictingRouteNodeIdsToDelete: string[] = [],
    allTags: Tag[] // Keeping signature for compatibility but it is unused
): Promise<PhoneLine> => {
    
    if (conflictingRouteNodeIdsToDelete.length > 0) {
        await deleteRouteNodes(conflictingRouteNodeIdsToDelete);
    }

    // 1. Create Line
    const linePayload = { ...lineData, created_at: new Date().toISOString(), has_active_fault: false };
    const line = await handleOfflineInsert<PhoneLine>(TABLES.PHONE_LINES, linePayload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.PHONE_LINES).insert(lineData).select().single();
        if (error) throw error;
        return data;
    });

    // 2. Create Route Nodes
    const routeNodesToInsert = routeNodesData.map(node => ({ ...node, line_id: line.id }));
    for (const rn of routeNodesToInsert) {
        await handleOfflineInsert(TABLES.ROUTE_NODES, rn, async () => {
            const client = getSupabaseSafe();
            const { error } = await client.from(TABLES.ROUTE_NODES).insert(rn);
            if (error) throw error;
            return rn;
        });
    }

    // 3. Create Tags
    if (tagIds.length > 0) {
        const phoneLineTags = tagIds.map(tag_id => ({ phone_line_id: line.id, tag_id }));
        for (const pt of phoneLineTags) {
             await handleOfflineInsert(TABLES.PHONE_LINE_TAGS, pt, async () => {
                const client = getSupabaseSafe();
                const { error } = await client.from(TABLES.PHONE_LINE_TAGS).insert(pt);
                if (error) throw error;
                return pt;
             });
        }
    }

    logPhoneLineAction(line.id, `ایجاد خط تلفن (آفلاین/آنلاین)`);
    return line;
};

export const updatePhoneLine = async (
    lineId: string, 
    lineData: Partial<Omit<PhoneLine, 'id' | 'created_at' | 'has_active_fault' | 'tags'>>, 
    routeNodesData: Omit<RouteNode, 'id' | 'line_id'>[],
    tagIds: string[],
    conflictingRouteNodeIdsToDelete: string[] = [],
    allNodes: Node[],
    allTags: Tag[]
): Promise<PhoneLine> => {
    
    if (conflictingRouteNodeIdsToDelete.length > 0) {
        await deleteRouteNodes(conflictingRouteNodeIdsToDelete);
    }

    const line = await handleOfflineUpdate<PhoneLine>(TABLES.PHONE_LINES, lineId, lineData, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.PHONE_LINES).update(lineData).eq('id', lineId).select().single();
        if (error) throw error;
        return data;
    });

    // Update Route Nodes
    const oldRouteNodes = await db.route_nodes.where('line_id').equals(lineId).toArray();
    await deleteRouteNodes(oldRouteNodes.map(rn => rn.id));

    const routeNodesToInsert = routeNodesData.map(node => ({ ...node, line_id: lineId }));
    for (const rn of routeNodesToInsert) {
        await handleOfflineInsert(TABLES.ROUTE_NODES, rn, async () => {
             const client = getSupabaseSafe();
             await client.from(TABLES.ROUTE_NODES).insert(rn);
             return rn;
        });
    }
    
    // Update Tags: Simplified to insert-only for offline best effort to avoid complex delete sync
    if (tagIds.length > 0) {
        const phoneLineTags = tagIds.map(tag_id => ({ phone_line_id: lineId, tag_id }));
        for (const pt of phoneLineTags) {
             await handleOfflineInsert(TABLES.PHONE_LINE_TAGS, pt, async () => {
                 const client = getSupabaseSafe();
                 await client.from(TABLES.PHONE_LINE_TAGS).delete().eq('phone_line_id', lineId);
                 const { error } = await client.from(TABLES.PHONE_LINE_TAGS).insert(phoneLineTags); 
                 if (error) throw error;
                 return pt; 
             }).catch(e => console.warn("Tag update offline error", e));
             if (navigator.onLine) break;
        }
    }

    logPhoneLineAction(lineId, "ویرایش خط (حالت آفلاین/آنلاین)");
    return line;
};

export const deletePhoneLine = async (id: string): Promise<void> => {
    await handleOfflineDelete(TABLES.PHONE_LINES, id, async () => {
        const client = getSupabaseSafe();
        const { error } = await client.from(TABLES.PHONE_LINES).delete().eq('id', id);
        if (error) throw error;
    });
    logPhoneLineAction(id, "حذف خط");
};

export const checkPortInUse = async (nodeId: string, portAddress: string, excludeLineId?: string) => {
    return handleOfflineRead(TABLES.ROUTE_NODES,
        async () => {
            const client = getSupabaseSafe();
            let query = client.from(TABLES.ROUTE_NODES).select('id, line_id, phone_line:line_id(phone_number)').eq('node_id', nodeId).eq('port_address', portAddress);
            if (excludeLineId) query = query.neq('line_id', excludeLineId);
            const { data, error } = await query.maybeSingle();
            if (error) throw error;
            if (data) return { inUse: true, phoneNumber: (data.phone_line as any)?.phone_number, routeNodeId: data.id };
            return { inUse: false };
        },
        async () => {
            const conflict = await db.route_nodes.where('node_id').equals(nodeId).and(rn => rn.port_address === portAddress && rn.line_id !== excludeLineId).first();
            if (conflict) {
                const line = await db.phone_lines.get(conflict.line_id);
                return { inUse: true, phoneNumber: line?.phone_number || 'نامشخص', routeNodeId: conflict.id };
            }
            return { inUse: false };
        }
    );
};

export const getLinesForNode = async (nodeId: string): Promise<RouteNode[]> => {
    return handleOfflineRead(TABLES.ROUTE_NODES,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.ROUTE_NODES).select('*, phone_line:line_id(*)').eq('node_id', nodeId);
            if (error) throw error;
            return data || [];
        },
        async () => {
            const routeNodes = await db.route_nodes.where('node_id').equals(nodeId).toArray();
            const enriched = await Promise.all(routeNodes.map(async (rn) => {
                const line = await db.phone_lines.get(rn.line_id);
                return { ...rn, phone_line: line };
            }));
            return enriched as RouteNode[];
        }
    );
};

export const getPhoneLineDetailsByNumber = async (phoneNumber: string): Promise<Pick<PhoneLine, 'id' | 'phone_number' | 'consumer_unit'> | null> => {
    return handleOfflineRead(TABLES.PHONE_LINES,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.PHONE_LINES).select('id, phone_number, consumer_unit').eq('phone_number', phoneNumber).maybeSingle();
            if (error) throw error;
            return data;
        },
        async () => {
            const line = await db.phone_lines.where('phone_number').equals(phoneNumber).first();
            return line ? { id: line.id, phone_number: line.phone_number, consumer_unit: line.consumer_unit } : null;
        }
    );
};

export const batchUpdatePortAssignments = async (
    deletions: string[], 
    creations: Array<{ phoneNumber: string; consumerUnit: string | null; nodeId: string; portAddress: string; }>,
    node: Node
) => {
    await deleteRouteNodes(deletions);

    for (const creation of creations) {
        const existingLine = await getPhoneLineByNumber(creation.phoneNumber);
        let lineId = existingLine?.id;

        if (!lineId) {
            const newLine = await createPhoneLine({ phone_number: creation.phoneNumber, consumer_unit: creation.consumerUnit }, [], [], [], []);
            lineId = newLine.id;
        } else {
            await updatePhoneLine(lineId, { consumer_unit: creation.consumerUnit }, [], [], [], [], []);
        }

        await handleOfflineInsert(TABLES.ROUTE_NODES, {
            line_id: lineId,
            node_id: creation.nodeId,
            port_address: creation.portAddress,
            sequence: 1, 
            wire_1_color_name: null,
            wire_2_color_name: null
        }, async () => {
             const client = getSupabaseSafe();
             const { error } = await client.from(TABLES.ROUTE_NODES).insert({
                line_id: lineId,
                node_id: creation.nodeId,
                port_address: creation.portAddress,
                sequence: 1,
                wire_1_color_name: null,
                wire_2_color_name: null
            });
            if (error) throw error;
        });
    }
};

export const checkPhoneNumbersExist = async (phoneNumbers: string[]): Promise<Set<string>> => {
    if (phoneNumbers.length === 0) return new Set();
    return handleOfflineRead(TABLES.PHONE_LINES,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.PHONE_LINES).select('phone_number').in('phone_number', phoneNumbers);
            if (error) throw error;
            return new Set(data.map(item => item.phone_number));
        },
        async () => {
            const lines = await db.phone_lines.where('phone_number').anyOf(phoneNumbers).toArray();
            return new Set(lines.map(l => l.phone_number));
        }
    );
};

export const bulkCreatePhoneLines = async (lines: BulkPhoneLine[]): Promise<{ successCount: number, errorCount: number }> => {
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of lines) {
        try {
            await createPhoneLine(
                { phone_number: item.phone_number, consumer_unit: item.consumer_unit },
                [], 
                item.validTagIds,
                [],
                [] 
            );
            successCount++;
        } catch (e) {
            console.error("Bulk create error", e);
            errorCount++;
        }
    }
    return { successCount, errorCount };
};
