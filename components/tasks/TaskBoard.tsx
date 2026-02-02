"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Task, subscribeToUserTasks, createTask } from "@/lib/tasks";
import { TaskColumn } from "./TaskColumn";
import { Plus, Loader2 } from "lucide-react";

export function TaskBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to tasks
    const unsubscribe = subscribeToUserTasks(user.uid, (fetchedTasks) => {
      setTasks(fetchedTasks);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle.trim()) return;
    
    try {
      await createTask(
        newTaskTitle, 
        newTaskDesc, 
        user.uid, 
        [user.uid], // Assign to self by default
        newTaskPriority
      );
      setIsModalOpen(false);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
    } catch (error) {
      console.error("Failed to create task", error);
      alert("Failed to create task");
    }
  };

  if(!user) return null;

  if (loading) {
     return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  // Group tasks by status
  const backlogTasks = tasks.filter(t => t.status === "backlog");
  const todoTasks = tasks.filter(t => t.status === "todo");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const doneTasks = tasks.filter(t => t.status === "done");

  return (
    <div className="h-full flex flex-col gap-6">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center">
         <div className="flex items-center gap-2">
             {/* Filter controls could go here */}
         </div>
         <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
         >
             <Plus className="h-4 w-4" /> New Task
         </button>
      </div>

      {/* Kanban Board Grid */}
      <div className="flex-1 overflow-x-auto pb-4">
         <div className="flex gap-6 h-full min-w-[1000px]">
            <TaskColumn title="Backlog" status="backlog" tasks={backlogTasks} currentUserId={user.uid} />
            <TaskColumn title="To Do" status="todo" tasks={todoTasks} currentUserId={user.uid} />
            <TaskColumn title="In Progress" status="in_progress" tasks={inProgressTasks} currentUserId={user.uid} />
            <TaskColumn title="Done" status="done" tasks={doneTasks} currentUserId={user.uid} />
         </div>
      </div>

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Create New Task</h3>
                <form onSubmit={handleCreateTask} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                        <input 
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea 
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                            rows={3}
                            value={newTaskDesc}
                            onChange={(e) => setNewTaskDesc(e.target.value)}
                            placeholder="Details..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                        <select 
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                        >
                            Create Field
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
