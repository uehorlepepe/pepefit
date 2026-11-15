import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import { api, authApi, getToken, setToken } from '../lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  demoLogin: () => Promise<User>;
  logout: () => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('pepefit.onboarded');
    setUserState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) { setUserState(null); return; }
    try {
      const res = await api<{ user: User }>('/auth/me');
      setUserState(res.user);
    } catch {
      setToken(null);
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('pepefit:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pepefit:unauthorized', onUnauthorized);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await authApi.signup(name, email, password);
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  }, []);

  const demoLogin = useCallback(async () => {
    const res = await authApi.login('demo@pepefit.app', 'demo1234');
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  }, []);

  const value = useMemo(() => ({
    user, loading, login, signup, demoLogin, logout, setUser: setUserState, refreshUser,
  }), [user, loading, login, signup, demoLogin, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}