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
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
}

const TASKS_COLLECTION = "tasks";

export async function createTask(
  taskText: string,
  description: string,
  assignedBy: string,
  assignedTo: string | string[],
  priority: string = "medium"
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
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
  });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const now = serverTimestamp();
  await updateDoc(taskRef, {
    status,
    updatedAt: now,
    updated_at: now,
  });
}

export async function deleteTask(taskId: string) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(taskRef);
}

// Function to subscribe to tasks assigned to a specific user
export function subscribeToUserTasks(userId: string, callback: (tasks: Task[]) => void) {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data
      };
    }) as Task[];

    // Sort client-side to avoid Firestore index requirement
    tasks.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    callback(tasks);
  });
}

// Function to subscribe to tasks assigned BY a specific admin
export function subscribeToTasksAssignedBy(adminId: string, callback: (tasks: Task[]) => void) {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where("assignedBy", "==", adminId)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    // Sort client-side
    tasks.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    callback(tasks);
  });
}

// Function to subscribe to ALL tasks (CEO/Admin view)
export function subscribeToAllTasks(callback: (tasks: Task[]) => void) {
  const q = query(
    collection(db, TASKS_COLLECTION)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    // Sort client-side
    tasks.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    callback(tasks);
  });
}
