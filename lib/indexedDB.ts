import { getDocsFromCache, getDocsFromServer, getDocs, Query, DocumentData } from "firebase/firestore";
import { devLog } from "@/lib/logger";

/**
 * Helper to get data from cache first, then server.
 * This utilizes Firebase SDK's built-in persistence (IndexedDB).
 */
export async function getCachedData<T>(
  q: Query<DocumentData, DocumentData>
): Promise<{ data: T[]; fromCache: boolean }> {
  try {
    // 1. Try Cache First (Fastest)
    const cacheSnapshot = await getDocsFromCache(q);
    if (!cacheSnapshot.empty) {
      const data = cacheSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
      devLog("Loaded from cache");
      return { data, fromCache: true };
    }

    // 2. Fallback to Server
    devLog("Cache empty, fetching from server...");
    const serverSnapshot = await getDocsFromServer(q);
    const data = serverSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
    return { data, fromCache: false };
  } catch (error) {
    console.error("Error in getCachedData:", error);
    // Fallback standard getDocs if cache logic fails
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
    return { data, fromCache: false };
  }
}
