import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { broadcastNotification } from "./notifications";

export type DiaryStatus = "Completed" | "Pending";

export interface DailyDiaryEntry {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  description: string;
  status: DiaryStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLLECTION = "dailyDiary";

export async function addDiaryEntry(
  userId: string,
  date: string,
  description: string,
  status: DiaryStatus,
  userName?: string
): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    userId,
    date,
    description,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await broadcastNotification(
    "Daily Diary Updated",
    `${userName || "An employee"} updated their daily work report for ${date}.`,
    { type: "record", fromUserId: userId, fromUserName: userName }
  );
}

export async function updateDiaryEntry(
  id: string,
  data: Partial<Pick<DailyDiaryEntry, "date" | "description" | "status">>,
  userId: string,
  userName?: string
): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });

  await broadcastNotification(
    "Daily Diary Updated",
    `${userName || "An employee"} modified a work report for ${data.date || "recent date"}.`,
    { type: "record", fromUserId: userId, fromUserName: userName }
  );
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export function subscribeToDiaryEntries(
  userId: string,
  callback: (entries: DailyDiaryEntry[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void,
  pageSize: number = 20,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null
): () => void {
  let q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(pageSize)
  );

  if (lastVisibleDoc) {
    q = query(q, startAfter(lastVisibleDoc));
  }

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as DailyDiaryEntry[];
    
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(entries, lastDoc);
  });
}
export function subscribeToAllDiaryEntriesByDate(
  date: string, // "YYYY-MM-DD"
  callback: (entries: DailyDiaryEntry[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where("date", "==", date),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as DailyDiaryEntry[];
    callback(entries);
  });
}

export function subscribeToRecentDiaryEntries(
  days: number,
  callback: (entries: DailyDiaryEntry[]) => void
): () => void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const q = query(
    collection(db, COLLECTION),
    where("createdAt", ">=", cutoffDate),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as DailyDiaryEntry[];
    callback(entries);
  });
}

export function subscribeToRecentDiaryEntriesForUser(
  userId: string,
  days: number,
  callback: (entries: DailyDiaryEntry[]) => void
): () => void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    where("createdAt", ">=", cutoffDate),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as DailyDiaryEntry[];
    callback(entries);
  });
}
