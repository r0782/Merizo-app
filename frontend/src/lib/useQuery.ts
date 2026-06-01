/**
 * useQuery.ts — Stale-While-Revalidate Hook
 * No TanStack needed — custom SWR for React Native
 *
 * Usage:
 *   const { data, loading, refresh } = useQuery(CK.trips(userId), () => api.get("/trips"))
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { cache, TTL } from "./cache";

type Opts = {
  ttl?:      number;
  staleSec?: number;
  enabled?:  boolean;  // false = don't fetch
  onSuccess?: (data: any) => void;
};

export function useQuery<T>(
  key:     string,
  fetcher: () => Promise<T>,
  opts:    Opts = {},
) {
  const { enabled = true } = opts;
  const { data: cached, isStale } = cache.get<T>(key);

  const [data,    setData]    = useState<T | null>(cached);
  const [loading, setLoading] = useState(!cached && enabled);
  const [error,   setError]   = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetch = useCallback(async (silent = false) => {
    if (fetchingRef.current || !enabled) return;
    fetchingRef.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      cache.set(key, result, opts);
      setData(result);
      opts.onSuccess?.(result);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [key, enabled]);

  // Subscribe to cache updates
  useEffect(() => {
    return cache.subscribe(key, () => {
      const { data: fresh } = cache.get<T>(key);
      if (fresh !== null) setData(fresh);
    });
  }, [key]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;
    if (cached) {
      setData(cached);
      if (isStale) fetch(true); // background refresh
    } else {
      fetch(false);
    }
  }, [key, enabled]);

  const refresh = useCallback(() => fetch(false), [fetch]);
  const silentRefresh = useCallback(() => fetch(true), [fetch]);

  return { data, loading, error, refresh, silentRefresh, isStale };
}

// ─── Optimistic mutation hook ─────────────────────────────────────────────────
export function useMutation<TInput, TResult>(
  mutator: (input: TInput) => Promise<TResult>,
  opts: {
    cacheKey?:    string;
    optimistic?:  (input: TInput, prev: any) => any;
    invalidates?: string[];
    onSuccess?:   (result: TResult) => void;
    onError?:     (err: Error) => void;
  } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const mutate = useCallback(async (input: TInput) => {
    setLoading(true);
    setError(null);

    // Optimistic update
    let rollback: (() => void) | null = null;
    if (opts.optimistic && opts.cacheKey) {
      const { data: prev } = cache.get(opts.cacheKey);
      const optimisticData = opts.optimistic(input, prev);
      cache.set(opts.cacheKey, optimisticData, { ttl: 120, staleSec: 0 });
      rollback = () => cache.set(opts.cacheKey!, prev, { ttl: 120, staleSec: 0 });
    }

    try {
      const result = await mutator(input);
      opts.invalidates?.forEach(k => cache.invalidate(k));
      opts.onSuccess?.(result);
      return result;
    } catch (e: any) {
      rollback?.(); // revert optimistic update
      setError(e?.message || "Failed");
      opts.onError?.(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}