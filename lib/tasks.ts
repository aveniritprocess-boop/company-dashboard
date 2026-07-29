import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  FieldValue
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { createNotification, sendEmail } from "./notifications";
import { trackListener } from "./firestore-monitor";
import { getUserById } from "./users";
import { APP_URL } from "./config";
import { logActivityClient } from "./audit-client";
import { CreateTaskSchema } from "./validators/task";

export type TaskStatus = "pending" | "in_progress" | "completed" | "approved" | "rejected" | "hold" | "backlog" | "todo" | "done" | "review";

export interface Task {
  id: string;
  taskText: string;
  title?: string; // Alias for taskText used in Kanban
  description?: string;
  assignedTo: string | string[]; // Employee's UID or array of UIDs
  assignedBy: string; // Admin's UID
  assigned_to?: string | string[]; // Alias for assignedTo
  assigned_by?: string; // Alias for assignedBy
  createdBy: string; // Alias for assignedBy used in Kanban
  priority: "low" | "medium" | "high" | "critical";
  status: TaskStatus;
  dueDate?: string;
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  created_at?: Timestamp | FieldValue; // Alias for createdAt
  updated_at?: Timestamp | FieldValue; // Alias for updatedAt
  progress?: number;
  startDate?: string;
  completedAt?: Timestamp | FieldValue | null;
  mentionedUsers?: string[];
  attachments?: { name: string; size: string; url: string; }[];
  teamId?: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  comment: string;
  commentedBy: string;
  commentedByName?: string;
  createdAt: Timestamp;
  mentionedUsers?: string[];
}

export interface TaskHistoryItem {
  id: string;
  taskId: string;
  message: string;
  performedBy: string;
  performedByName: string;
  createdAt: Timestamp;
}

const TASKS_COLLECTION = "tasks";

export async function createTask(
  taskText: string,
  description: string,
  assignedBy: string,
  assignedTo: string | string[],
  priority: string = "medium",
  startDate?: string,
  dueDate?: string,
  mentionedUsers?: string[],
  status: TaskStatus = "pending",
  attachments: { name: string; size: string; url: string; }[] = [],
  teamId: string = ""
) {
  // Validate payload before writing to Firestore
  CreateTaskSchema.parse({ taskText, description, assignedBy, assignedTo, priority, startDate, dueDate, mentionedUsers, status, attachments, teamId });
  const now = serverTimestamp();
  const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
    taskText,
    description,
    assignedTo,
    assignedBy,
    assigned_to: assignedTo,
    assigned_by: assignedBy,
    createdBy: assignedBy, // Ensure both exist for compatibility
    priority,
    status,
    progress: status === "completed" ? 100 : 0,
    startDate: startDate || null,
    dueDate: dueDate || null,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
    mentionedUsers: mentionedUsers || [],
    attachments: attachments,
    teamId: teamId || null,
  });

  // Trigger Notifications to the assignee(s)
  const taskPath = "/dashboard/your-tasks";
  const notificationOptions = {
    link: taskPath,
    type: "task" as const,
    fromUserId: assignedBy,
  };

  if (Array.isArray(assignedTo)) {
    for (const uid of assignedTo) {
      await createNotification(uid, "New Task Assigned", `You have been assigned a new task: "${taskText}"`, notificationOptions);
      
      // Email Notification
      const assignee = await getUserById(uid);
      if (assignee?.email) {
        await sendEmail(
          assignee.email,
          "New Task Assigned",
          `Hello ${assignee.name},\n\nYou have been assigned a new task: "${taskText}"\n\nPriority: ${priority}\nDue Date: ${dueDate || "Not set"}\n\nView it here: ${APP_URL}/dashboard/your-tasks`,
          `<p>Hello ${assignee.name},</p><p>You have been assigned a new task: <strong>"${taskText}"</strong></p><p><strong>Priority:</strong> ${priority}<br><strong>Due Date:</strong> ${dueDate || "Not set"}</p><p>View it here: <a href="${APP_URL}/dashboard/your-tasks">Dashboard</a></p>`
        );
      }
    }
  } else if (assignedTo) {
    await createNotification(assignedTo, "New Task Assigned", `You have been assigned a new task: "${taskText}"`, notificationOptions);
    
    // Email Notification
    const assignee = await getUserById(assignedTo);
    if (assignee?.email) {
      await sendEmail(
        assignee.email,
        "New Task Assigned",
        `Hello ${assignee.name},\n\nYou have been assigned a new task: "${taskText}"\n\nPriority: ${priority}\nDue Date: ${dueDate || "Not set"}\n\nView it here: ${APP_URL}/dashboard/your-tasks`,
        `<p>Hello ${assignee.name},</p><p>You have been assigned a new task: <strong>"${taskText}"</strong></p><p><strong>Priority:</strong> ${priority}<br><strong>Due Date:</strong> ${dueDate || "Not set"}</p><p>View it here: <a href="${APP_URL}/dashboard/your-tasks">Dashboard</a></p>`
      );
    }
  }

  if (mentionedUsers && mentionedUsers.length > 0) {
    for (const uid of mentionedUsers) {
      if (uid !== assignedBy && (!Array.isArray(assignedTo) ? uid !== assignedTo : !assignedTo.includes(uid))) {
        await createNotification(uid, "You were mentioned", `You were mentioned in a new task: "${taskText}"`, notificationOptions);
      }
    }
  }

  // Write audit log
  try {
    const creator = await getUserById(assignedBy);
    const creatorName = creator?.name || auth.currentUser?.displayName || auth.currentUser?.email || "Manager";
    await logActivityClient({
      action: "task_created",
      performedBy: assignedBy,
      performedByName: creatorName,
      targetId: docRef.id,
      targetType: "task",
      details: `Created task: "${taskText}" assigned to ${Array.isArray(assignedTo) ? assignedTo.join(', ') : assignedTo}.`,
      metadata: {
        taskText,
        assignedTo,
        priority,
        status,
        dueDate
      }
    });
  } catch (auditErr) {
    console.error("Failed to log createTask audit:", auditErr);
  }

  return docRef.id;
}

export async function updateTaskStatus(
  taskId: string, 
  status: TaskStatus,
  operatorId?: string,
  operatorName?: string
) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const now = serverTimestamp();
  
  const updates: Partial<Task> = {
    status,
    updatedAt: now,
    updated_at: now,
  };

  if (status === "completed") {
    updates.completedAt = now;
    updates.progress = 100;
  } else if (status === "pending") {
    updates.progress = 0;
    updates.completedAt = null;
  } else if (status === "in_progress") {
    updates.progress = 50;
    updates.completedAt = null;
  }

  await updateDoc(taskRef, updates);

  // Write audit log
  try {
    const user = auth.currentUser;
    const performedBy = operatorId || user?.uid || "system";
    const performedByName = operatorName || user?.displayName || user?.email || "Employee";
    await logActivityClient({
      action: "task_updated",
      performedBy,
      performedByName,
      targetId: taskId,
      targetType: "task",
      details: `Updated task status to: ${status}.`,
      metadata: { status }
    });
  } catch (auditErr) {
    console.error("Failed to log updateTaskStatus audit:", auditErr);
  }
}

export async function updateTaskProgress(
  taskId: string, 
  progress: number, 
  taskTitle: string = "A task", 
  assignedBy?: string,
  operatorId?: string,
  operatorName?: string
) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const now = serverTimestamp();
  
  const updates: Partial<Task> = {
    progress,
    updatedAt: now,
    updated_at: now,
  };
  
  if (progress >= 100) {
    updates.status = "completed";
    updates.completedAt = now;
    
    // Notify the admin who assigned it that it's complete
    if (assignedBy) {
      await createNotification(
        assignedBy, 
        "Task Completed", 
        `"${taskTitle}" has been marked as 100% complete!`,
        {
          link: "/dashboard/tasks-assigned",
          type: "task"
        }
      );
    }
    
  } else if (progress > 0 && progress < 100) {
    updates.status = "in_progress";
    updates.completedAt = null;
  } else if (progress === 0) {
    updates.status = "pending";
    updates.completedAt = null;
  }
  
  await updateDoc(taskRef, updates);

  // Write audit log
  try {
    const user = auth.currentUser;
    const performedBy = operatorId || user?.uid || "system";
    const performedByName = operatorName || user?.displayName || user?.email || "Employee";
    await logActivityClient({
      action: "task_updated",
      performedBy,
      performedByName,
      targetId: taskId,
      targetType: "task",
      details: `Updated task progress to: ${progress}%.`,
      metadata: { progress, status: updates.status || "in_progress" }
    });
  } catch (auditErr) {
    console.error("Failed to log updateTaskProgress audit:", auditErr);
  }
}

export async function startTask(taskId: string) {
  await updateTaskStatus(taskId, "in_progress");
}

export async function reopenTask(taskId: string) {
  await updateTaskStatus(taskId, "pending");
}

export async function deleteTask(
  taskId: string,
  operatorId?: string,
  operatorName?: string
) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(taskRef);

  // Write audit log
  try {
    const user = auth.currentUser;
    const performedBy = operatorId || user?.uid || "system";
    const performedByName = operatorName || user?.displayName || user?.email || "Employee";
    await logActivityClient({
      action: "task_deleted",
      performedBy,
      performedByName,
      targetId: taskId,
      targetType: "task",
      details: `Deleted task (ID: ${taskId}).`
    });
  } catch (auditErr) {
    console.error("Failed to log deleteTask audit:", auditErr);
  }
}

export async function addTaskComment(
  taskId: string, 
  comment: string, 
  commentedBy: string, 
  commentedByName?: string,
  taskTitle: string = "a task",
  taskAssignedBy?: string, // Admin
  taskAssignedTo?: string | string[], // Assignees
  mentionedUsers?: string[]
) {
  const commentsRef = collection(db, TASKS_COLLECTION, taskId, "comments");
  const now = serverTimestamp();
  await addDoc(commentsRef, {
    taskId,
    comment,
    commentedBy,
    commentedByName: commentedByName || "",
    createdAt: now,
    mentionedUsers: mentionedUsers || [],
  });

  // Notify the relevant parties
  const notifMsg = `"${taskTitle}": ${comment}`;
  const link = `/dashboard/your-tasks`; // generic fallback
  const commonOptions = {
    fromUserId: commentedBy,
    fromUserName: commentedByName,
    type: "task" as const,
  };

  if (taskAssignedBy && taskAssignedBy !== commentedBy) {
    // Notify Admin if employee commented
    await createNotification(
      taskAssignedBy, 
      "New Comment", 
      notifMsg, 
      { ...commonOptions, link: "/dashboard/tasks-assigned" }
    );
  }

  if (taskAssignedTo) {
    const assignees = Array.isArray(taskAssignedTo) ? taskAssignedTo : [taskAssignedTo];
    for (const uid of assignees) {
      if (uid !== commentedBy) {
        await createNotification(uid, "New Comment", notifMsg, { ...commonOptions, link });
      }
    }
  }

  if (mentionedUsers && mentionedUsers.length > 0) {
    for (const uid of mentionedUsers) {
      if (uid !== commentedBy) {
        await createNotification(uid, "You were mentioned", `You were mentioned in a comment on "${taskTitle}"`, { ...commonOptions, link });
      }
    }
  }
}

export function subscribeToTaskComments(taskId: string, callback: (comments: TaskComment[]) => void) {
  const commentsRef = collection(db, TASKS_COLLECTION, taskId, "comments");
  const q = query(commentsRef, orderBy("createdAt", "asc"));

  const cleanupMonitor = trackListener(`subscribeToTaskComments-${taskId}`);
  const unsub = onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TaskComment[];

    callback(comments);
  });
  
  return () => {
    unsub();
    cleanupMonitor();
  };
}

// Function to subscribe to tasks assigned to a specific user.
// Runs two parallel queries to support both legacy string and array assignedTo fields.
export function subscribeToUserTasks(
  userId: string,
  callback: (tasks: Task[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void,
  pageSize: number = 20,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null
) {
  // Query 1: legacy scalar assignment  (assignedTo == userId)
  let qScalar = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "==", userId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  if (lastVisibleDoc) {
    qScalar = query(qScalar, startAfter(lastVisibleDoc));
  }

  // Query 2: array-based multi-assignment  (assignedTo array-contains userId)
  let qArray = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "array-contains", userId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  if (lastVisibleDoc) {
    qArray = query(qArray, startAfter(lastVisibleDoc));
  }

  // Merge helper: deduplicate by id and sort by createdAt desc
  const merge = (scalar: Task[], array: Task[]): Task[] => {
    const seen = new Map<string, Task>();
    [...scalar, ...array].forEach(t => seen.set(t.id, t));
    return Array.from(seen.values()).sort((a, b) => {
      const tA = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      const tB = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      return tB - tA;
    });
  };

  let latestScalar: Task[] = [];
  let latestArray: Task[] = [];
  // lastDoc comes from the scalar query (primary pagination cursor)
  let lastScalarDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  const emit = () => {
    const merged = merge(latestScalar, latestArray);
    callback(merged, lastScalarDoc);
  };

  const cleanupMonitor = trackListener("subscribeToUserTasks");

  const unsubScalar = onSnapshot(qScalar, (snapshot) => {
    latestScalar = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
    lastScalarDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    emit();
  });

  const unsubArray = onSnapshot(qArray, (snapshot) => {
    latestArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
    emit();
  });

  return () => {
    unsubScalar();
    unsubArray();
    cleanupMonitor();
  };
}

// Function to subscribe to tasks assigned BY a specific admin
export function subscribeToTasksAssignedBy(
  adminId: string, 
  callback: (tasks: Task[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void,
  pageSize: number = 20,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null
) {
  let q = query(
    collection(db, TASKS_COLLECTION),
    where("assignedBy", "==", adminId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  if (lastVisibleDoc) {
    q = query(q, startAfter(lastVisibleDoc));
  }

  const cleanupMonitor = trackListener("subscribeToTasksAssignedBy");
  const unsub = onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(tasks, lastDoc);
  });
  return () => {
    unsub();
    cleanupMonitor();
  };
}

// Function to subscribe to ALL tasks (CEO/Admin view)
export function subscribeToAllTasks(
  callback: (tasks: Task[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void,
  pageSize: number = 20,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null
) {
  let q = query(
    collection(db, TASKS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  if (lastVisibleDoc) {
    q = query(q, startAfter(lastVisibleDoc));
  }

  const cleanupMonitor = trackListener("subscribeToAllTasks");
  const unsub = onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(tasks, lastDoc);
  });
  return () => {
    unsub();
    cleanupMonitor();
  };
}

// Function to subscribe to tasks created in the last N days
export function subscribeToRecentTasks(
  days: number,
  callback: (tasks: Task[]) => void
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const q = query(
    collection(db, TASKS_COLLECTION),
    where("createdAt", ">=", cutoffDate),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  const cleanupMonitor = trackListener(`subscribeToRecentTasks-${days}`);
  const unsub = onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];
    callback(tasks);
  });
  
  return () => {
    unsub();
    cleanupMonitor();
  };
}

// Subscribe to recent tasks relevant to a specific user (assigned to them OR by them)
export function subscribeToRecentTasksForUser(
  userId: string,
  days: number,
  callback: (tasks: Task[]) => void
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Query tasks assigned to user
  const qAssignedTo = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "array-contains", userId),
    where("createdAt", ">=", cutoffDate),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  // Query tasks assigned by user
  const qAssignedBy = query(
    collection(db, TASKS_COLLECTION),
    where("assignedBy", "==", userId),
    where("createdAt", ">=", cutoffDate),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  const merged = new Map<string, Task>();
  let latestTo: Task[] = [];
  let latestBy: Task[] = [];

  const emit = () => {
    merged.clear();
    [...latestTo, ...latestBy].forEach(t => merged.set(t.id, t));
    const result = Array.from(merged.values()).sort((a, b) => {
      const tA = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      const tB = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      return tB - tA;
    });
    callback(result);
  };

  const cleanupMonitor = trackListener(`subscribeToRecentTasksForUser-${userId}`);

  const unsubTo = onSnapshot(qAssignedTo, (snap) => {
    latestTo = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
    emit();
  });

  const unsubBy = onSnapshot(qAssignedBy, (snap) => {
    latestBy = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
    emit();
  });

  return () => { 
    unsubTo(); 
    unsubBy(); 
    cleanupMonitor();
  };
}

// Subscribe to ALL tasks a user is involved in (assigned to them OR assigned by them)
export function subscribeToAllTasksForUser(
  userId: string,
  callback: (tasks: Task[]) => void,
  limitCount?: number
) {
  const merged = new Map<string, Task>();
  let latestTo: Task[] = [];
  let latestToArray: Task[] = [];
  let latestBy: Task[] = [];

  const emit = () => {
    merged.clear();
    [...latestTo, ...latestToArray, ...latestBy].forEach(t => merged.set(t.id, t));
    const result = Array.from(merged.values()).sort((a, b) => {
      const tA = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      const tB = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      return tB - tA;
    });
    callback(result);
  };

  let qTo = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "==", userId)
  );

  let qToArray = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "array-contains", userId)
  );

  let qBy = query(
    collection(db, TASKS_COLLECTION),
    where("assignedBy", "==", userId)
  );

  if (limitCount) {
    qTo = query(qTo, limit(limitCount));
    qToArray = query(qToArray, limit(limitCount));
    qBy = query(qBy, limit(limitCount));
  }

  const cleanupMonitor = trackListener(`subscribeToAllTasksForUser-${userId}`);

  const unsubTo = onSnapshot(qTo, (snap) => {
    latestTo = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
    emit();
  });

  const unsubToArray = onSnapshot(qToArray, (snap) => {
    latestToArray = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
    emit();
  });

  const unsubBy = onSnapshot(qBy, (snap) => {
    latestBy = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
    emit();
  });

  return () => {
    unsubTo();
    unsubToArray();
    unsubBy();
    cleanupMonitor();
  };
}

// History tracking
export async function addTaskHistory(
  taskId: string,
  message: string,
  performedBy: string,
  performedByName: string
) {
  const historyRef = collection(db, TASKS_COLLECTION, taskId, "history");
  await addDoc(historyRef, {
    taskId,
    message,
    performedBy,
    performedByName,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToTaskHistory(taskId: string, callback: (history: TaskHistoryItem[]) => void) {
  const historyRef = collection(db, TASKS_COLLECTION, taskId, "history");
  const q = query(historyRef, orderBy("createdAt", "desc"));

  const cleanupMonitor = trackListener(`subscribeToTaskHistory-${taskId}`);
  const unsub = onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TaskHistoryItem[];
    callback(history);
  });
  
  return () => {
    unsub();
    cleanupMonitor();
  };
}

export function subscribeToAllTasksNoLimit(callback: (tasks: Task[]) => void, limitCount?: number) {
  let q = query(
    collection(db, TASKS_COLLECTION),
    orderBy("createdAt", "desc")
  );
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  
  const cleanupMonitor = trackListener(`subscribeToAllTasksNoLimit`);
  const unsub = onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];
    callback(tasks);
  });
  
  return () => {
    unsub();
    cleanupMonitor();
  };
}

