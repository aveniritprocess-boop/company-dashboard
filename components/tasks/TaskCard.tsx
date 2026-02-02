"use client";

import { Task, TaskStatus, updateTaskStatus, deleteTask } from "@/lib/tasks";
import { format } from "date-fns";
import { MoreHorizontal, Trash2, ArrowRight, ArrowLeft, Clock } from "lucide-react";
import { useState } from "react";

interface TaskCardProps {
  task: Task;
  currentUserId: string;
}

const statusOrder: TaskStatus[] = ["backlog", "todo", "in_progress", "done"];

export function TaskCard({ task, currentUserId }: TaskCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const priorityColor = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const handleMove = async (direction: "next" | "prev") => {
    setLoading(true);
    const currentIndex = statusOrder.indexOf(task.status);
    const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < statusOrder.length) {
      await updateTaskStatus(task.id, statusOrder[newIndex]);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask(task.id);
    }
  };

  const canEdit = task.assignedTo.includes(currentUserId) || task.createdBy === currentUserId;

  return (
    <div className={`
        bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 
        hover:shadow-md transition-shadow group relative
        ${loading ? 'opacity-50 pointer-events-none' : ''}
    `}>
      <div className="flex justify-between items-start mb-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[task.priority]}`}>
          {task.priority}
        </span>
        <div className="relative">
             {canEdit && (
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    <MoreHorizontal className="h-4 w-4" />
                </button>
             )}
             {isMenuOpen && (
                 <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                    <button 
                        onClick={handleDelete}
                        className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                    >
                        <Trash2 className="h-3 w-3" /> Delete
                    </button>
                 </div>
             )}
        </div>
      </div>
      
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
        {task.title}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-3">
        {task.description}
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-1">
             {task.dueDate ? (
                 <>
                    <Clock className="h-3 w-3" />
                    <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                 </>
             ) : (
                <span>No due date</span>
             )}
        </div>
        
        {/* Simple Move Controls for Kanban */}
        {canEdit && (
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {task.status !== 'backlog' && (
                    <button 
                        onClick={() => handleMove("prev")}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500"
                        title="Move back"
                    >
                        <ArrowLeft className="h-3 w-3" />
                    </button>
                )}
                {task.status !== 'done' && (
                    <button 
                        onClick={() => handleMove("next")}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500"
                        title="Move forward"
                    >
                        <ArrowRight className="h-3 w-3" />
                    </button>
                )}
            </div>
        )}
      </div>
      
      {/* Assignee Avatars (Mock for now, using initials) */}
      {task.assignedTo.length > 0 && (
         <div className="flex -space-x-2 mt-3 overflow-hidden">
             {task.assignedTo.map(uid => (
                 <div key={uid} className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] text-indigo-700 dark:text-indigo-300 font-bold" title={uid}>
                    {uid.substring(0, 2).toUpperCase()}
                 </div>
             ))}
         </div>
      )}
    </div>
  );
}
