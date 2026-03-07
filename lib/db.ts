import { collection, query, orderBy, where } from "firebase/firestore";
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
    collection(db, "tasks"),
    where("assignedTo", "==", userId),
    orderBy("createdAt", "desc")
  );
  return getCachedData(q);
}

export async function getAllCachedTasks() {
  const q = query(
    collection(db, "tasks"),
    orderBy("createdAt", "desc")
  );
  return getCachedData(q);
}

export async function getTeamCachedTasks(managerUid: string) {
  const q = query(
    collection(db, "tasks"),
    where("assignedBy", "==", managerUid),
    orderBy("createdAt", "desc")
  );
  return getCachedData(q);
}


