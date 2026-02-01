
import { getSupabaseSafe } from './client';
import { PhoneLine, RouteNode, Node, Tag, BulkPhoneLine } from '../types';
import { TABLES } from '../constants';
import { logPhoneLineAction } from './phoneLogService';
import { CACHE_KEYS, queryLocalData } from './offlineService';

export const getPhoneLines = async (
    page: number, 
    pageSize: number,
    searchTerm: string = '',
    tagIds: string[] = [],
): Promise<{ lines: PhoneLine[], total: number }> => {
    // Offline Logic
    if (!navigator.onLine) {
        const result = queryLocalData<PhoneLine>(
            CACHE_KEYS.PHONE_LINES,
            (line) => {
                let matchesSearch = true;
                if (searchTerm && searchTerm.length >= 3) {
                    const term = searchTerm.toLowerCase();
                    matchesSearch = (
                        (line.phone_number && line.phone_number.includes(term)) ||
                        (line.consumer_unit && line.consumer_unit.toLowerCase().includes(term))
                    );
                }
                
                let matchesTags = true;
                if (tagIds.length > 0) {
                    // Check if line has ANY of the selected tags
                    const lineTags = line.tags?.map(t => t.id) || [];
                    matchesTags = tagIds.some(id => lineTags.includes(id));
                }

                return matchesSearch && matchesTags;
            },
            page,
            pageSize,
            (a, b) => a.phone_number.localeCompare(b.phone_number) // Sort by phone number
        );
        return { lines: result.data, total: result.total };
    }

    const client = getSupabaseSafe();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let lineIdsFromTags: string[] | null = null;
    if (tagIds.length > 0) {
        const { data: lineTagData, error: tagFilterError } = await client
            .from(TABLES.PHONE_LINE_TAGS)
            .select('phone_line_id')
            .in('tag_id', tagIds);
        if (tagFilterError) throw tagFilterError;
        
        lineIdsFromTags = lineTagData ? [...new Set((lineTagData as any[]).map((d: any) => d.phone_line_id).filter((id: any): id is string => typeof id === 'string'))] : [];

        if (lineIdsFromTags.length === 0) {
            return { lines: [], total: 0 };
        }
    }

    let query = client
        .from(TABLES.PHONE_LINES)
        .select('*, tags(*)', { count: 'exact' });

    if (searchTerm.length >= 3) {
        query = query.or(`phone_number.ilike.%${searchTerm}%,consumer_unit.ilike.%${searchTerm}%`);
    }

    if (lineIdsFromTags !== null) {
        query = query.in('id', lineIdsFromTags);
    }
    
    const { data, error, count } = await query.order('phone_number').range(from, to);

    if (error) throw error;
    return { lines: data as PhoneLine[], total: count || 0 };
};

export const getPhoneLinesByTagId = async (tagId: string): Promise<PhoneLine[]> => {
    if (!navigator.onLine) {
        const { data } = queryLocalData<PhoneLine>(
            CACHE_KEYS.PHONE_LINES,
            (line) => line.tags?.some(t => t.id === tagId) || false,
            1, 9999
        );
        return data;
    }

    const client = getSupabaseSafe();
    // Use inner join on phone_line_tags to filter by tag_id
    // Fetch route_nodes and their nodes for the report
    const { data, error } = await client
        .from(TABLES.PHONE_LINES)
        .select('*, route_nodes(*, node:nodes(*)), phone_line_tags!inner(tag_id)')
        .eq('phone_line_tags.tag_id', tagId)
        .order('phone_number');

    if (error) throw error;

    // Sort route nodes for each line
    const lines = data as PhoneLine[];
    lines.forEach(line => {
        if (line.route_nodes) {
            line.route_nodes.sort((a, b) => a.sequence - b.sequence);
        }
    });

    return lines;
};

export const getPhoneLineById = async (id: string): Promise<PhoneLine | null> => {
  if (!navigator.onLine) {
      const { data } = queryLocalData<PhoneLine>(CACHE_KEYS.PHONE_LINES, l => l.id === id, 1, 1);
      return data[0] || null;
  }

  const client = getSupabaseSafe();
  const { data, error } = await client
    .from(TABLES.PHONE_LINES)
    .select('*, route_nodes:route_nodes(*, node:nodes(*)), tags(*)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  // Sort the route nodes by sequence client-side
  if (data.route_nodes) {
    data.route_nodes.sort((a: any, b: any) => a.sequence - b.sequence);
  }
  return data as PhoneLine;
};


export const getPhoneLineByNumber = async (phoneNumber: string): Promise<PhoneLine | null> => {
    if (!navigator.onLine) {
        const { data } = queryLocalData<PhoneLine>(CACHE_KEYS.PHONE_LINES, l => l.phone_number === phoneNumber, 1, 1);
        return data[0] || null;
    }

    const client = getSupabaseSafe();
    const { data, error } = await client
      .from(TABLES.PHONE_LINES)
      .select('*, route_nodes:route_nodes(*, node:nodes(*)), tags(*)')
      .eq('phone_number', phoneNumber)
      .single();
    if (error) {
        if (error.code === 'PGRST116') return null; // Not found is not an error
        throw error;
    }
    // Sort the route nodes by sequence client-side
    if (data.route_nodes) {
        data.route_nodes.sort((a: any, b: any) => a.sequence - b.sequence);
    }
    return data as PhoneLine;
};

export const deleteRouteNodes = async (routeNodeIds: string[]): Promise<void> => {
    if (routeNodeIds.length === 0) return;
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.ROUTE_NODES).delete().in('id', routeNodeIds);
    if (error) throw error;
};

export const createPhoneLine = async (
    lineData: Omit<PhoneLine, 'id' | 'created_at' | 'has_active_fault' | 'tags'>, 
    routeNodesData: Omit<RouteNode, 'id' | 'line_id'>[],
    tagIds: string[],
    conflictingRouteNodeIdsToDelete: string[] = [],
    allTags: Tag[]
): Promise<PhoneLine> => {
    if (!navigator.onLine) throw new Error("ثبت خط تلفن در حالت آفلاین امکان‌پذیر نیست.");
    const client = getSupabaseSafe();

    if (conflictingRouteNodeIdsToDelete.length > 0) {
        await deleteRouteNodes(conflictingRouteNodeIdsToDelete);
    }

    const { data: line, error: lineError } = await client.from(TABLES.PHONE_LINES).insert(lineData).select().single();
    if (lineError) throw lineError;

    const routeNodesToInsert = routeNodesData.map(node => ({ ...node, line_id: line.id }));
    const { error: routeError } = await client.from(TABLES.ROUTE_NODES).insert(routeNodesToInsert);
    if (routeError) {
        await client.from(TABLES.PHONE_LINES).delete().eq('id', line.id);
        throw routeError;
    }

    if (tagIds.length > 0) {
        const phoneLineTags = tagIds.map(tag_id => ({ phone_line_id: line.id, tag_id }));
        const { error: tagError } = await client.from(TABLES.PHONE_LINE_TAGS).insert(phoneLineTags);
        if (tagError) {
             await client.from(TABLES.PHONE_LINES).delete().eq('id', line.id); // Rollback
             throw tagError;
        }
    }

    const logParts: string[] = [`ایجاد خط تلفن با شماره ${line.phone_number}`];
    if (lineData.consumer_unit) {
        logParts.push(`واحد مصرف کننده "${lineData.consumer_unit}" ثبت شد`);
    }
    if (tagIds.length > 0) {
        const addedTags = allTags.filter(t => tagIds.includes(t.id)).map(t => `"${t.name}"`).join('، ');
        if (addedTags) logParts.push(`تگ های ${addedTags} اضافه شد`);
    }
    if (routeNodesData.length > 0) {
        logParts.push(`مسیر اولیه با ${routeNodesData.length} گره ثبت شد`);
    }

    await logPhoneLineAction(line.id, logParts.join('، '));
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
    if (!navigator.onLine) throw new Error("ویرایش خط تلفن در حالت آفلاین امکان‌پذیر نیست.");
    const client = getSupabaseSafe();
    
    const oldLine = await getPhoneLineById(lineId);
    if (!oldLine) throw new Error("خط برای ویرایش یافت نشد");

    if (conflictingRouteNodeIdsToDelete.length > 0) {
        await deleteRouteNodes(conflictingRouteNodeIdsToDelete);
    }

    const { data: line, error: lineError } = await client.from(TABLES.PHONE_LINES).update(lineData).eq('id', lineId).select().single();
    if (lineError) throw lineError;

    // Update Route Nodes
    const { error: deleteError } = await client.from(TABLES.ROUTE_NODES).delete().eq('line_id', lineId);
    if (deleteError) throw deleteError;
    const routeNodesToInsert = routeNodesData.map(node => ({ ...node, line_id: lineId }));
    if (routeNodesToInsert.length > 0) {
        const { error: insertError } = await client.from(TABLES.ROUTE_NODES).insert(routeNodesToInsert);
        if (insertError) throw insertError;
    }
    
    // Update Tags
    const { error: deleteTagsError } = await client.from(TABLES.PHONE_LINE_TAGS).delete().eq('phone_line_id', lineId);
    if (deleteTagsError) throw deleteTagsError;
    if (tagIds.length > 0) {
        const phoneLineTags = tagIds.map(tag_id => ({ phone_line_id: lineId, tag_id }));
        const { error: insertTagsError } = await client.from(TABLES.PHONE_LINE_TAGS).insert(phoneLineTags);
        if (insertTagsError) throw insertTagsError;
    }
    
    // --- Detailed Logging ---
    const changes: string[] = [];

    // Consumer unit change
    if (lineData.consumer_unit !== undefined && lineData.consumer_unit !== oldLine.consumer_unit) {
        changes.push(`واحد مصرف کننده از «${oldLine.consumer_unit || 'خالی'}» به «${lineData.consumer_unit || 'خالی'}» تغییر کرد`);
    }

    // Tag changes
    const oldTagIds = oldLine.tags?.map(t => t.id) || [];
    const addedTagIds = tagIds.filter(id => !oldTagIds.includes(id));
    const removedTagIds = oldTagIds.filter(id => !tagIds.includes(id));

    addedTagIds.forEach(id => {
        const tagName = allTags.find(t => t.id === id)?.name;
        if (tagName) changes.push(`تگ «${tagName}» اضافه شد`);
    });
    removedTagIds.forEach(id => {
        const tagName = allTags.find(t => t.id === id)?.name;
        if (tagName) changes.push(`تگ «${tagName}» حذف شد`);
    });
    
    // Route changes
    const oldRoutes = oldLine.route_nodes || [];
    const newRoutes = routeNodesData;
    const oldRoutesSet = new Set(oldRoutes.map(rn => `${rn.node_id}::${rn.port_address}`));
    const newRoutesSet = new Set(newRoutes.map(rn => `${rn.node_id}::${rn.port_address}`));

    oldRoutes.forEach(oldStep => {
        if (!newRoutesSet.has(`${oldStep.node_id}::${oldStep.port_address}`)) {
            changes.push(`پورت ${oldStep.port_address} از گره «${oldStep.node?.name}» از مسیر حذف شد`);
        }
    });
    newRoutes.forEach(newStep => {
        if (!oldRoutesSet.has(`${newStep.node_id}::${newStep.port_address}`)) {
            const nodeName = allNodes.find(n => n.id === newStep.node_id)?.name;
            if(nodeName) changes.push(`پورت ${newStep.port_address} از گره «${nodeName}» به مسیر اضافه شد`);
        }
    });


    const change_description = changes.length > 0 
        ? changes.join('، ') 
        : `ویرایش خط تلفن شماره ${line.phone_number} (بدون تغییر در داده‌های اصلی)`;

    await logPhoneLineAction(line.id, change_description);
    return line;
};

export const deletePhoneLine = async (id: string): Promise<void> => {
    if (!navigator.onLine) throw new Error("حذف خط تلفن در حالت آفلاین امکان‌پذیر نیست.");
    const client = getSupabaseSafe();
    const line = await getPhoneLineById(id);
    const { error } = await client.from(TABLES.PHONE_LINES).delete().eq('id', id);
    if (error) throw error;
    if(line) await logPhoneLineAction(id, `حذف خط تلفن شماره ${line.phone_number}`);
};

export const checkPortInUse = async (nodeId: string, portAddress: string, excludeLineId?: string): Promise<{ inUse: boolean, phoneNumber?: string, routeNodeId?: string }> => {
    const client = getSupabaseSafe();
    let query = client.from(TABLES.ROUTE_NODES)
        .select('id, line_id, phone_line:line_id(phone_number)')
        .eq('node_id', nodeId)
        .eq('port_address', portAddress);

    if (excludeLineId) {
        query = query.neq('line_id', excludeLineId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        throw error;
    }

    if (data) {
        const phoneNumber = (data.phone_line as any)?.phone_number;
        return {
            inUse: true,
            phoneNumber: phoneNumber || 'نامشخص',
            routeNodeId: data.id,
        };
    }

    return { inUse: false };
};

export const getLinesForNode = async (nodeId: string): Promise<RouteNode[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.ROUTE_NODES)
        .select('*, phone_line:line_id(*)')
        .eq('node_id', nodeId);

    if (error) throw error;
    return data || [];
};

export const getPhoneLineDetailsByNumber = async (phoneNumber: string): Promise<Pick<PhoneLine, 'id' | 'phone_number' | 'consumer_unit'> | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.PHONE_LINES)
        .select('id, phone_number, consumer_unit')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

    if (error) throw error;
    return data;
};

export const batchUpdatePortAssignments = async (
    deletions: string[], // Array of route_node ids to delete
    creations: Array<{ phoneNumber: string; consumerUnit: string | null; nodeId: string; portAddress: string; }>,
    node: Node
) => {
    if (!navigator.onLine) throw new Error("تغییر پورت‌ها در حالت آفلاین امکان‌پذیر نیست.");
    const client = getSupabaseSafe();
    
    if (deletions.length > 0) {
        const { data: nodesToDelete, error: fetchError } = await client
            .from(TABLES.ROUTE_NODES)
            // The !inner join ensures that a matching phone_line exists.
            .select('line_id, port_address, phone_line:line_id!inner(phone_number)')
            .in('id', deletions);

        if (fetchError) {
            console.error("Error fetching nodes to delete for logging:", fetchError);
        } else if (nodesToDelete) {
            for (const nodeInfo of nodesToDelete) {
                // FIX: Correctly handle potentially inconsistent type from Supabase join.
                let phoneLineData: { phone_number: string } | null = null;
                if(Array.isArray(nodeInfo.phone_line)) {
                    phoneLineData = nodeInfo.phone_line[0];
                } else {
                    phoneLineData = nodeInfo.phone_line;
                }
                if (nodeInfo.line_id && phoneLineData?.phone_number) {
                    await logPhoneLineAction(nodeInfo.line_id, `تخصیص شماره ${phoneLineData.phone_number} از پورت ${nodeInfo.port_address} گره «${node.name}» حذف شد`);
                }
            }
        }

        const { error: deleteError } = await client.from(TABLES.ROUTE_NODES).delete().in('id', deletions);
        if (deleteError) {
            console.error("Error during port assignment deletion:", deleteError);
            throw new Error(`خطا در حذف تخصیص‌های قبلی: ${deleteError.message}`);
        }
    }

    for (const creation of creations) {
        const { data: line, error: upsertError } = await client.from(TABLES.PHONE_LINES)
            .upsert({ phone_number: creation.phoneNumber, consumer_unit: creation.consumerUnit }, { onConflict: 'phone_number' })
            .select('id')
            .single();
        if (upsertError) {
            console.error("Error upserting phone line:", upsertError);
            throw new Error(`خطا در ثبت شماره تلفن ${creation.phoneNumber}: ${upsertError.message}`);
        }

        const { data: maxSeqData, error: seqError } = await client.from(TABLES.ROUTE_NODES)
            .select('sequence')
            .eq('line_id', line.id)
            .order('sequence', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (seqError) {
             console.error("Error finding max sequence:", seqError);
             throw new Error(`خطا در یافتن ترتیب مسیر برای خط ${creation.phoneNumber}: ${seqError.message}`);
        }
        
        const nextSequence = (maxSeqData?.sequence || 0) + 1;

        const { error: insertError } = await client.from(TABLES.ROUTE_NODES)
            .insert({
                line_id: line.id,
                node_id: creation.nodeId,
                port_address: creation.portAddress,
                sequence: nextSequence,
                wire_1_color_name: null,
                wire_2_color_name: null
            });
        if (insertError) {
            console.error("Error inserting route node:", insertError);
            if (insertError.code === '23505') {
                 throw new Error(`پورت ${creation.portAddress} توسط خط دیگری استفاده می‌شود. لطفاً صفحه را رفرش کرده و دوباره تلاش کنید.`);
            }
            throw new Error(`خطا در تخصیص شماره ${creation.phoneNumber} به پورت ${creation.portAddress}: ${insertError.message}`);
        }
        
        await logPhoneLineAction(line.id, `شماره ${creation.phoneNumber} به پورت ${creation.portAddress} گره «${node.name}» تخصیص داده شد`);
    }
};

export const checkPhoneNumbersExist = async (phoneNumbers: string[]): Promise<Set<string>> => {
    if (phoneNumbers.length === 0) {
        return new Set();
    }
    const client = getSupabaseSafe();
    const { data, error } = await client
        .from(TABLES.PHONE_LINES)
        .select('phone_number')
        .in('phone_number', phoneNumbers);
    
    if (error) {
        console.error('Error checking phone numbers:', error);
        throw error;
    }
    
    return new Set(data.map(item => item.phone_number));
};

export const bulkCreatePhoneLines = async (linesToCreate: BulkPhoneLine[]): Promise<{ successCount: number; errorCount: number; }> => {
    const client = getSupabaseSafe();
    let successCount = 0;
    let errorCount = 0;

    // 1. Insert all phone lines
    const lineInsertData = linesToCreate.map(l => ({
        phone_number: l.phone_number,
        consumer_unit: l.consumer_unit,
    }));

    const { data: insertedLines, error: lineInsertError } = await client
        .from(TABLES.PHONE_LINES)
        .insert(lineInsertData)
        .select('id, phone_number');

    if (lineInsertError) {
        console.error("Bulk line insert failed:", lineInsertError);
        // If the entire batch fails, all are errors.
        return { successCount: 0, errorCount: linesToCreate.length };
    }
    
    successCount = insertedLines.length;
    errorCount = linesToCreate.length - insertedLines.length;

    // 2. Prepare tag associations
    const tagAssociations: { phone_line_id: string; tag_id: string }[] = [];
    for (const line of insertedLines) {
        const originalLineData = linesToCreate.find(l => l.phone_number === line.phone_number);
        if (originalLineData && originalLineData.validTagIds.length > 0) {
            originalLineData.validTagIds.forEach(tagId => {
                tagAssociations.push({ phone_line_id: line.id, tag_id: tagId });
            });
        }
    }

    // 3. Insert tag associations if any
    if (tagAssociations.length > 0) {
        const { error: tagInsertError } = await client
            .from(TABLES.PHONE_LINE_TAGS)
            .insert(tagAssociations);
        
        if (tagInsertError) {
            // This is a partial failure. The lines were created, but tags failed.
            // For simplicity, we don't roll back, just log the error.
            console.error("Bulk tag association failed:", tagInsertError);
        }
    }
    
    // 4. Log actions
    for (const line of insertedLines) {
        await logPhoneLineAction(line.id, `ایجاد خط از طریق ورود گروهی.`);
    }

    return { successCount, errorCount };
};
