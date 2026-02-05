
import { getSupabaseSafe } from './client';
import { User, Role, RefreshToken } from '../types';
import { TABLES } from '../constants';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { handleOfflineRead } from './offlineHandler';

// --- Role Management ---

export const getRoles = async (): Promise<Role[]> => {
    return handleOfflineRead(TABLES.ROLES,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.ROLES).select('*').order('name');
            if (error) throw error;
            return data || [];
        },
        async () => db.roles.orderBy('name').toArray()
    );
};

export const createRole = async (name: string, permissions: string[]): Promise<Role> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.ROLES).insert({ name, permissions }).select().single();
    if (error) throw error;
    return data;
};

export const updateRole = async (id: string, name: string, permissions: string[]): Promise<Role> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.ROLES).update({ name, permissions }).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteRole = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.ROLES).delete().eq('id', id);
    if (error) throw error;
};

// --- User Management ---

export const getUsers = async (): Promise<User[]> => {
    return handleOfflineRead(TABLES.USERS,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.USERS).select('*, role:role_id(*)').order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        async () => {
            const allUsers = await db.users.toArray();
            return await Promise.all(allUsers.map(async u => {
                const role = await db.roles.get(u.role_id);
                return { ...u, role };
            }));
        }
    );
};

export const getUserById = async (id: string): Promise<User | null> => {
    return handleOfflineRead('user_' + id,
        async () => {
            const client = getSupabaseSafe();
            const { data, error } = await client.from(TABLES.USERS).select('*, role:role_id(*)').eq('id', id).single();
            if (error && error.code === 'PGRST116') return null;
            if (error) throw error;
            return data;
        },
        async () => {
            const u = await db.users.get(id);
            if (!u) return null;
            const role = await db.roles.get(u.role_id);
            return { ...u, role };
        }
    );
};
// ... (rest of authService.ts functions kept as is)
export const createUser = async (userData: Partial<User>, passwordRaw: string): Promise<User> => {
    const client = getSupabaseSafe();
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(passwordRaw, salt);

    const { data, error } = await client.from(TABLES.USERS).insert({
        ...userData,
        password_hash
    }).select().single();

    if (error) throw error;
    return data;
};

export const updateUser = async (id: string, updates: Partial<User>): Promise<User> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.USERS).update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const resetUserPassword = async (id: string, newPasswordRaw: string): Promise<void> => {
    const client = getSupabaseSafe();
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPasswordRaw, salt);

    const { error } = await client.from(TABLES.USERS).update({ password_hash }).eq('id', id);
    if (error) throw error;
};

export const deleteUser = async (id: string): Promise<void> => {
    const client = getSupabaseSafe();
    const { error } = await client.from(TABLES.USERS).delete().eq('id', id);
    if (error) throw error;
};

export const updateLastOnline = async (id: string): Promise<void> => {
    if (!navigator.onLine) return; // Silent return offline
    const client = getSupabaseSafe();
    const now = new Date().toISOString();
    await client.from(TABLES.USERS).update({ last_online: now }).eq('id', id);
};

export const loginUser = async (username: string, passwordRaw: string, rememberMe: boolean): Promise<{ user: User, accessToken: string, refreshToken?: string }> => {
    const client = getSupabaseSafe();
    const { data: user, error } = await client.from(TABLES.USERS).select('*, role:role_id(*)').eq('username', username).single();
    if (error || !user) throw new Error('نام کاربری یا رمز عبور اشتباه است.');
    if (!user.is_active) throw new Error('حساب کاربری شما غیرفعال شده است.');
    const isMatch = await bcrypt.compare(passwordRaw, user.password_hash);
    if (!isMatch) throw new Error('نام کاربری یا رمز عبور اشتباه است.');
    const accessToken = btoa(`${user.id}:${Date.now()}:${Math.random()}`);
    let refreshTokenString: string | undefined = undefined;
    if (rememberMe) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);
        refreshTokenString = btoa(`refresh:${user.id}:${Date.now()}`);
        await client.from(TABLES.REFRESH_TOKENS).insert({ user_id: user.id, token: refreshTokenString, expires_at: expiresAt.toISOString() });
    }
    return { user: user as User, accessToken, refreshToken: refreshTokenString };
};

export const verifyRefreshToken = async (token: string): Promise<User | null> => {
    if (!navigator.onLine) return null; // Can't verify JWT/DB refresh token offline securely
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.REFRESH_TOKENS).select('user_id, expires_at').eq('token', token).single();
    if (error || !data) return null;
    if (new Date(data.expires_at) < new Date()) {
        await client.from(TABLES.REFRESH_TOKENS).delete().eq('token', token);
        return null;
    }
    const { data: user } = await client.from(TABLES.USERS).select('*, role:role_id(*)').eq('id', data.user_id).single();
    return user as User;
};

export const logoutUser = async (token: string): Promise<void> => {
    if (token && navigator.onLine) {
        const client = getSupabaseSafe();
        await client.from(TABLES.REFRESH_TOKENS).delete().eq('token', token);
    }
};
