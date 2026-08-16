"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  Task,
  subscribeToRecentTasks,
  subscribeToRecentTasksForUser,
  updateTaskStatus,
  addTaskHistory,
} from "@/lib/tasks";
import {
  subscribeToRecentDiaryEntries,
  subscribeToRecentDiaryEntriesForUser,
  DailyDiaryEntry,
} from "@/lib/dailyDiary";
import { subscribeToAllUsers, AppUserSummary } from "@/lib/users";
import {
  Search,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  CheckCircle,
  XCircle,
  PauseCircle,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Clock,
  AlertTriangle,
  ChevronDown,
  Eye,
  X,
} from "lucide-react";
import { TaskCommentPanel } from "./TaskCommentPanel";
import { TaskDetailsModal } from "./TaskDetailsModal";

// ─── Unified Row Type ─────────────────────────────────────────────────────────
type RowType = "task" | "diary";
interface UnifiedRow {
  id: string;
  type: RowType;
  title: string;
  description?: string;
  assignees: string[]; // UIDs
  assignedBy?: string; // UID
  status: string;
  priority?: string;
  updatedAt?: Date;
  createdAt?: Date;
  commentCount?: number;
  raw: Task | DailyDiaryEntry;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:    { label: "Not Started",  className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/20" },
  in_progress:{ label: "In Progress",  className: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300 border-blue-200 dark:border-blue-500/20" },
  review:     { label: "In Review",    className: "bg-yellow-100 text-yellow-850 dark:bg-yellow-500/15 dark:text-yellow-300 border-yellow-250 dark:border-yellow-500/20" },
  completed:  { label: "Completed",    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20" },
  approved:   { label: "Approved",     className: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border-teal-200 dark:border-teal-500/20" },
  rejected:   { label: "Rejected",     className: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300 border-red-200 dark:border-red-500/20" },
  hold:       { label: "On Hold",      className: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300 border-orange-200 dark:border-orange-500/20" },
  Completed:  { label: "Completed",    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20" },
  Pending:    { label: "Pending",      className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/20" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  critical:{ label: "Critical",className: "text-rose-600 dark:text-rose-400 font-black", dot: "bg-rose-500" },
  high:   { label: "High",   className: "text-red-600 dark:text-red-400 font-black",   dot: "bg-red-500" },
  medium: { label: "Med",    className: "text-blue-600 dark:text-blue-400 font-bold",  dot: "bg-blue-500" },
  low:    { label: "Low",    className: "text-slate-500 dark:text-slate-400 font-semibold", dot: "bg-slate-400" },
};

function formatRelative(date?: Date) {
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function toDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (typeof val === "object" && "toDate" in (val as object)) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  return undefined;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group`}>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <div className={`absolute -right-4 -bottom-4 h-16 w-16 rounded-full opacity-5 ${color}`} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface RecentTaskSummaryProps {
  showDiary?: boolean;
  timeWindowDays?: number;
}

export function RecentTaskSummary({ showDiary = true, timeWindowDays = 2 }: RecentTaskSummaryProps) {
  // Removed trace
  const { user, role } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DailyDiaryEntry[]>([]);
  const [users, setUsers] = useState<AppUserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const isAdminOrManager = role === "admin" || role === "ceo" || role === "md" || role === "manager";
  const isAdmin = role === "admin" || role === "ceo" || role === "md" || role === "super_admin";

  // Load users once auth is ready; realtime so it recovers automatically if the
  // initial subscribe races Firebase Auth's post-login state restore.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToAllUsers(setUsers);
    return () => unsub();
  }, [user]);

  // Subscribe to tasks
  useEffect(() => {
    if (!user) return;
    let unsub: () => void;
    if (isAdmin) {
      unsub = subscribeToRecentTasks(timeWindowDays, (data) => {
        setTasks(data);
        setLoading(false);
      });
    } else {
      unsub = subscribeToRecentTasksForUser(user.uid, timeWindowDays, (data) => {
        setTasks(data);
        setLoading(false);
      });
    }
    return () => unsub?.();
  }, [user, role, timeWindowDays, isAdmin]);

  // Subscribe to diary entries
  useEffect(() => {
    if (!showDiary || !user) return;
    const unsub = isAdmin 
      ? subscribeToRecentDiaryEntries(timeWindowDays, setDiaryEntries)
      : subscribeToRecentDiaryEntriesForUser(user.uid, timeWindowDays, setDiaryEntries);
    return () => unsub();
  }, [showDiary, timeWindowDays, user, isAdmin]);

  // Build user map
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => m.set(u.uid, u.name || u.email || u.uid));
    return m;
  }, [users]);

  // Convert tasks to unified rows
  const taskRows: UnifiedRow[] = useMemo(() =>
    tasks.map((t) => ({
      id: t.id,
      type: "task",
      title: t.taskText || t.title || "Untitled",
      description: t.description,
      assignees: Array.isArray(t.assignedTo) ? t.assignedTo : t.assignedTo ? [t.assignedTo] : [],
      assignedBy: t.assignedBy,
      status: t.status,
      priority: t.priority,
      updatedAt: toDate(t.updatedAt) || toDate(t.createdAt),
      createdAt: toDate(t.createdAt),
      raw: t,
    })), [tasks]);

  // Convert diary entries to unified rows
  const diaryRows: UnifiedRow[] = useMemo(() =>
    (showDiary ? diaryEntries : []).map((e) => ({
      id: e.id,
      type: "diary",
      title: (e.description || "").slice(0, 80) + (((e.description || "").length > 80) ? "…" : ""),
      description: e.description || "",
      assignees: [e.userId],
      status: e.status,
      updatedAt: toDate(e.updatedAt) || toDate(e.createdAt),
      createdAt: toDate(e.createdAt),
      raw: e,
    })), [diaryEntries, showDiary]);

  // Merge, deduplicate, sort
  const allRows = useMemo(() => {
    const combined = [...taskRows, ...diaryRows];
    combined.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
    return combined;
  }, [taskRows, diaryRows]);

  // Filter rows
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter((row) => {
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      if (filterEmployee !== "all") {
        const isAssignee = row.assignees.includes(filterEmployee);
        const isAssigner = row.assignedBy === filterEmployee;
        if (!isAssignee && !isAssigner) return false;
      }
      if (q) {
        const titleMatch = row.title.toLowerCase().includes(q);
        const assigneeMatch = row.assignees.some((uid) =>
          (userMap.get(uid) || "").toLowerCase().includes(q)
        );
        const assignerMatch = row.assignedBy ? (userMap.get(row.assignedBy) || "").toLowerCase().includes(q) : false;
        if (!titleMatch && !assigneeMatch && !assignerMatch) return false;
      }
      return true;
    });
  }, [allRows, search, filterEmployee, filterStatus, userMap]);

  // Stats
  const stats = useMemo(() => {
    const t = taskRows;
    return {
      total: allRows.length,
      completed: t.filter((r) => r.status === "completed" || r.status === "approved").length,
      pending: t.filter((r) => r.status === "pending").length,
      overdue: t.filter((r) => {
        const task = r.raw as Task;
        if (!task.dueDate || r.status === "completed" || r.status === "approved") return false;
        return new Date(task.dueDate) < new Date();
      }).length,
      inProgress: t.filter((r) => r.status === "in_progress").length,
    };
  }, [taskRows, allRows]);

  const handleApprove = async (task: Task, status: "approved" | "rejected" | "hold") => {
    setApprovingId(task.id);
    try {
      await updateTaskStatus(task.id, status);
      await addTaskHistory(task.id, `Status changed to ${status.toUpperCase()}`, user!.uid, user!.displayName || "Admin");
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-500">Loading task summary…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Tasks"   value={stats.total}      icon={ClipboardList} color="bg-indigo-500" />
        <StatCard label="Completed"     value={stats.completed}  icon={CheckCircle}   color="bg-emerald-500" />
        <StatCard label="In Progress"   value={stats.inProgress} icon={TrendingUp}    color="bg-blue-500" />
        <StatCard label="Not Started"   value={stats.pending}    icon={Clock}         color="bg-amber-500" />
        <StatCard label="Overdue"       value={stats.overdue}    icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* ── Main Panel ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Panel Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span className="h-6 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600 inline-block" />
                Recent Tasks Summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Overview of tasks & diary entries from the last {timeWindowDays * 24} hours
                {" · "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{filteredRows.length} items</span>
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tasks or names…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-9 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full sm:w-56 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Employee Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none w-full sm:w-44 text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Employees</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>{u.name || u.email}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none w-full sm:w-36 text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="hold">On Hold</option>
                  <option value="Pending">Diary Pending</option>
                  <option value="Completed">Diary Done</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <th className="px-6 py-3 whitespace-nowrap">Type</th>
                <th className="px-6 py-3 whitespace-nowrap">Task / Entry</th>
                <th className="px-6 py-3 whitespace-nowrap">Assignee</th>
                <th className="px-6 py-3 whitespace-nowrap">Assigned By</th>
                <th className="px-6 py-3 whitespace-nowrap">Status</th>
                <th className="px-6 py-3 whitespace-nowrap">Priority</th>
                <th className="px-6 py-3 whitespace-nowrap">Last Update</th>
                <th className="px-6 py-3 whitespace-nowrap text-center">Comments</th>
                <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80 text-sm">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <ClipboardList className="h-7 w-7 text-slate-400" />
                      </div>
                      <p className="font-semibold text-slate-600 dark:text-slate-400">No items found</p>
                      <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const statusCfg = STATUS_CONFIG[row.status] ?? { label: row.status, className: "bg-slate-100 text-slate-700 border-slate-200" };
                  const priorityCfg = row.priority ? PRIORITY_CONFIG[row.priority] : null;
                  const assigneeNames = row.assignees.map((uid) => userMap.get(uid) || "Unknown").join(", ") || "—";
                  const assignerName = row.assignedBy ? (userMap.get(row.assignedBy) || "—") : "Self";
                  const task = row.type === "task" ? row.raw as Task : null;
                  const isApproving = approvingId === row.id;
                  const canApprove = isAdminOrManager && task?.status === "completed";

                  return (
                    <tr
                      key={row.id + row.type}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group"
                    >
                      {/* Type Badge */}
                      <td className="px-6 py-4">
                        {row.type === "task" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 uppercase">
                            <ClipboardList className="h-2.5 w-2.5" /> Task
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700 uppercase">
                            <BookOpen className="h-2.5 w-2.5" /> Diary
                          </span>
                        )}
                      </td>

                      {/* Title */}
                      <td className="px-6 py-4 max-w-[240px]">
                        <p
                          className="font-semibold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title={row.title}
                          onClick={() => task && setDetailTask(task)}
                        >
                          {row.title}
                        </p>
                        {row.description && row.description !== row.title && (
                          <p className="text-xs text-slate-400 truncate mt-0.5" title={row.description}>
                            {row.description}
                          </p>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-black text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                            {assigneeNames.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-slate-800 dark:text-slate-200 font-medium text-xs truncate max-w-[100px]" title={assigneeNames}>
                            {assigneeNames}
                          </span>
                        </div>
                      </td>

                      {/* Assigned By */}
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {assignerName}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-6 py-4">
                        {priorityCfg ? (
                          <span className={`flex items-center gap-1.5 text-xs ${priorityCfg.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${priorityCfg.dot}`} />
                            {priorityCfg.label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Last Update */}
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatRelative(row.updatedAt)}
                      </td>

                      {/* Comments */}
                      <td className="px-6 py-4 text-center">
                        {task ? (
                          <button
                            onClick={() => setCommentTask(task)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900/30 text-slate-600 hover:text-indigo-700 dark:text-slate-400 dark:hover:text-indigo-400 text-xs font-bold transition-all group-hover:scale-105"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Comment</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {task && (
                            <button
                              onClick={() => setDetailTask(task)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900/30 text-slate-600 hover:text-indigo-700 dark:text-slate-400 dark:hover:text-indigo-400 text-xs font-bold transition-all"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                          )}

                          {canApprove && task && (
                            <div className="flex items-center gap-1">
                              {isApproving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleApprove(task, "approved")}
                                    title="Approve"
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 transition-colors"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleApprove(task, "rejected")}
                                    title="Reject"
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 transition-colors"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleApprove(task, "hold")}
                                    title="Hold"
                                    className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-500 transition-colors"
                                  >
                                    <PauseCircle className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600 dark:text-slate-300">{filteredRows.length}</span> of{" "}
            <span className="font-semibold text-slate-600 dark:text-slate-300">{allRows.length}</span> items
            {showDiary && diaryRows.length > 0 && (
              <span className="ml-2 text-violet-500">· {diaryRows.length} diary entries included</span>
            )}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <RefreshCw className="h-3 w-3" />
            Real-time updates active
          </div>
        </div>
      </div>

      {/* Comment Panel */}
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

      {/* Detail Modal */}
      {detailTask && (
        <TaskDetailsModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          currentUserId={user?.uid || ""}
          currentUserName={user?.displayName || "You"}
          currentUserRole={role || undefined}
          users={users}
        />
      )}
    </div>
  );
}
