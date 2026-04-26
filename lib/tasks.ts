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
  DocumentData
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createNotification, sendEmail } from "./notifications";
import { getUserById } from "./users";

export type TaskStatus = "pending" | "completed" | "backlog" | "todo" | "in_progress" | "done";

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
  priority: "low" | "medium" | "high";
  status: TaskStatus;
  dueDate?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  created_at?: Timestamp; // Alias for createdAt
  updated_at?: Timestamp; // Alias for updatedAt
  progress?: number;
  startDate?: string;
  completedAt?: Timestamp | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  comment: string;
  commentedBy: string;
  commentedByName?: string;
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
  dueDate?: string
) {
  const now = serverTimestamp();
  await addDoc(collection(db, TASKS_COLLECTION), {
    taskText,
    description,
    assignedTo,
    assignedBy,
    assigned_to: assignedTo,
    assigned_by: assignedBy,
    createdBy: assignedBy, // Ensure both exist for compatibility
    priority,
    status: "pending",
    progress: 0,
    startDate: startDate || null,
    dueDate: dueDate || null,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
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
          `Hello ${assignee.name},\n\nYou have been assigned a new task: "${taskText}"\n\nPriority: ${priority}\nDue Date: ${dueDate || "Not set"}\n\nView it here: https://company-dashboard-avenirit.web.app/dashboard/your-tasks`,
          `<p>Hello ${assignee.name},</p><p>You have been assigned a new task: <strong>"${taskText}"</strong></p><p><strong>Priority:</strong> ${priority}<br><strong>Due Date:</strong> ${dueDate || "Not set"}</p><p>View it here: <a href="https://company-dashboard-avenirit.web.app/dashboard/your-tasks">Dashboard</a></p>`
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
        `Hello ${assignee.name},\n\nYou have been assigned a new task: "${taskText}"\n\nPriority: ${priority}\nDue Date: ${dueDate || "Not set"}\n\nView it here: https://company-dashboard-avenirit.web.app/dashboard/your-tasks`,
        `<p>Hello ${assignee.name},</p><p>You have been assigned a new task: <strong>"${taskText}"</strong></p><p><strong>Priority:</strong> ${priority}<br><strong>Due Date:</strong> ${dueDate || "Not set"}</p><p>View it here: <a href="https://company-dashboard-avenirit.web.app/dashboard/your-tasks">Dashboard</a></p>`
      );
    }
  }
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const now = serverTimestamp();
  
  const updates: any = {
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
  }

  await updateDoc(taskRef, updates);
}

export async function updateTaskProgress(taskId: string, progress: number, taskTitle: string = "A task", assignedBy?: string) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const now = serverTimestamp();
  
  const updates: any = {
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
          link: "/dashboard/task-given-by-sir",
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
}

export async function startTask(taskId: string) {
  await updateTaskStatus(taskId, "in_progress");
}

export async function reopenTask(taskId: string) {
  await updateTaskStatus(taskId, "pending");
}

export async function deleteTask(taskId: string) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(taskRef);
}

export async function addTaskComment(
  taskId: string, 
  comment: string, 
  commentedBy: string, 
  commentedByName?: string,
  taskTitle: string = "a task",
  taskAssignedBy?: string, // Admin
  taskAssignedTo?: string | string[] // Assignees
) {
  const commentsRef = collection(db, TASKS_COLLECTION, taskId, "comments");
  const now = serverTimestamp();
  await addDoc(commentsRef, {
    taskId,
    comment,
    commentedBy,
    commentedByName: commentedByName || "",
    createdAt: now,
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
      { ...commonOptions, link: "/dashboard/task-given-by-sir" }
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
}

export function subscribeToTaskComments(taskId: string, callback: (comments: TaskComment[]) => void) {
  const commentsRef = collection(db, TASKS_COLLECTION, taskId, "comments");
  const q = query(commentsRef);

  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TaskComment[];

    // Sort ascending by creation time
    comments.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeA - timeB;
    });

    callback(comments);
  });
}

// Function to subscribe to tasks assigned to a specific user
export function subscribeToUserTasks(
  userId: string, 
  callback: (tasks: Task[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void,
  pageSize: number = 20,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null
) {
  let q = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "==", userId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  if (lastVisibleDoc) {
    q = query(q, startAfter(lastVisibleDoc));
  }

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(tasks, lastDoc);
  });
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

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(tasks, lastDoc);
  });
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

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(tasks, lastDoc);
  });
}
