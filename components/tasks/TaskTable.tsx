"use client";

import { useState } from "react";
import { Task, updateTaskProgress, startTask, reopenTask, deleteTask } from "@/lib/tasks";
import { CheckCircle2, Trash2, Play, RotateCcw, AlertCircle, Eye } from "lucide-react";
import { AppUserSummary } from "@/lib/users";
import { TaskDetailsModal } from "./TaskDetailsModal";

interface TaskTableProps {
  tasks: Task[];
  currentUserId: string;
  currentUserRole: string | undefined;
  currentUserName?: string;
  users?: AppUserSummary[]; // Optional list of users to map UIDs to names
}

export function TaskTable({ tasks, currentUserId, currentUserRole, currentUserName, users = [] }: TaskTableProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const getUserName = (uid: string | string[] | undefined) => {
    if (!uid) return "Unassigned";
    if (Array.isArray(uid)) {
      if (uid.length === 0) return "Unassigned";
      return uid.map(id => id === currentUserId ? (currentUserName || "You") : (users.find(u => u.uid === id)?.name || users.find(u => u.uid === id)?.email || "Unknown")).join(", ");
    }
    return uid === currentUserId ? (currentUserName || "You") : (users.find(u => u.uid === uid)?.name || users.find(u => u.uid === uid)?.email || "Unknown");
  };

  const handleAction = async (taskId: string, action: () => Promise<void>) => {
    setLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      await action();
    } finally {
      setLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-900/50 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th scope="col" className="px-6 py-4">Date</th>
            <th scope="col" className="px-6 py-4">Assigned Task</th>
            <th scope="col" className="px-6 py-4">Assignee</th>
            <th scope="col" className="px-6 py-4">Status</th>
            <th scope="col" className="px-6 py-4">Due Date</th>
            <th scope="col" className="px-6 py-4">Progress</th>
            <th scope="col" className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isAssignedToMe = Array.isArray(task.assignedTo) 
              ? task.assignedTo.includes(currentUserId) 
              : task.assignedTo === currentUserId;
            
            const isAdminOrCEO = currentUserRole === "admin" || currentUserRole === "ceo";
            const canEdit = isAssignedToMe || isAdminOrCEO || currentUserRole === "manager";
            const canDelete = isAdminOrCEO && task.status === "completed";

            const isOverdue = (() => {
              if (task.status === "completed" || !task.dueDate) return false;
              const due = new Date(task.dueDate);
              const now = new Date();
              due.setHours(0,0,0,0);
              now.setHours(0,0,0,0);
              return now > due;
            })();

            const isTaskLoading = loading[task.id];
            const progress = task.progress || 0;
            const assigneeName = getUserName(task.assignedTo);
            const createdDate = task.startDate ? new Date(task.startDate).toLocaleDateString() : (task.createdAt && typeof task.createdAt === 'object' && 'toDate' in task.createdAt ? (task.createdAt as { toDate: () => Date }).toDate().toLocaleDateString() : "Unknown");
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not set";

            return (
              <tr key={task.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isTaskLoading ? 'opacity-60 pointer-events-none' : ''}`}>
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {createdDate}
                </td>
                <td className="px-6 py-4 text-gray-900 dark:text-gray-100 max-w-xs truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setSelectedTask(task)}>
                  <div className="font-bold">{task.taskText || task.title}</div>
                  {task.description && <div className="text-xs text-gray-500 truncate mt-1">{task.description}</div>}
                </td>
                <td className="px-6 py-4">
                  {assigneeName}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize tracking-wide ${
                      task.status === "completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" 
                      : task.status === "in_progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}>
                      {task.status === 'pending' ? 'Not Started' : task.status.replace("_", " ")}
                    </span>
                    {isOverdue && (
                      <span className="text-xs text-red-600 dark:text-red-400 flex items-center" title="Overdue">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </td>
                <td className={`px-6 py-4 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                  {dueDate}
                </td>
                <td className="px-6 py-4">
                  <div className="w-full min-w-[100px] bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-500 ease-out ${progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-500'}`} 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="text-[10px] mt-1 text-center font-medium text-gray-600 dark:text-gray-400">{progress}%</div>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => setSelectedTask(task)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="View Details">
                    <Eye className="h-4 w-4" />
                  </button>
                  {task.status === "pending" && canEdit && (
                    <button onClick={() => handleAction(task.id, () => startTask(task.id))} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Start Task">
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {task.status === "in_progress" && canEdit && (
                    <button onClick={() => handleAction(task.id, () => updateTaskProgress(task.id, 100, task.taskText || task.title, task.assignedBy))} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Mark Completed">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  {task.status === "completed" && canEdit && (
                    <button onClick={() => handleAction(task.id, () => reopenTask(task.id))} className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Reopen Task">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                  {task.status === "completed" && canDelete && (
                    <button onClick={() => handleAction(task.id, () => deleteTask(task.id))} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete Task">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                No tasks available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          currentUserId={currentUserId}
          currentUserName={currentUserName || "User"}
          currentUserRole={currentUserRole}
          users={users}
        />
      )}
    </div>
  );
}
