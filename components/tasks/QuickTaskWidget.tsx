"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { 
  Task, 
  subscribeToAllTasksNoLimit, 
  subscribeToAllTasksForUser 
} from "@/lib/tasks";
import { getAllUsers, AppUserSummary } from "@/lib/users";
import { 
  Plus, 
  Eye, 
  MessageSquare,
  ChevronRight,
  Loader2
} from "lucide-react";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailsModal } from "./TaskDetailsModal";
import { TaskCommentPanel } from "./TaskCommentPanel";
import Link from "next/link";

export function QuickTaskWidget() {
  const { user, role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Overlay state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentTask, setCommentTask] = useState<Task | null>(null);


  const isAdmin = role === "admin" || role === "ceo" || role === "md" || role === "super_admin";

  // Load all users for list & autocomplete
  useEffect(() => {
    getAllUsers().then(setUsers).catch(console.error);
  }, []);

  // Subscribe to tasks in real time
  useEffect(() => {
    if (!user) return;
    Promise.resolve().then(() => setLoading(true));

    // Safety fallback timer to prevent UI stuck in loading state if network snapshot is delayed
    const timer = setTimeout(() => setLoading(false), 2500);

    let unsub: () => void;
    if (isAdmin) {
      // Admins/CEO see all tasks globally
      unsub = subscribeToAllTasksNoLimit((data) => {
        setTasks(data);
        setLoading(false);
        clearTimeout(timer);
      });
    } else {
      // Managers and employees see only their own tasks
      unsub = subscribeToAllTasksForUser(user.uid, (data) => {
        setTasks(data);
        setLoading(false);
        clearTimeout(timer);
      });
    }

    return () => {
      clearTimeout(timer);
      unsub?.();
    };
  }, [user, role, isAdmin]);

  // Resolving names dictionary
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => m.set(u.uid, u.name || u.email || u.uid));
    return m;
  }, [users]);

  // Computations
  const stats = useMemo(() => {
    const currentUid = user?.uid || "";

    // My Pending Tasks: Assigned to me, status not completed
    const myPending = tasks.filter((t) => {
      const arr = Array.isArray(t.assignedTo) ? t.assignedTo : t.assignedTo ? [t.assignedTo] : [];
      const isAssignee = arr.includes(currentUid);
      const isNotCompleted = t.status !== "completed" && t.status !== "approved" && t.status !== "done";
      return isAssignee && isNotCompleted;
    });

    // Overdue Tasks: Status not completed & due date < now
    const overdue = tasks.filter((t) => {
      if (t.status === "completed" || t.status === "approved" || t.status === "done") return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    });

    // Completed Tasks: Status completed, approved, done
    const completed = tasks.filter(
      (t) => t.status === "completed" || t.status === "approved" || t.status === "done"
    );

    const completionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

    return {
      total: tasks.length,
      myPendingCount: myPending.length,
      overdueCount: overdue.length,
      completedCount: completed.length,
      completionRate
    };
  }, [tasks, user]);

  // Top 4 recent tasks sorted by updatedAt/createdAt
  const recentTasks = useMemo(() => {
    const getTaskTime = (t: Task) => {
      if (t.updatedAt) {
        return typeof t.updatedAt === "object" && "toMillis" in t.updatedAt
          ? (t.updatedAt as unknown as { toMillis: () => number }).toMillis()
          : new Date(t.updatedAt as unknown as string | number | Date).getTime();
      }
      if (t.createdAt) {
        return typeof t.createdAt === "object" && "toMillis" in t.createdAt
          ? (t.createdAt as unknown as { toMillis: () => number }).toMillis()
          : new Date(t.createdAt as unknown as string | number | Date).getTime();
      }
      return 0;
    };

    return [...tasks]
      .sort((a, b) => getTaskTime(b) - getTaskTime(a))
      .slice(0, 4);
  }, [tasks]);

  const STATUS_BADGES: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
    review: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
    approved: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30"
  };

  // PRIORITY_COLORS removed (unused)

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center h-48 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
        <span className="text-xs text-slate-400 font-medium">Initializing Task Dashboard Command...</span>
      </div>
    );
  }

  // Circular Gauge Calculations
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.completionRate / 100) * circumference;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Command Controller Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/50 flex flex-col justify-between min-h-[220px] relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Quick Actions Hub</span>
          </div>
          <h3 className="text-lg font-black tracking-tight leading-snug">Task Command Card</h3>
          <p className="text-xs text-indigo-200 mt-1 leading-relaxed max-w-[200px]">
            Instantly assign workflows, view progress metrics, and manage pending deliverables.
          </p>
        </div>

        <div className="mt-5 relative z-10 flex items-center justify-between gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 bg-white text-indigo-950 hover:bg-indigo-50 px-5 py-2.5 rounded-2xl font-bold text-xs uppercase transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Create Task
          </button>

          {/* SVG Progress summary */}
          <div className="flex items-center gap-3 bg-white/5 dark:bg-black/20 p-2.5 rounded-2xl border border-white/10 shrink-0">
            <div className="relative h-14 w-14 flex items-center justify-center">
              <svg className="absolute transform -rotate-90 w-full h-full">
                <circle
                  cx="28"
                  cy="28"
                  r={radius}
                  className="stroke-white/10 fill-none"
                  strokeWidth="3.5"
                />
                <circle
                  cx="28"
                  cy="28"
                  r={radius}
                  className="stroke-indigo-400 fill-none transition-all duration-700 ease-out"
                  strokeWidth="3.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs font-black text-white">{stats.completionRate}%</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-200 leading-none">Task Progress</p>
              <p className="text-[9px] text-indigo-350 font-semibold mt-1">Completion Ratio</p>
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-[40px] pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700" />
      </div>



      {/* 3. Recent Tasks Overview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3.5 border-b border-slate-50 dark:border-slate-850 pb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Task Feed</span>
          <Link
            href="/dashboard/tasks"
            className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-850 flex items-center gap-0.5 transition"
          >
            Go to Portal <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[160px] custom-scrollbar pr-0.5">
          {recentTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-semibold italic">
              No tasks active recently.
            </div>
          ) : (
            recentTasks.map((t) => {
              const taskTitle = t.taskText || t.title || "Untitled";
              const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : t.assignedTo ? [t.assignedTo] : [];
              const assigneeNames = assignees.map((uid) => userMap.get(uid) || "Employee").join(", ");
              const statusClass = STATUS_BADGES[t.status] || "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-2 bg-slate-50/50 hover:bg-indigo-50/30 dark:bg-slate-950/40 dark:hover:bg-indigo-900/10 border border-slate-100 dark:border-slate-850/80 rounded-2xl transition"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      onClick={() => setSelectedTask(t)}
                      className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-650 transition"
                      title={taskTitle}
                    >
                      {taskTitle}
                    </p>
                    <p className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold truncate mt-0.5" title={assigneeNames}>
                      Assignee: {assigneeNames || "Self"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${statusClass}`}>
                      {t.status.replace("_", " ")}
                    </span>
                    <button
                      onClick={() => setCommentTask(t)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Add Comment"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setSelectedTask(t)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="View Details"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Overlay Drawer / Modals */}
      {showCreateModal && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          users={users}
        />
      )}

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          currentUserId={user?.uid || ""}
          currentUserName={user?.displayName || "You"}
          currentUserRole={role || undefined}
          users={users}
        />
      )}

      {commentTask && (
        <TaskCommentPanel
          task={commentTask}
          onClose={() => setCommentTask(null)}
          currentUserId={user?.uid || ""}
          currentUserName={user?.displayName || "You"}
          currentUserRole={role || undefined}
          users={users}
        />
      )}
    </div>
  );
}
