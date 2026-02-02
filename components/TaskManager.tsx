"use client";

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import { Trash2, Plus, Calendar, Flag, CheckCircle2, Circle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed";
  priority: "low" | "medium" | "high";
  dueDate: string;
  createdAt: any;
}

interface TaskManagerProps {
    context?: 'personal' | 'team' | 'project';
    contextId?: string; // userId, teamId, or projectId
}

export function TaskManager({ context = 'personal', contextId }: TaskManagerProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  
  // Determine collection path
  const getCollectionPath = () => {
      if (context === 'personal') return `users/${user?.uid}/tasks`;
      // Note: For teams and projects, we might want top-level collections 
      // or subcollections. Let's stick to subcollections for consistency if possible,
      // or top-level 'tasks' with a field 'contextId'.
      // Given the prompt "projects/{projectId}/tasks/{taskId}", we use subcollections.
      if (context === 'project' && contextId) return `projects/${contextId}/tasks`;
      // For teams, maybe "teams/{teamId}/tasks"? The prompt didn't strictly specify team tasks, 
      // but said "Track tasks and todos per project". 
      // However, "Admins and Managers: Can view and manage tasks and todos of all team members" implies visibility.
      // Let's assume generic task support.
      if (context === 'team' && contextId) return `teams/${contextId}/tasks`;
      
      return null;
  }

  useEffect(() => {
    if (!user) return;
    const path = getCollectionPath();
    if (!path) return;
    
    setError(null);

    const q = query(
      collection(db, path),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasksData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Task[];
        setTasks(tasksData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching tasks:", err);
        setError("Failed to load tasks.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, context, contextId]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = getCollectionPath();
    if (!title.trim() || !user || !path) return;
    setError(null);

    try {
      await addDoc(collection(db, path), {
        title,
        description,
        status: "pending",
        priority,
        dueDate,
        createdAt: serverTimestamp(),
        createdBy: user.uid // Track who created it
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setIsFormOpen(false);
    } catch (error: any) {
      console.error("Error adding task: ", error);
      setError("Failed to create task.");
    }
  };

  const updateStatus = async (id: string,  newStatus: "pending" | "in-progress" | "completed") => {
      const path = getCollectionPath();
      if(!user || !path) return;
      try {
          await updateDoc(doc(db, path, id), {
              status: newStatus
          });
      } catch (error: any) {
          console.error("Error updating status:", error);
          setError("Failed to update status.");
      }
  }

  const deleteTask = async (id: string) => {
    const path = getCollectionPath();
    if (!user || !path) return;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error: any) {
      console.error("Error deleting task: ", error);
      setError("Failed to delete task.");
    }
  };

  const priorityColor = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const statusColor = {
      pending: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      "in-progress": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
      completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
          {error}
        </div>
      )}

      {isFormOpen && (
        <form onSubmit={addTask} className="rounded-lg border bg-white dark:bg-gray-800 p-4 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
           <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</label>
                   <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  />
               </div>
           </div>
           <div className="flex justify-end gap-2">
               <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
               >
                   Cancel
               </button>
               <button
                type="submit"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
               >
                   Create Task
               </button>
           </div>
        </form>
      )}

      {loading ? (
           <div className="text-center py-10">Loading tasks...</div>
      ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Task
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Priority
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Due Date
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                  {tasks.length === 0 && !error && (
                      <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                              No tasks found. Create one to get started!
                          </td>
                      </tr>
                  )}
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[task.status]}`}>
                            {task.status}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{task.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColor[task.priority]}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                       {task.dueDate || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                            {task.status !== 'completed' && (
                                <button
                                    onClick={() => updateStatus(task.id, 'completed')}
                                    title="Mark as completed"
                                    className="text-green-600 hover:text-green-900 dark:hover:text-green-400"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={() => deleteTask(task.id)}
                                title="Delete task"
                                className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}
    </div>
  );
}
