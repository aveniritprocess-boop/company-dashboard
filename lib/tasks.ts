import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  dueDate: string;
  assignedTo: string[]; // Array of User UIDs
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Subcollection logic: users/{uid}/tasks is for PERSONAL tasks.
// But valid "Jira-style" usually means SHARED tasks in a project or team.
// The prompt says "Sidebar shows only relevant tasks", implying a global or team context 
// where we filter by assignedTo.
// However, the previous TaskManager used `users/{uid}/tasks`.
// To support "Assigned to multiple users" and "Collaborative", we should probably use a top-level `tasks` collection
// OR `teams/{teamId}/tasks`.
// Given the complexity of migrating to teams right now without explicit team context in the UI, 
// let's create a top-level `tasks` collection and filter by `assignedTo` or `createdBy`.
// This allows true collaboration (assigning others).

const TASKS_COLLECTION = "tasks";

export async function createTask(
  title: string, 
  description: string, 
  createdBy: string, 
  assignedTo: string[] = [],
  priority: "low" | "medium" | "high" = "medium",
  dueDate: string = ""
) {
  await addDoc(collection(db, TASKS_COLLECTION), {
    title,
    description,
    status: "backlog",
    priority,
    dueDate,
    assignedTo: assignedTo.length > 0 ? assignedTo : [createdBy], // Default to creator if empty
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function assignTask(taskId: string, userIds: string[]) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, {
    assignedTo: userIds,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(taskId: string) {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(taskRef);
}

// Function to subscribe to tasks where user is assignee OR creator
export function subscribeToUserTasks(userId: string, callback: (tasks: Task[]) => void) {
  // Firestore OR queries are limited. 
  // We want: assignedTo array-contains userId OR createdBy == userId.
  // We might need two queries or one broad query if security rules allow.
  // For simplicity and "My Tasks" view:
  // Let's query where `assignedTo` array-contains `userId`.
  
  const q = query(
    collection(db, TASKS_COLLECTION),
    where("assignedTo", "array-contains", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];
    callback(tasks);
  });
}
