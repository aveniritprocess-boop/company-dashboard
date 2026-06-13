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
import { broadcastNotification } from "./notifications";

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

export async function startSession(userId: string, imageUrl: string, userName?: string) {
  const userAttendanceRef = collection(db, "users", userId, "attendance");
  
  await addDoc(userAttendanceRef, {
    clockInAt: serverTimestamp(),
    clockOutAt: null,
    clockInImageUrl: imageUrl,
    clockOutImageUrl: null,
    durationSeconds: null,
    status: "active",
    createdAt: serverTimestamp(),
  });

  // Notify all admins/managers about the clock in
  // For now, satisfy "Global notification" by broadcasting to everyone or just targeted group
  // The user said "Whenever any important change happens... sent to all users"
  await broadcastNotification(
    "Employee Clocked In", 
    `${userName || "An employee"} has clocked in for the day.`,
    { type: "attendance", fromUserId: userId, fromUserName: userName }
  );
}

export async function endSession(userId: string, sessionId: string, imageUrl: string, userName?: string) {
  const sessionRef = doc(db, "users", userId, "attendance", sessionId);
  
  await updateDoc(sessionRef, {
    clockOutAt: serverTimestamp(),
    clockOutImageUrl: imageUrl,
    status: "completed"
  });

  await broadcastNotification(
    "Employee Clocked Out", 
    `${userName || "An employee"} has clocked out.`,
    { type: "attendance", fromUserId: userId, fromUserName: userName }
  );
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
