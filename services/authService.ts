
import { getSupabaseSafe } from './client';
import { User, Role, RefreshToken } from '../types';
import { TABLES } from '../constants';
import bcrypt from 'bcryptjs';

// --- Role Management ---

export const getRoles = async (): Promise<Role[]> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.ROLES).select('*').order('name');
    if (error) throw error;
    return data || [];
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
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.USERS).select('*, role:role_id(*)').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getUserById = async (id: string): Promise<User | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.USERS).select('*, role:role_id(*)').eq('id', id).single();
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
};

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
    const client = getSupabaseSafe();
    const now = new Date().toISOString();
    // Only update if necessary (throttled logic handles call frequency, DB just updates)
    await client.from(TABLES.USERS).update({ last_online: now }).eq('id', id);
};

// --- Authentication Logic ---

export const loginUser = async (username: string, passwordRaw: string, rememberMe: boolean): Promise<{ user: User, accessToken: string, refreshToken?: string }> => {
    const client = getSupabaseSafe();
    
    // 1. Find User
    const { data: user, error } = await client.from(TABLES.USERS)
        .select('*, role:role_id(*)')
        .eq('username', username)
        .single();

    if (error || !user) {
        throw new Error('نام کاربری یا رمز عبور اشتباه است.');
    }

    if (!user.is_active) {
        throw new Error('حساب کاربری شما غیرفعال شده است.');
    }

    // 2. Verify Password
    const isMatch = await bcrypt.compare(passwordRaw, user.password_hash);
    if (!isMatch) {
        throw new Error('نام کاربری یا رمز عبور اشتباه است.');
    }

    // 3. Generate Fake Access Token (Since we are simulating auth without backend session)
    // In a real app, this would be a JWT signed by the server.
    // We'll use a simple base64 string for this demo.
    const accessToken = btoa(`${user.id}:${Date.now()}:${Math.random()}`);
    
    let refreshTokenString: string | undefined = undefined;

    // 4. Handle Refresh Token if Remember Me is checked
    if (rememberMe) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90); // 90 days

        refreshTokenString = btoa(`refresh:${user.id}:${Date.now()}`);

        const { error: tokenError } = await client.from(TABLES.REFRESH_TOKENS).insert({
            user_id: user.id,
            token: refreshTokenString,
            expires_at: expiresAt.toISOString()
        });

        if (tokenError) console.error("Error saving refresh token", tokenError);
    }

    return { user: user as User, accessToken, refreshToken: refreshTokenString };
};


export const verifyRefreshToken = async (token: string): Promise<User | null> => {
    const client = getSupabaseSafe();
    const { data, error } = await client.from(TABLES.REFRESH_TOKENS)
        .select('user_id, expires_at')
        .eq('token', token)
        .single();

    if (error || !data) return null;

    if (new Date(data.expires_at) < new Date()) {
        // Token expired, delete it
        await client.from(TABLES.REFRESH_TOKENS).delete().eq('token', token);
        return null;
    }

    // Get user
    const { data: user } = await client.from(TABLES.USERS)
        .select('*, role:role_id(*)')
        .eq('id', data.user_id)
        .single();
        
    return user as User;
};

export const logoutUser = async (token: string): Promise<void> => {
    // If we were using a real backend, we would invalidate the access token.
    // For refresh tokens stored in DB:
    // We assume the token passed here might be the refresh token if we had access to it,
    // but in this client-side simulation, we often just clear local storage.
    // Ideally, we clear the refresh token from DB.
    // Since we store refresh token in localStorage for this demo (simulating httpOnly cookie),
    // we can pass it here.
    if (token) {
        const client = getSupabaseSafe();
        await client.from(TABLES.REFRESH_TOKENS).delete().eq('token', token);
    }
};
