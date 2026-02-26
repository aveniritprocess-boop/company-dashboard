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
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  status: DiaryStatus
): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    userId,
    date,
    description,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDiaryEntry(
  id: string,
  data: Partial<Pick<DailyDiaryEntry, "date" | "description" | "status">>
): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export function subscribeToDiaryEntries(
  userId: string,
  callback: (entries: DailyDiaryEntry[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    orderBy("date", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as DailyDiaryEntry[];
    callback(entries);
  });
}
