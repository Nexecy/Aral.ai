'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { api } from '@/lib/api';
import { clearAuthRedirectFromUrl, readAuthRedirect } from '@/lib/authRedirect';

const USER_CACHE_KEY = 'aral_auth_user';

interface SystemStatus {
  has_supabase: boolean;
  has_gemini: boolean;
  gemini_model: string;
}

type AuthResult = {
  requiresConfirmation: boolean;
  emailVerified: boolean;
  message: string | null;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  establishSession: (accessToken: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resendConfirmation: (email: string) => Promise<{ message: string }>;
  resetPassword: (password: string) => Promise<{ message: string }>;
  refreshUser: () => Promise<void>;
  applyUser: (me: User) => void;
  systemStatus: SystemStatus | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('aral_auth_token', token);
  else localStorage.removeItem('aral_auth_token');
}

function persistUser(user: User | null) {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_CACHE_KEY);
}

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function userFromMe(me: User & { email_verified?: boolean; has_supabase?: boolean; has_gemini?: boolean; gemini_model?: string }): User {
  return {
    id: me.id,
    email: me.email,
    is_demo: me.is_demo,
    email_verified: me.email_verified !== false,
    display_name: me.display_name ?? null,
    avatar_url: me.avatar_url ?? null,
    bio: me.bio ?? null,
    gender: me.gender ?? null,
    theme: me.theme === 'dark' || me.theme === 'light' ? me.theme : null
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const applySession = useCallback(async (accessToken: string | null) => {
    if (!accessToken) {
      persistToken(null);
      persistUser(null);
      setToken(null);
      setUser(null);
      return;
    }
    persistToken(accessToken);
    setToken(accessToken);
    const me = await api.getMe();
    const nextUser = userFromMe(me);
    persistUser(nextUser);
    setUser(nextUser);
    setSystemStatus({
      has_supabase: me.has_supabase,
      has_gemini: me.has_gemini,
      gemini_model: me.gemini_model
    });
  }, []);

  useEffect(() => {
    async function initAuth() {
      try {
        const params = readAuthRedirect();
        try {
          if (params.code) {
            const session = await api.exchangeCode(params.code);
            if (session.access_token) await applySession(session.access_token);
            clearAuthRedirectFromUrl();
            if (params.type === 'recovery' && !window.location.pathname.includes('reset-password')) {
              window.location.replace('/reset-password/');
              return;
            }
            return;
          }
          if (params.accessToken) {
            await applySession(params.accessToken);
            clearAuthRedirectFromUrl();
            if (params.type === 'recovery' && !window.location.pathname.includes('reset-password')) {
              window.location.replace('/reset-password/');
              return;
            }
            return;
          }
        } catch {
          clearAuthRedirectFromUrl();
        }

        const savedToken = localStorage.getItem('aral_auth_token');
        if (!savedToken) {
          persistUser(null);
          setUser(null);
          setToken(null);
          return;
        }

        const cachedUser = readCachedUser();
        if (cachedUser) {
          setToken(savedToken);
          setUser(cachedUser);
          setLoading(false);
        }

        await applySession(savedToken);
      } catch {
        persistToken(null);
        persistUser(null);
        setToken(null);
        setUser(null);
        setSystemStatus(null);
      } finally {
        setLoading(false);
      }
    }
    void initAuth();
  }, [applySession]);

  const login = async (email: string, password: string) => {
    const session = await api.login(email, password);
    if (session.access_token) await applySession(session.access_token);
    const emailVerified = session.email_verified !== false && session.user?.email_verified !== false;
    return {
      requiresConfirmation: session.requires_confirmation,
      emailVerified,
      message: session.message ?? null
    };
  };

  const signup = async (email: string, password: string) => {
    const session = await api.signup(email, password);
    if (session.access_token) await applySession(session.access_token);
    const emailVerified = session.email_verified !== false && session.user?.email_verified !== false;
    return {
      requiresConfirmation: session.requires_confirmation,
      emailVerified,
      message: session.message ?? null
    };
  };

  const logout = () => {
    persistToken(null);
    persistUser(null);
    setToken(null);
    setUser(null);
  };

  const establishSession = useCallback(
    async (accessToken: string) => {
      await applySession(accessToken);
    },
    [applySession]
  );

  const forgotPassword = async (email: string) => {
    const result = await api.forgotPassword(email);
    return { message: result.message };
  };

  const resendConfirmation = async (email: string) => {
    const result = await api.resendConfirmation(email);
    return { message: result.message };
  };

  const resetPassword = async (password: string) => {
    const result = await api.resetPassword(password);
    return { message: result.message };
  };

  const refreshUser = useCallback(async () => {
    const me = await api.getMe();
    const nextUser = userFromMe(me);
    persistUser(nextUser);
    setUser(nextUser);
    setSystemStatus({
      has_supabase: me.has_supabase,
      has_gemini: me.has_gemini,
      gemini_model: me.gemini_model
    });
  }, []);

  const applyUser = useCallback((me: User) => {
    const nextUser = userFromMe(me);
    persistUser(nextUser);
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
        establishSession,
        forgotPassword,
        resendConfirmation,
        resetPassword,
        refreshUser,
        applyUser,
        systemStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export function useEmailGate() {
  const { user } = useAuth();
  const allowed = user?.email_verified !== false;
  return {
    allowed,
    message: 'Verify your email to unlock AI study tools.'
  };
}

export function userInitial(
  source?: { display_name?: string | null; email?: string | null } | string | null
): string {
  const text =
    typeof source === 'string'
      ? source
      : source?.display_name?.trim() || source?.email?.trim() || '';
  const letter = text.charAt(0);
  return letter ? letter.toUpperCase() : '?';
}
