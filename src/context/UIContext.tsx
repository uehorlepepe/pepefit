import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
type ToastKind = 'success' | 'error' | 'info' | 'pr';
interface Toast { id: number; message: string; detail?: string; kind: ToastKind }

interface UIContextValue {
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  toggleTheme: () => void;
  toast: (message: string, kind?: ToastKind, detail?: string) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => (localStorage.getItem('pepefit.theme') as 'dark' | 'light') || 'light');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('pepefit.theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a1917' : '#f4f1ea');
  }, [theme]);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = 'success', detail?: string) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev.slice(-2), { id, message, detail, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3800);
  }, []);

  const setTheme = useCallback((t: 'dark' | 'light') => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState(t => (t === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(() => ({
    theme, setTheme, toggleTheme, toast, toasts, dismissToast,
  }), [theme, setTheme, toggleTheme, toast, toasts, dismissToast]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}