import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TaskStatus = "pending" | "completed";

export interface Task {
  id: string;
  taskText: string;
  assignedTo: string; // Employee's Firebase Authentication UID
  assignedBy: string; // Admin's UID or Name
  status: TaskStatus;
  createdAt: Timestamp;
}

const TASKS_COLLECTION = "tasks";

export async function createTask(
  taskText: string,
  assignedBy: string,
  assignedTo: string
) {
  await addDoc(collection(db, TASKS_COLLECTION), {
    taskText,
    assignedTo,
    assignedBy,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, {
    status,
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

