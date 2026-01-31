
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthState } from './types';
import { verifyRefreshToken, updateLastOnline, logoutUser, getUserById } from './services/authService';

interface AuthContextType extends AuthState {
    login: (user: User, token: string, refreshToken?: string) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: true,
    });

    const updateOnlineStatus = useCallback(async (userId: string) => {
        const lastUpdateStr = localStorage.getItem('last_online_update');
        const now = Date.now();
        // Throttle updates to once every 5 minutes
        if (!lastUpdateStr || now - parseInt(lastUpdateStr) > 5 * 60 * 1000) {
            try {
                await updateLastOnline(userId);
                localStorage.setItem('last_online_update', now.toString());
            } catch (e) {
                console.error("Failed to update last online", e);
            }
        }
    }, []);

    const login = (user: User, token: string, refreshToken?: string) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('user_data', JSON.stringify(user));
        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
        }
        setState({ user, token, isAuthenticated: true, isLoading: false });
        updateOnlineStatus(user.id);
    };

    const logout = async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            try {
                await logoutUser(refreshToken);
            } catch (e) { console.error(e); }
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('last_online_update');
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    };

    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user_data');
        const refreshToken = localStorage.getItem('refresh_token');

        if (token && userStr) {
            try {
                const user = JSON.parse(userStr) as User;
                
                // Critical: Check if user data is complete (has role)
                // If the stored user data is stale (from before RBAC was fully implemented), force a refresh/logout
                if (!user || !user.id || !user.role) {
                    console.warn("Stale or invalid user data found in session. Forcing logout to refresh permissions.");
                    logout();
                    return;
                }

                setState({ user, token, isAuthenticated: true, isLoading: false });
                updateOnlineStatus(user.id);
            } catch (e) {
                console.error("Error parsing user data", e);
                logout();
            }
        } else if (refreshToken) {
            // Try to restore session via refresh token
            try {
                const user = await verifyRefreshToken(refreshToken);
                if (user && user.is_active) {
                     // Generate new dummy access token
                     const newToken = btoa(`${user.id}:${Date.now()}`);
                     login(user, newToken, refreshToken); // Re-login
                } else {
                    logout();
                }
            } catch (e) {
                logout();
            }
        } else {
            setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
    }, [updateOnlineStatus]);
    
    const refreshUser = useCallback(async () => {
        if (state.user && state.user.id) {
            try {
                const updatedUser = await getUserById(state.user.id);
                if (updatedUser) {
                    localStorage.setItem('user_data', JSON.stringify(updatedUser));
                    setState(prev => ({ ...prev, user: updatedUser }));
                }
            } catch (error) {
                console.error("Failed to refresh user data", error);
            }
        }
    }, [state.user]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Tracking Effect
    useEffect(() => {
        if (state.isAuthenticated && state.user) {
             const interval = setInterval(() => {
                 updateOnlineStatus(state.user!.id);
             }, 60000); // Check every minute if we need to push update
             return () => clearInterval(interval);
        }
    }, [state.isAuthenticated, state.user, updateOnlineStatus]);

    return (
        <AuthContext.Provider value={{ ...state, login, logout, checkAuth, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
