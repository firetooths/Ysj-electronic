
import { getSupabaseSafe } from './client';
import { Contact, ContactGroup } from '../types';
import { db } from '../db';
import { handleOfflineInsert, handleOfflineUpdate, handleOfflineDelete, handleOfflineRead } from './offlineHandler';
import { TABLES } from '../constants';

export const getContacts = async (searchTerm: string = '', groupId: string | null = null, page: number = 1, pageSize: number = 20): Promise<{ contacts: Contact[], total: number }> => {
    const offlineFallback = async () => {
        let all = await db.contacts.toArray();
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            all = all.filter(c => c.first_name.toLowerCase().includes(lower) || (c.last_name && c.last_name.toLowerCase().includes(lower)) || (c.organization && c.organization.toLowerCase().includes(lower)));
        }
        if (groupId) {
            const members = await db.contact_group_members.where('group_id').equals(groupId).toArray();
            const memberIds = members.map(m => m.contact_id);
            all = all.filter(c => memberIds.includes(c.id));
        }
        
        const total = all.length;
        const sliced = all.slice((page - 1) * pageSize, page * pageSize);
        
        const enriched = await Promise.all(sliced.map(async c => {
            const phones = await db.contact_phone_numbers.where('contact_id').equals(c.id).toArray();
            const emails = await db.contact_emails.where('contact_id').equals(c.id).toArray();
            const grpMembers = await db.contact_group_members.where('contact_id').equals(c.id).toArray();
            const groups = await Promise.all(grpMembers.map(gm => db.contact_groups.get(gm.group_id)));
            return { ...c, phone_numbers: phones, emails, groups: groups.filter(g => !!g) };
        }));
        
        return { contacts: enriched, total };
    };

    return handleOfflineRead(TABLES.CONTACTS, async () => {
        const client = getSupabaseSafe();
        let query = client.from(TABLES.CONTACTS).select('*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!contact_group_members(*)', { count: 'exact' });
        if (searchTerm) query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%`);
        if (groupId) {
             query = client.from(TABLES.CONTACTS).select('*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!inner(*)', { count: 'exact' }).eq('groups.id', groupId);
             if (searchTerm) query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%`);
        }
        const { data, count, error } = await query.order('first_name', { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
        if (error) throw error;
        return { contacts: data as Contact[], total: count || 0 };
    }, offlineFallback);
};

export const getContactById = async (id: string): Promise<Contact | null> => {
    return handleOfflineRead(TABLES.CONTACTS,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.CONTACTS)
                .select('*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!contact_group_members(*)')
                .eq('id', id).single();
            if (error) throw error;
            return data;
        },
        async () => {
            const c = await db.contacts.get(id);
            if (!c) return null;
            const phones = await db.contact_phone_numbers.where('contact_id').equals(id).toArray();
            const emails = await db.contact_emails.where('contact_id').equals(id).toArray();
            const grpMembers = await db.contact_group_members.where('contact_id').equals(id).toArray();
            const groups = await Promise.all(grpMembers.map(gm => db.contact_groups.get(gm.group_id)));
            return { ...c, phone_numbers: phones, emails, groups: groups.filter(Boolean) };
        }
    );
};

export const getContactStats = async () => {
    return handleOfflineRead('contact_stats', 
        async () => {
            const client = getSupabaseSafe();
            const { count: cCount } = await client.from(TABLES.CONTACTS).select('*', { count: 'exact', head: true });
            const { count: gCount } = await client.from(TABLES.CONTACT_GROUPS).select('*', { count: 'exact', head: true });
            return { totalContacts: cCount || 0, totalGroups: gCount || 0 };
        },
        async () => {
            const cCount = await db.contacts.count();
            const gCount = await db.contact_groups.count();
            return { totalContacts: cCount, totalGroups: gCount };
        }
    );
};

export const createContact = async (contactData: any, phoneNumbers: any[], emails: any[], groupIds: string[]) => {
    const contactPayload = { ...contactData, created_at: new Date().toISOString() };
    const contact = await handleOfflineInsert<Contact>(TABLES.CONTACTS, contactPayload, async () => {
        const client = getSupabaseSafe();
        const { data, error } = await client.from(TABLES.CONTACTS).insert(contactPayload).select().single();
        if (error) throw error;
        return data;
    });

    for (const p of phoneNumbers) {
        await handleOfflineInsert(TABLES.CONTACT_PHONE_NUMBERS, { ...p, contact_id: contact.id }, async () => {
            await getSupabaseSafe().from(TABLES.CONTACT_PHONE_NUMBERS).insert({ ...p, contact_id: contact.id });
        });
    }
    for (const e of emails) {
        await handleOfflineInsert(TABLES.CONTACT_EMAILS, { ...e, contact_id: contact.id }, async () => {
            await getSupabaseSafe().from(TABLES.CONTACT_EMAILS).insert({ ...e, contact_id: contact.id });
        });
    }
    for (const gid of groupIds) {
        await handleOfflineInsert(TABLES.CONTACT_GROUP_MEMBERS, { contact_id: contact.id, group_id: gid }, async () => {
            await getSupabaseSafe().from(TABLES.CONTACT_GROUP_MEMBERS).insert({ contact_id: contact.id, group_id: gid });
        });
    }
    return contact;
};

export const updateContact = async (id: string, contactData: any, phoneNumbers: any[], emails: any[], groupIds: string[]) => {
    await handleOfflineUpdate(TABLES.CONTACTS, id, contactData, async () => {
        await getSupabaseSafe().from(TABLES.CONTACTS).update(contactData).eq('id', id);
    });

    const client = getSupabaseSafe();
    
    if (navigator.onLine) {
        await client.from(TABLES.CONTACT_PHONE_NUMBERS).delete().eq('contact_id', id);
        await client.from(TABLES.CONTACT_EMAILS).delete().eq('contact_id', id);
        await client.from(TABLES.CONTACT_GROUP_MEMBERS).delete().eq('contact_id', id);
    } else {
        await db.contact_phone_numbers.where('contact_id').equals(id).delete();
        await db.contact_emails.where('contact_id').equals(id).delete();
        await db.contact_group_members.where('contact_id').equals(id).delete();
    }

    for (const p of phoneNumbers) {
        await handleOfflineInsert(TABLES.CONTACT_PHONE_NUMBERS, { ...p, contact_id: id }, async () => {
            await client.from(TABLES.CONTACT_PHONE_NUMBERS).insert({ ...p, contact_id: id });
        });
    }
    for (const e of emails) {
        await handleOfflineInsert(TABLES.CONTACT_EMAILS, { ...e, contact_id: id }, async () => {
            await client.from(TABLES.CONTACT_EMAILS).insert({ ...e, contact_id: id });
        });
    }
    for (const gid of groupIds) {
        await handleOfflineInsert(TABLES.CONTACT_GROUP_MEMBERS, { contact_id: id, group_id: gid }, async () => {
            await client.from(TABLES.CONTACT_GROUP_MEMBERS).insert({ contact_id: id, group_id: gid });
        });
    }
};

export const getContactGroups = async () => handleOfflineRead(TABLES.CONTACT_GROUPS, async () => (await getSupabaseSafe().from(TABLES.CONTACT_GROUPS).select('*').order('name')).data || [], async () => db.contact_groups.orderBy('name').toArray());
export const createContactGroup = async (group: any) => handleOfflineInsert(TABLES.CONTACT_GROUPS, { ...group, created_at: new Date().toISOString() }, async () => (await getSupabaseSafe().from(TABLES.CONTACT_GROUPS).insert(group).select().single()).data);
export const updateContactGroup = async (id: string, data: any) => handleOfflineUpdate(TABLES.CONTACT_GROUPS, id, data, async () => (await getSupabaseSafe().from(TABLES.CONTACT_GROUPS).update(data).eq('id', id).select().single()).data);
export const deleteContactGroup = async (id: string) => handleOfflineDelete(TABLES.CONTACT_GROUPS, id, async () => (await getSupabaseSafe().from(TABLES.CONTACT_GROUPS).delete().eq('id', id)));
export const deleteContact = async (id: string) => handleOfflineDelete(TABLES.CONTACTS, id, async () => (await getSupabaseSafe().from(TABLES.CONTACTS).delete().eq('id', id)));
