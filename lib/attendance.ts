import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AttendanceSession {
  id: string;
  clockInAt: Timestamp;
  clockOutAt: Timestamp | null;
  clockInImageUrl: string;
  clockOutImageUrl: string | null;
  durationSeconds: number | null;
  status: "active" | "completed";
}

// Helper to calculate duration in seconds (for client-side estimation or server-side finalization)
// Note: serverTimestamp() returns a placeholder, so we can't calc duration immediately on write with it.
// We usually calculate duration when closing the session.

export async function startSession(userId: string, imageUrl: string) {
  const userAttendanceRef = collection(db, "users", userId, "attendance");
  
  // Check for any existing active sessions and close them (safety measure)
  // or prevent starting a new one. For now, let's assume UI handles prevention, 
  // but we could auto-close previous ones. Let's keep it simple: Create new active session.
  
  await addDoc(userAttendanceRef, {
    clockInAt: serverTimestamp(),
    clockOutAt: null,
    clockInImageUrl: imageUrl,
    clockOutImageUrl: null,
    durationSeconds: null,
    status: "active",
    createdAt: serverTimestamp(),
  });
}

export async function endSession(userId: string, sessionId: string, imageUrl: string) {
  const sessionRef = doc(db, "users", userId, "attendance", sessionId);
  
  // We need to fetch the document to calculate duration? 
  // Ideally, we just set clockOutAt = serverTimestamp().
  // Duration can be calculated on read or by a cloud function. 
  // But for simple app, let's calculate it on client? No, client clock is unreliable.
  // Best approach for accurate duration is Cloud Function triggers on write.
  // BUT, to keep it simple without cloud functions:
  // We will trust the serverTimestamp for start and end. 
  // Duration field is redundant if we have both timestamps, BUT useful for sorting/filtering.
  // Let's just write clockOutAt and status. We can compute duration on read or update it later.
  // Actually, let's write duration based on client time difference as a "good enough" estimate 
  // OR just leave it null and compute on display. 
  // Let's leave durationSeconds as null/computed on client for now, OR:
  // Read the doc, get clockInAt (Timestamp), compare with now.
  // Let's do a read-modify-write transaction if we want accurate duration stored?
  // Too complex. Let's just set clockOutAt and status.
  
  await updateDoc(sessionRef, {
    clockOutAt: serverTimestamp(),
    clockOutImageUrl: imageUrl,
    status: "completed"
  });
}

export async function getActiveSession(userId: string): Promise<AttendanceSession | null> {
  const userAttendanceRef = collection(db, "users", userId, "attendance");
  const q = query(
    userAttendanceRef, 
    where("status", "==", "active"),
    orderBy("createdAt", "desc"), 
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as AttendanceSession;
}

export async function getSessionHistory(userId: string, limitCount = 50): Promise<AttendanceSession[]> {
  const userAttendanceRef = collection(db, "users", userId, "attendance");
  const q = query(
    userAttendanceRef, 
    orderBy("createdAt", "desc"), 
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AttendanceSession[];
}
