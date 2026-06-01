/**
 * cache.ts — Smart Data Cache
 * Merizo · Enterprise Grade
 *
 * Strategy: stale-while-revalidate
 * - Return cached data INSTANTLY
 * - Fetch fresh data in background
 * - Invalidate related keys on mutations
 */

interface CacheEntry<T> {
  data:      T;
  fetchedAt: number;
  ttl:       number;   // ms
  staleAt:   number;   // ms — show cached but trigger bg refresh
}

type Listener = () => void;

class MerizoCache {
  private store = new Map<string, CacheEntry<any>>();
  private listeners = new Map<string, Set<Listener>>();

  // ── Read ────────────────────────────────────────────────────────────────────
  get<T>(key: string): { data: T | null; isStale: boolean; isFresh: boolean } {
    const e = this.store.get(key);
    if (!e) return { data: null, isStale: false, isFresh: false };
    const now = Date.now();
    if (now > e.fetchedAt + e.ttl) {
      this.store.delete(key);
      return { data: null, isStale: false, isFresh: false };
    }
    const isStale = now > e.staleAt;
    return { data: e.data as T, isStale, isFresh: !isStale };
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  set<T>(key: string, data: T, opts: { ttl?: number; staleSec?: number } = {}) {
    const ttl     = (opts.ttl     ?? 120) * 1000;  // default 2 min
    const staleSec = opts.staleSec ?? 15;            // stale after 15s
    this.store.set(key, {
      data,
      fetchedAt: Date.now(),
      ttl,
      staleAt: Date.now() + staleSec * 1000,
    });
    this.notify(key);
  }

  // ── Optimistic write (instant, overwrite later with real data) ───────────────
  optimistic<T>(key: string, updater: (prev: T | null) => T) {
    const { data } = this.get<T>(key);
    const updated  = updater(data);
    this.set(key, updated, { ttl: 120, staleSec: 0 }); // mark stale immediately
    return updated;
  }

  // ── Invalidate ───────────────────────────────────────────────────────────────
  invalidate(prefix: string) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) { this.store.delete(k); this.notify(k); }
    }
  }

  // ── Subscribe ────────────────────────────────────────────────────────────────
  subscribe(key: string, listener: Listener): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener);
    return () => this.listeners.get(key)?.delete(listener);
  }

  private notify(key: string) {
    this.listeners.get(key)?.forEach(fn => fn());
    // Also notify wildcard prefix listeners
    const prefix = key.split("/")[0];
    this.listeners.get(prefix + "/*")?.forEach(fn => fn());
  }

  clear() { this.store.clear(); }
  size()  { return this.store.size; }
}

export const cache = new MerizoCache();

// ─── TTL presets ──────────────────────────────────────────────────────────────
export const TTL = {
  TRIPS:      { ttl: 300, staleSec: 30  },  // 5 min, stale after 30s
  TRIP_DETAIL:{ ttl: 120, staleSec: 15  },  // 2 min, stale after 15s
  PROFILE:    { ttl: 600, staleSec: 60  },  // 10 min, stale after 60s
  INSIGHTS:   { ttl: 300, staleSec: 60  },  // 5 min, stale after 60s
  SMART_LIMIT:{ ttl: 180, staleSec: 60  },  // 3 min
};

// ─── Cache key builders ───────────────────────────────────────────────────────
export const CK = {
  trips:      (userId: string) => `trips/${userId}`,
  trip:       (id: string)     => `trip/${id}`,
  profile:    (userId: string) => `profile/${userId}`,
  insights:   (period: string) => `insights/${period}`,
  smartLimit: ()               => "smart_limit",
  balances:   (tripId: string) => `balances/${tripId}`,
};