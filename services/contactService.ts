
import { getSupabaseSafe } from './client';
import { Contact, ContactGroup, ContactPhoneNumber, ContactEmail } from '../types';

const TABLES = {
    CONTACTS: 'contacts',
    CONTACT_GROUPS: 'contact_groups',
    CONTACT_PHONE_NUMBERS: 'contact_phone_numbers',
    CONTACT_EMAILS: 'contact_emails',
    CONTACT_GROUP_MEMBERS: 'contact_group_members',
};

// --- Groups ---
export const getContactGroups = async (): Promise<ContactGroup[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.CONTACT_GROUPS).select('*').order('name');
    if (error) throw error;
    return data || [];
};

export const createContactGroup = async (group: Omit<ContactGroup, 'id' | 'created_at'>): Promise<ContactGroup> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.CONTACT_GROUPS).insert(group).select().single();
    if (error) throw error;
    return data;
};

export const updateContactGroup = async (id: string, group: Partial<ContactGroup>): Promise<ContactGroup> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.CONTACT_GROUPS).update(group).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteContactGroup = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.CONTACT_GROUPS).delete().eq('id', id);
    if (error) throw error;
};

// --- Contacts ---
export const getContacts = async (
    searchTerm: string = '',
    groupId: string | null = null,
    page: number = 1,
    pageSize: number = 20
): Promise<{ contacts: Contact[], total: number }> => {
    const client = getSupabaseSafe();
    let query = client.from(TABLES.CONTACTS).select(
        '*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!contact_group_members(*)', 
        { count: 'exact' }
    );

    if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%`);
    }

    if (groupId) {
        // Filter by group relation
        // Supabase syntax for filtering on relation: !inner join
        query = client.from(TABLES.CONTACTS).select(
            '*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!inner(*)', 
            { count: 'exact' }
        ).eq('groups.id', groupId);
        
        if (searchTerm) {
             query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%`);
        }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.order('first_name', { ascending: true }).range(from, to);
    
    if (error) throw error;
    return { contacts: data as Contact[], total: count || 0 };
};

export const getContactById = async (id: string): Promise<Contact | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.CONTACTS)
        .select('*, phone_numbers:contact_phone_numbers(*), emails:contact_emails(*), groups:contact_groups!contact_group_members(*)')
        .eq('id', id)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data as Contact;
};

export const createContact = async (
    contactData: Omit<Contact, 'id' | 'created_at' | 'phone_numbers' | 'emails' | 'groups'>,
    phoneNumbers: Omit<ContactPhoneNumber, 'id' | 'contact_id'>[],
    emails: Omit<ContactEmail, 'id' | 'contact_id'>[],
    groupIds: string[]
): Promise<Contact> => {
    const client = getSupabaseSafe();
    
    // 1. Insert Contact
    const { data: contact, error: contactError } = await client.from(TABLES.CONTACTS).insert(contactData).select().single();
    if (contactError) throw contactError;

    // 2. Insert Phones
    if (phoneNumbers.length > 0) {
        const phonesToInsert = phoneNumbers.map(p => ({ ...p, contact_id: contact.id }));
        const { error: phoneError } = await client.from(TABLES.CONTACT_PHONE_NUMBERS).insert(phonesToInsert);
        if (phoneError) throw phoneError;
    }

    // 3. Insert Emails
    if (emails.length > 0) {
        const emailsToInsert = emails.map(e => ({ ...e, contact_id: contact.id }));
        const { error: emailError } = await client.from(TABLES.CONTACT_EMAILS).insert(emailsToInsert);
        if (emailError) throw emailError;
    }

    // 4. Insert Group Memberships
    if (groupIds.length > 0) {
        const memberships = groupIds.map(gid => ({ contact_id: contact.id, group_id: gid }));
        const { error: groupError } = await client.from(TABLES.CONTACT_GROUP_MEMBERS).insert(memberships);
        if (groupError) throw groupError;
    }

    return contact;
};

export const updateContact = async (
    id: string,
    contactData: Partial<Omit<Contact, 'id' | 'created_at' | 'phone_numbers' | 'emails' | 'groups'>>,
    phoneNumbers: ContactPhoneNumber[],
    emails: ContactEmail[],
    groupIds: string[]
): Promise<void> => {
    const client = getSupabaseSafe();

    // 1. Update Contact Info
    const { error: contactError } = await client.from(TABLES.CONTACTS).update(contactData).eq('id', id);
    if (contactError) throw contactError;

    // 2. Update Phones (Delete all and re-insert is easiest for now, or we could diff)
    await client.from(TABLES.CONTACT_PHONE_NUMBERS).delete().eq('contact_id', id);
    if (phoneNumbers.length > 0) {
        const phonesToInsert = phoneNumbers.map(p => ({ ...p, contact_id: id, id: undefined })); // remove ID to gen new one
        await client.from(TABLES.CONTACT_PHONE_NUMBERS).insert(phonesToInsert);
    }

    // 3. Update Emails
    await client.from(TABLES.CONTACT_EMAILS).delete().eq('contact_id', id);
    if (emails.length > 0) {
        const emailsToInsert = emails.map(e => ({ ...e, contact_id: id, id: undefined }));
        await client.from(TABLES.CONTACT_EMAILS).insert(emailsToInsert);
    }

    // 4. Update Groups
    await client.from(TABLES.CONTACT_GROUP_MEMBERS).delete().eq('contact_id', id);
    if (groupIds.length > 0) {
        const memberships = groupIds.map(gid => ({ contact_id: id, group_id: gid }));
        await client.from(TABLES.CONTACT_GROUP_MEMBERS).insert(memberships);
    }
};

export const deleteContact = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.CONTACTS).delete().eq('id', id);
    if (error) throw error;
};

export const getContactStats = async (): Promise<{ totalContacts: number, totalGroups: number }> => {
    const client = getSupabaseSafe();
    const { count: contactCount, error: cError } = await client.from(TABLES.CONTACTS).select('id', { count: 'exact', head: true });
    if (cError) throw cError;

    const { count: groupCount, error: gError } = await client.from(TABLES.CONTACT_GROUPS).select('id', { count: 'exact', head: true });
    if (gError) throw gError;

    return { totalContacts: contactCount || 0, totalGroups: groupCount || 0 };
};