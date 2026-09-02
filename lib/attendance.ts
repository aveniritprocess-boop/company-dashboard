import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  Timestamp,
  doc,
  writeBatch,
  runTransaction
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { devLog } from "@/lib/logger";
import { logActivityClient } from "./audit-client";
import { monitorQuery } from "./firestore-monitor";

export interface AttendanceSession {
  id: string;
  clockInAt: Timestamp;
  // Optional: absent on an active session (see startSession), added at clock-out.
  clockOutAt?: Timestamp | null;
  clockInImageUrl: string;
  clockOutImageUrl: string | null;
  durationSeconds?: number | null;
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

export async function startSession(userId: string, imageUrl: string, userName?: string): Promise<string> {
  const userRef = doc(db, "users", userId);
  let sessionId = "";
  let isNewSession = false;

  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw new Error("User record not found.");
    }

    const userData = userDoc.data();
    const cachedSessionId = userData.active_attendance_session_id;

    // Self-Healing & Idempotency Check
    if (cachedSessionId) {
      const cachedSessionRef = doc(db, "users", userId, "attendance", cachedSessionId);
      const cachedSessionDoc = await transaction.get(cachedSessionRef);
      
      if (cachedSessionDoc.exists() && cachedSessionDoc.data().status === "active") {
        // Idempotent return: User is already clocked in
        sessionId = cachedSessionId;
        return;
      }
      // Cache is stale (session completed or deleted). Proceed to create a new session.
    }

    // Generate new session reference
    const newSessionRef = doc(collection(db, "users", userId, "attendance"));
    
    // 1. Write the new attendance session.
    //
    // clockOutAt and durationSeconds are deliberately NOT written here. The
    // Firestore rule for this path enforces
    //   !request.resource.data.keys().hasAny(['durationSeconds', 'clockOutAt'])
    // so that a record cannot be created pre-completed. A field set to null is
    // still a PRESENT key as far as keys() is concerned, so writing them as null
    // placeholders tripped that check and every clock-in was rejected with
    // "Missing or insufficient permissions".
    //
    // Both fields are added by endSession() at clock-out, which the update rule
    // explicitly permits via its ['clockOutAt', 'clockOutImageUrl',
    // 'durationSeconds', 'status'] whitelist. Every consumer reads these with a
    // truthiness/optional-chaining check, so an absent key behaves exactly as
    // the previous null did.
    transaction.set(newSessionRef, {
      clockInAt: serverTimestamp(),
      clockInImageUrl: imageUrl,
      clockOutImageUrl: null,
      status: "active",
      createdAt: serverTimestamp(),
    });

    // 2. Update the aggregate root cache pointer
    transaction.update(userRef, {
      active_attendance_session_id: newSessionRef.id
    });

    sessionId = newSessionRef.id;
    isNewSession = true;
  });

  if (isNewSession) {
    // Write audit log outside transaction to prevent retries from duplicating logs
    await logActivityClient({
      action: "attendance_clock_in",
      performedBy: userId,
      performedByName: userName || "Employee",
      targetId: sessionId,
      targetType: "attendance",
      details: `${userName || "Employee"} clocked in.`,
      metadata: { imageUrl }
    });

    await notifyAdminsAndManagers(
      "Employee Clocked In", 
      `${userName || "An employee"} has clocked in for the day.`,
      { type: "attendance", fromUserId: userId, fromUserName: userName }
    );
  }

  return sessionId;
}

export async function endSession(userId: string, sessionId: string, imageUrl: string, userName?: string): Promise<void> {
  const userRef = doc(db, "users", userId);
  const sessionRef = doc(db, "users", userId, "attendance", sessionId);
  let isStateChanged = false;

  await runTransaction(db, async (transaction) => {
    // 1. Concurrent Reads (Transaction requirement: all reads before writes)
    const [userDoc, sessionDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(sessionRef)
    ]);

    if (!sessionDoc.exists()) {
      throw new Error("Attendance session not found.");
    }

    const sessionData = sessionDoc.data();
    if (sessionData.status === "completed") {
      // Idempotent return: Session is already clocked out
      return;
    }

    // Calculate duration
    let durationSeconds = 0;
    const clockInAt = sessionData.clockInAt as Timestamp | null;
    if (clockInAt && typeof clockInAt.toDate === "function") {
      durationSeconds = Math.max(0, Math.floor((Date.now() - clockInAt.toDate().getTime()) / 1000));
    }

    // 2. Write the session completion
    transaction.update(sessionRef, {
      clockOutAt: serverTimestamp(),
      clockOutImageUrl: imageUrl,
      status: "completed",
      durationSeconds,
    });

    // 3. Conditionally clear the cache pointer (Self-healing consistency)
    if (userDoc.exists() && userDoc.data().active_attendance_session_id === sessionId) {
      transaction.update(userRef, {
        active_attendance_session_id: null
      });
    }

    isStateChanged = true;
  });

  if (isStateChanged) {
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
