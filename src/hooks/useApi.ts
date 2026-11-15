import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    mounted.current = true;
    if (!path) { setLoading(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    api<T>(path, { signal: controller.signal })
      .then(res => { if (mounted.current) { setData(res); setLoading(false); } })
      .catch(err => {
        if (!mounted.current || err?.name === 'AbortError') return;
        setError(err?.message || 'Could not load data.');
        setLoading(false);
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, loading, error, refetch, setData };
}