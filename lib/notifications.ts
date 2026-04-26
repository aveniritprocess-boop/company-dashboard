import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Timestamp;
  fromUserId?: string;
  fromUserName?: string;
  fromUserPhoto?: string;
  type?: "task" | "attendance" | "system" | "record";
}

const NOTIFICATIONS_COLLECTION = "notifications";
const MAIL_COLLECTION = "mail";

export async function sendEmail(
  to: string | string[],
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br>"),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to send email via API:", error);
    }
  } catch (error) {
    console.error("Error calling send-email API:", error);
  }
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  options?: {
    link?: string;
    fromUserId?: string;
    fromUserName?: string;
    fromUserPhoto?: string;
    type?: AppNotification["type"];
  }
): Promise<void> {
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userId,
    title,
    message,
    read: false,
    link: options?.link || null,
    fromUserId: options?.fromUserId || null,
    fromUserName: options?.fromUserName || null,
    fromUserPhoto: options?.fromUserPhoto || null,
    type: options?.type || "system",
    createdAt: serverTimestamp(),
  });
}

/**
 * Sends a notification to every user in the database.
 * Use sparingly for important system updates.
 */
export async function broadcastNotification(
  title: string,
  message: string,
  options?: {
    link?: string;
    fromUserId?: string;
    fromUserName?: string;
    fromUserPhoto?: string;
    type?: AppNotification["type"];
  }
): Promise<void> {
  const { getAllUsers } = await import("./users");
  const users = await getAllUsers();
  
  const batch = writeBatch(db);
  const now = serverTimestamp();

  users.forEach((user) => {
    const ref = doc(collection(db, NOTIFICATIONS_COLLECTION));
    batch.set(ref, {
      userId: user.uid,
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

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const ref = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  await updateDoc(ref, { read: true });
}

export async function markAllNotificationsAsRead(userId: string, notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;

  const batch = writeBatch(db);
  unread.forEach((notification) => {
    const ref = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
    batch.update(ref, { read: true });
  });

  await batch.commit();
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as AppNotification[];
    callback(notifications);
  });
}
