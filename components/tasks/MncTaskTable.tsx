"use client";

import { useState, useMemo, useCallback } from "react";
import { Task } from "@/lib/tasks";
import { AppUserSummary } from "@/lib/users";
import { 
  ArrowUpDown, 
  MessageSquare, 
  Eye
} from "lucide-react";

interface MncTaskTableProps {
  tasks: Task[];
  currentUserId: string;
  users: AppUserSummary[];
  onOpenDetails: (task: Task) => void;
  onOpenComments: (task: Task) => void;
}

type SortField = "id" | "title" | "assignedBy" | "assignedTo" | "priority" | "status" | "dueDate" | "progress" | "updatedAt";
type SortOrder = "asc" | "desc";

const PRIORITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };
const STATUS_ORDER = {
  pending: 1,
  todo: 2,
  in_progress: 3,
  review: 4,
  hold: 5,
  completed: 6,
  approved: 7,
  rejected: 8,
  backlog: 9,
  done: 10
};

export function MncTaskTable({ tasks, currentUserId, users, onOpenDetails, onOpenComments }: MncTaskTableProps) {
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // User names resolver
  const getUserName = useCallback((uid: string | string[] | undefined) => {
    if (!uid) return "Unassigned";
    if (Array.isArray(uid)) {
      if (uid.length === 0) return "Unassigned";
      return uid.map(id => id === currentUserId ? "You" : (users.find(u => u.uid === id)?.name || users.find(u => u.uid === id)?.email || "Unknown")).join(", ");
    }
    return uid === currentUserId ? "You" : (users.find(u => u.uid === uid)?.name || users.find(u => u.uid === uid)?.email || "Unknown");
  }, [currentUserId, users]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Status config
  const statusColors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30",
    review: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
    completed: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
    rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30",
    hold: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
    backlog: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    todo: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
    done: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
  };

  const statusLabels: Record<string, string> = {
    pending: "Not Started",
    in_progress: "In Progress",
    review: "In Review",
    completed: "Completed",
    approved: "Approved",
    rejected: "Rejected",
    hold: "On Hold",
    backlog: "Backlog",
    todo: "To Do",
    done: "Done",
  };

  const priorityColors: Record<string, string> = {
    critical: "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200 dark:border-red-900/20",
    high: "bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border-orange-200 dark:border-orange-900/20",
    medium: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200 dark:border-blue-900/20",
    low: "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border-slate-200 dark:border-slate-800",
  };

  // Convert Firebase Timestamp/Date
  const getTimestamp = (val: unknown) => {
    if (!val) return 0;
    if (typeof val === "object" && val !== null && "toMillis" in val) {
      return (val as { toMillis: () => number }).toMillis();
    }
    if (val instanceof Date) return val.getTime();
    if (typeof val === "string") return new Date(val).getTime();
    return 0;
  };

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    const data = [...tasks];
    data.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "id":
          valA = a.id;
          valB = b.id;
          break;
        case "title":
          valA = (a.taskText || a.title || "").toLowerCase();
          valB = (b.taskText || b.title || "").toLowerCase();
          break;
        case "assignedBy":
          valA = getUserName(a.assignedBy).toLowerCase();
          valB = getUserName(b.assignedBy).toLowerCase();
          break;
        case "assignedTo":
          valA = getUserName(a.assignedTo).toLowerCase();
          valB = getUserName(b.assignedTo).toLowerCase();
          break;
        case "priority":
          valA = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] || 0;
          valB = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] || 0;
          break;
        case "status":
          valA = STATUS_ORDER[a.status as keyof typeof STATUS_ORDER] || 0;
          valB = STATUS_ORDER[b.status as keyof typeof STATUS_ORDER] || 0;
          break;
        case "dueDate":
          valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case "progress":
          valA = a.progress || 0;
          valB = b.progress || 0;
          break;
        case "updatedAt":
          valA = getTimestamp(a.updatedAt || a.createdAt);
          valB = getTimestamp(b.updatedAt || b.createdAt);
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [tasks, sortField, sortOrder, getUserName]);

  return (
    <div className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("id")}>
                <div className="flex items-center gap-1.5">
                  Task ID <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("title")}>
                <div className="flex items-center gap-1.5">
                  Task Name <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("assignedBy")}>
                <div className="flex items-center gap-1.5">
                  Assigned By <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("assignedTo")}>
                <div className="flex items-center gap-1.5">
                  Assigned To <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("priority")}>
                <div className="flex items-center gap-1.5">
                  Priority <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("status")}>
                <div className="flex items-center gap-1.5">
                  Status <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("dueDate")}>
                <div className="flex items-center gap-1.5">
                  Due Date <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("progress")}>
                <div className="flex items-center gap-1.5">
                  Progress <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50" onClick={() => handleSort("updatedAt")}>
                <div className="flex items-center gap-1.5">
                  Last Updated <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3.5 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80 text-xs">
            {sortedTasks.map(task => {
              const shortId = `#T-${task.id.slice(0, 5).toUpperCase()}`;
              const pColor = priorityColors[task.priority] || "bg-slate-50 text-slate-700";
              const sColor = statusColors[task.status] || "bg-slate-50 text-slate-700";
              const sLabel = statusLabels[task.status] || task.status;
              const assignees = getUserName(task.assignedTo);
              const assigner = task.assignedBy === currentUserId && task.assignedTo === currentUserId ? "Self Task" : getUserName(task.assignedBy);

              const lastUp = task.updatedAt || task.createdAt;
              const lastUpStr = lastUp ? new Date(getTimestamp(lastUp)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
              const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "No due date";

              const due = task.dueDate ? new Date(task.dueDate) : null;
              const isOverdue = due && due < new Date() && task.status !== "completed" && task.status !== "approved" && task.status !== "done";

              return (
                <tr 
                  key={task.id} 
                  className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 transition-colors group cursor-pointer"
                  onClick={() => onOpenDetails(task)}
                >
                  {/* Task ID */}
                  <td className="px-6 py-4 whitespace-nowrap font-black text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {shortId}
                  </td>

                  {/* Task Name */}
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 max-w-xs truncate">
                    <span className="group-hover:underline">{task.taskText || task.title}</span>
                    {task.description && (
                      <p className="text-[10px] text-slate-400 truncate font-medium mt-0.5" title={task.description}>
                        {task.description}
                      </p>
                    )}
                  </td>

                  {/* Assigned By */}
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-600 dark:text-slate-400">
                    {assigner}
                  </td>

                  {/* Assigned To */}
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                    {assignees}
                  </td>

                  {/* Priority */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${pColor}`}>
                      {task.priority}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${sColor}`}>
                      {sLabel}
                    </span>
                  </td>

                  {/* Due Date */}
                  <td className="px-6 py-4 whitespace-nowrap font-semibold">
                    <span className={isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}>
                      {dueStr}
                    </span>
                  </td>

                  {/* Progress */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600"
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 text-[10px]">{task.progress || 0}%</span>
                    </div>
                  </td>

                  {/* Last Updated */}
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-500 dark:text-slate-400">
                    {lastUpStr}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => onOpenComments(task)}
                        title="Comments"
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => onOpenDetails(task)}
                        title="View Details"
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-semibold italic">
                  No tasks matches your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
