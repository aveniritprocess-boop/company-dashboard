import { getCountFromServer, CollectionReference, Query } from "firebase/firestore";

interface CountCacheEntry {
  count: number;
  timestamp: number;
}

const countCache = new Map<string, CountCacheEntry>();
const CACHE_LIFESPAN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves the count of documents in a collection or query, using a 5-minute cache.
 */
export async function getCachedCount(key: string, queryRef: Query | CollectionReference): Promise<number> {
  const cached = countCache.get(key);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_LIFESPAN_MS)) {
    return cached.count;
  }
  const snap = await getCountFromServer(queryRef);
  const count = snap.data().count;
  countCache.set(key, { count, timestamp: now });
  return count;
}

export interface QueryPerformanceLog {
  queryName: string;
  collection: string;
  duration: number;
  count: number;
  timestamp: number;
  isSlow: boolean;
  isLarge: boolean;
}

// In-memory queries leaderboard
export const queryLeaderboard: QueryPerformanceLog[] = [];
const MAX_LEADERBOARD_SIZE = 10;

/**
 * Wraps any Firestore query call to measure execution time, check thresholds,
 * and record it to the query performance logs leaderboard.
 */
export async function monitorQuery<T>(
  queryName: string,
  collectionName: string,
  fetchFn: () => Promise<T>,
  countExtractor?: (result: T) => number
): Promise<T> {
  const start = performance.now();
  const result = await fetchFn();
  const duration = performance.now() - start;

  let count = 0;
  if (countExtractor) {
    count = countExtractor(result);
  } else if (Array.isArray(result)) {
    count = result.length;
  } else if (result && typeof result === "object" && "docs" in result) {
    const obj = result as { docs?: unknown[] };
    count = obj.docs?.length || 0;
  } else if (result !== null && result !== undefined) {
    count = 1;
  }

  const isSlow = duration > 300;
  const isLarge = count > 100;

  const log: QueryPerformanceLog = {
    queryName,
    collection: collectionName,
    duration,
    count,
    timestamp: Date.now(),
    isSlow,
    isLarge
  };

  // Add to leaderboard, sort desc by duration, cap size
  queryLeaderboard.push(log);
  queryLeaderboard.sort((a, b) => b.duration - a.duration);
  if (queryLeaderboard.length > MAX_LEADERBOARD_SIZE) {
    queryLeaderboard.pop();
  }

  return result;
}

// Active real-time listeners counts
export const activeListeners = new Map<string, number>();

/**
 * Tracks the registration and deregistration of real-time listeners.
 */
export function trackListener(listenerName: string): () => void {
  const current = activeListeners.get(listenerName) || 0;
  activeListeners.set(listenerName, current + 1);

  return () => {
    const active = activeListeners.get(listenerName) || 0;
    activeListeners.set(listenerName, Math.max(0, active - 1));
  };
}

export function getActiveListenersInfo() {
  return Array.from(activeListeners.entries()).map(([name, count]) => ({
    name,
    count
  }));
}
