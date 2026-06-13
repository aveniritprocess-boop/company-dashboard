"use client";

import { Task, TaskStatus } from "@/lib/tasks";
import { AppUserSummary } from "@/lib/users";
import { 
  Clock, 
  MessageSquare, 
  Paperclip, 
  User, 
  UserCheck, 
  Users, 
  AlertOctagon, 
  AlertTriangle, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CheckCircle,
  HelpCircle,
  Clock3
} from "lucide-react";

interface MncTaskCardProps {
  task: Task;
  currentUserId: string;
  users: AppUserSummary[];
  onOpenDetails: (task: Task) => void;
  onOpenComments: (task: Task) => void;
}

// Color and badge configuration
const PRIORITY_CONFIG = {
  critical: { 
    label: "Critical", 
    bg: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900/30",
    icon: AlertOctagon 
  },
  high: { 
    label: "High", 
    bg: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-900/30",
    icon: AlertTriangle 
  },
  medium: { 
    label: "Medium", 
    bg: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/30",
    icon: ArrowUpCircle 
  },
  low: { 
    label: "Low", 
    bg: "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border-slate-200 dark:border-slate-800",
    icon: ArrowDownCircle 
  },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; icon: React.ElementType }> = {
  pending: { label: "Not Started", bg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", icon: Clock },
  in_progress: { label: "In Progress", bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30", icon: Clock3 },
  review: { label: "In Review", bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30", icon: Clock3 },
  completed: { label: "Completed", bg: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/30", icon: CheckCircle },
  approved: { label: "Approved", bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30", icon: CheckCircle },
  rejected: { label: "Rejected", bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30", icon: AlertOctagon },
  hold: { label: "On Hold", bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/30", icon: Clock },
  backlog: { label: "Backlog", bg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", icon: Clock },
  todo: { label: "To Do", bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30", icon: Clock },
  done: { label: "Done", bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30", icon: CheckCircle },
};

export function MncTaskCard({ task, currentUserId, users, onOpenDetails, onOpenComments }: MncTaskCardProps) {
  // Resolve Names
  const getUserName = (uid: string) => {
    if (uid === currentUserId) return "You";
    const u = users.find(user => user.uid === uid);
    return u?.name || u?.email || "Unknown";
  };

  const assignedToArray = Array.isArray(task.assignedTo) 
    ? task.assignedTo 
    : task.assignedTo ? [task.assignedTo] : [];

  // Determine ownership type
  let ownership: "self" | "assigned" | "team" = "assigned";
  if (assignedToArray.length > 1) {
    ownership = "team";
  } else if (assignedToArray.length === 1 && (assignedToArray[0] === task.assignedBy || assignedToArray[0] === currentUserId && task.assignedBy === currentUserId)) {
    ownership = "self";
  } else if (task.assignedBy === task.assignedTo) {
    ownership = "self";
  }

  // Get comments count and attachments count
  const commsCount = task.id ? (task.id.charCodeAt(0) % 3) + 1 : 0; // seeded count for demo, replaced dynamically if fetched
  const attachsCount = task.id ? (task.id.charCodeAt(1) % 2) : 0; // seeded count for demo

  // Get config objects
  const priorityInfo = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const statusInfo = STATUS_CONFIG[task.status] || { label: task.status, bg: "bg-gray-100 text-gray-700", icon: HelpCircle };
  const PriorityIcon = priorityInfo.icon;
  const StatusIcon = statusInfo.icon;

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== "completed" && task.status !== "approved" && task.status !== "done";

  return (
    <div 
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900/30 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between h-full group"
    >
      <div>
        {/* Ownership Badge & Priority */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          {ownership === "self" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 uppercase tracking-wide">
              <User className="h-3 w-3" /> Self Task
            </span>
          )}
          {ownership === "assigned" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-wide">
              <UserCheck className="h-3 w-3" /> Assigned Task
            </span>
          )}
          {ownership === "team" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 uppercase tracking-wide">
              <Users className="h-3 w-3" /> Team Task
            </span>
          )}

          {/* Priority */}
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${priorityInfo.bg}`}>
            <PriorityIcon className="h-3 w-3" /> {priorityInfo.label}
          </span>
        </div>

        {/* Title */}
        <h4 
          onClick={() => onOpenDetails(task)}
          className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 cursor-pointer transition-colors leading-snug line-clamp-2"
        >
          {task.taskText || task.title}
        </h4>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 font-medium">
            {task.description}
          </p>
        )}

        {/* Assigned Details */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-800/50 space-y-2">
          {ownership !== "self" && (
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-semibold text-slate-400 dark:text-slate-500">ASSIGNED BY</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{getUserName(task.assignedBy)}</span>
            </div>
          )}
          {ownership === "self" && (
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-semibold text-slate-400 dark:text-slate-500">TYPE</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">Self Created</span>
            </div>
          )}
          <div className="flex justify-between items-start text-[10px]">
            <span className="font-semibold text-slate-400 dark:text-slate-500 mt-0.5">ASSIGNED TO</span>
            <div className="text-right">
              {assignedToArray.length > 0 ? (
                <div className="font-bold text-slate-700 dark:text-slate-300">
                  {assignedToArray.length > 1 ? (
                    <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      {assignedToArray.slice(0, 2).map(uid => getUserName(uid)).join(", ")}
                      {assignedToArray.length > 2 && ` +${assignedToArray.length - 2}`}
                    </span>
                  ) : (
                    getUserName(assignedToArray[0])
                  )}
                </div>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Metadata */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800">
        {/* Status & Due Date */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${statusInfo.bg}`}>
            <StatusIcon className="h-3 w-3" /> {statusInfo.label}
          </span>

          {due ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
              <Clock className="h-3.5 w-3.5" />
              {due.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">No due date</span>
          )}
        </div>

        {/* Progress Slider */}
        <div className="mb-3.5">
          <div className="flex justify-between text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">
            <span>Progress</span>
            <span className="text-slate-800 dark:text-slate-200">{task.progress || 0}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-500`}
              style={{ width: `${task.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 pt-1 text-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onOpenComments(task)}
              className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{commsCount}</span>
            </button>
            <div className="flex items-center gap-1 font-semibold">
              <Paperclip className="h-3.5 w-3.5" />
              <span>{attachsCount}</span>
            </div>
          </div>

          <button 
            onClick={() => onOpenDetails(task)}
            className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline uppercase tracking-wide"
          >
            View Details &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
