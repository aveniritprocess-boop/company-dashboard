import { collection, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { getCachedData } from "./indexedDB";

// Example specific getters
export async function getCachedTodos(userId: string) {
  const q = query(
    collection(db, "users", userId, "todos"),
    orderBy("createdAt", "desc")
  );
  return getCachedData(q);
}

export async function getCachedTasks(userId: string) {
  const q = query(
      collection(db, "users", userId, "tasks"),
      orderBy("createdAt", "desc")
  );
  return getCachedData(q);
}

