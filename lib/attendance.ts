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
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { devLog } from "@/lib/logger";
import { logActivityClient } from "./audit-client";
import { monitorQuery } from "./firestore-monitor";

export interface AttendanceSession {
  id: string;
  clockInAt: Timestamp;
  clockOutAt: Timestamp | null;
  clockInImageUrl: string;
  clockOutImageUrl: string | null;
  durationSeconds: number | null;
  status: "active" | "completed";
}

const ATTENDANCE_NOTIFICATION_ROLES = Object.freeze([
  "ceo",
  "admin",
  "hr",
  "manager",
] as const);

async function notifyAdminsAndManagers(
  title: string,
  message: string,
  options?: {
    link?: string;
    fromUserId?: string;
    fromUserName?: string;
    fromUserPhoto?: string;
    type?: "task" | "attendance" | "system" | "record";
  }
): Promise<void> {
  try {
    const snap = await monitorQuery("notifyAdminsAndManagers_getAdmins", "users", async () => {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("role", "in", ATTENDANCE_NOTIFICATION_ROLES));
      return getDocs(q);
    });

    if (snap.empty) {
      devLog("[ATTENDANCE] No administrative users found to notify.");
      return;
    }

    const activeAdmins = snap.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          is_active: data.is_active ?? true,
          is_locked: data.is_locked ?? false,
          is_deleted: data.is_deleted ?? false,
          portal_access: data.portal_access ?? true,
        };
      })
      .filter(u => u.is_active && !u.is_locked && !u.is_deleted && u.portal_access);

    if (activeAdmins.length === 0) {
      devLog("[ATTENDANCE] No active administrative users found to notify.");
      return;
    }

    const uids = Array.from(new Set(activeAdmins.map(u => u.id).filter(id => !!id)));
    if (uids.length === 0) {
      devLog("[ATTENDANCE] No valid UIDs found to notify.");
      return;
    }

    devLog(`[ATTENDANCE] Scoped notification to ${uids.length} active admin/manager users.`);

    const now = serverTimestamp();
    const CHUNK_SIZE = 500;

    for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
      const chunk = uids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((uid) => {
        const ref = doc(collection(db, "notifications"));
        batch.set(ref, {
          userId: uid,
          title,
          message,
          read: false,
          link: options?.link || null,
          fromUserId: options?.fromUserId || null,
          fromUserName: options?.fromUserName || null,
          fromUserPhoto: options?.fromUserPhoto || null,
          type: options?.type || "system",
          createdAt: now,
        });
      });

      await batch.commit();
    }

    devLog("[ATTENDANCE] Scoped notifications written successfully.");
  } catch (error) {
    console.error("Failed to dispatch scoped attendance notifications:", error);
  }
}

export async function startSession(userId: string, imageUrl: string, userName?: string) {
  const userAttendanceRef = collection(db, "users", userId, "attendance");
  
  const docRef = await addDoc(userAttendanceRef, {
    clockInAt: serverTimestamp(),
    clockOutAt: null,
    clockInImageUrl: imageUrl,
    clockOutImageUrl: null,
    durationSeconds: null,
    status: "active",
    createdAt: serverTimestamp(),
  });

  // Write audit log
  await logActivityClient({
    action: "attendance_clock_in",
    performedBy: userId,
    performedByName: userName || "Employee",
    targetId: docRef.id,
    targetType: "attendance",
    details: `${userName || "Employee"} clocked in.`,
    metadata: { imageUrl }
  });

  // Notify all admins/managers about the clock in
  await notifyAdminsAndManagers(
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

  // Write audit log
  await logActivityClient({
    action: "attendance_clock_out",
    performedBy: userId,
    performedByName: userName || "Employee",
    targetId: sessionId,
    targetType: "attendance",
    details: `${userName || "Employee"} clocked out.`,
    metadata: { sessionId, imageUrl }
  });

  await notifyAdminsAndManagers(
    "Employee Clocked Out", 
    `${userName || "An employee"} has clocked out.`,
    { type: "attendance", fromUserId: userId, fromUserName: userName }
  );
}

export async function getActiveSession(userId: string): Promise<AttendanceSession | null> {
  return monitorQuery("getActiveSession", "attendance", async () => {
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
  });
}

export async function getSessionHistory(userId: string, limitCount = 50): Promise<AttendanceSession[]> {
  return monitorQuery("getSessionHistory", "attendance", async () => {
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
  });
}
