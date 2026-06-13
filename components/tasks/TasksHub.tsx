"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { 
  Task, 
  TaskStatus, 
  updateTaskStatus, 
  addTaskHistory,
  subscribeToAllTasks,
  subscribeToAllTasksForUser
} from "@/lib/tasks";
import { subscribeToRecentDiaryEntries, DailyDiaryEntry } from "@/lib/dailyDiary";
import { getAllUsers, AppUserSummary } from "@/lib/users";

import { 
  Search, 
  Plus, 
  Grid, 
  List, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Briefcase,
  Users,
  UserCheck,
  FileText,
  User,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Loader2
} from "lucide-react";
import { MncTaskCard } from "./MncTaskCard";
import { MncTaskTable } from "./MncTaskTable";
import { ActivityTimeline } from "./ActivityTimeline";
import { TaskDetailsModal } from "./TaskDetailsModal";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskCommentPanel } from "./TaskCommentPanel";

interface TasksHubProps {
  defaultTab?: "dashboard" | "board" | "list" | "team-feed" | "timeline";
  defaultFilter?: "all" | "my-tasks" | "assigned-by-me" | "assigned-to-me" | "self-tasks" | "team-tasks" | "completed" | "pending" | "critical" | "overdue";
}

const STATS_CARDS_CONFIG = [
  { key: "total", label: "Total Tasks", icon: Briefcase, color: "from-indigo-500 to-indigo-600", text: "text-indigo-600 dark:text-indigo-400" },
  { key: "myTasks", label: "My Tasks", icon: User, color: "from-blue-500 to-blue-600", text: "text-blue-600 dark:text-blue-400" },
  { key: "assignedByMe", label: "Assigned By Me", icon: UserCheck, color: "from-violet-500 to-violet-600", text: "text-violet-600 dark:text-violet-400" },
  { key: "assignedToMe", label: "Assigned To Me", icon: Users, color: "from-purple-500 to-purple-600", text: "text-purple-600 dark:text-purple-400" },
  { key: "pending", label: "Pending Tasks", icon: Clock, color: "from-amber-500 to-amber-600", text: "text-amber-600 dark:text-amber-400" },
  { key: "overdue", label: "Overdue Tasks", icon: AlertTriangle, color: "from-rose-500 to-rose-600", text: "text-rose-600 dark:text-rose-400" },
  { key: "completed", label: "Completed Tasks", icon: CheckCircle, color: "from-emerald-500 to-emerald-600", text: "text-emerald-600 dark:text-emerald-400" }
];

export function TasksHub({ defaultTab = "dashboard", defaultFilter = "all" }: TasksHubProps) {
  const { user, role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DailyDiaryEntry[]>([]);
  const [users, setUsers] = useState<AppUserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs State
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [activeFilter, setActiveFilter] = useState(defaultFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"newest" | "dueDate" | "priority" | "status" | "progress">("newest");

  // Detail & Comments Overlay
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentTask, setCommentTask] = useState<Task | null>(null);

  // Task Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);


  const isAdminOrManager = role === "admin" || role === "ceo" || role === "manager";

  // Load user dictionary on mount
  useEffect(() => {
    getAllUsers().then(setUsers).catch(console.error);
  }, []);

  // Listen to tasks in real time
  useEffect(() => {
    if (!user) return;
    Promise.resolve().then(() => setLoading(true));

    let unsub: () => void;
    // Admins/CEOs/Managers see all tasks for the company dashboard
    if (isAdminOrManager) {
      unsub = subscribeToAllTasks((data) => {
        setTasks(data);
        setLoading(false);
      }, 100); // Higher page size for portal view
    } else {
      // Employees see their own tasks
      unsub = subscribeToAllTasksForUser(user.uid, (data) => {
        setTasks(data);
        setLoading(false);
      });
    }

    return () => unsub?.();
  }, [user, role, isAdminOrManager]);

  // Listen to diary entries
  useEffect(() => {
    const unsub = subscribeToRecentDiaryEntries(2, (data) => {
      setDiaryEntries(data);
    });
    return () => unsub();
  }, []);

  // User Map
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach(u => m.set(u.uid, u.name || u.email || u.uid));
    return m;
  }, [users]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const currentUid = user?.uid || "";
    const tList = tasks;

    const myTasks = tList.filter(t => {
      const arr = Array.isArray(t.assignedTo) ? t.assignedTo : t.assignedTo ? [t.assignedTo] : [];
      return arr.includes(currentUid);
    });

    const assignedByMe = tList.filter(t => t.assignedBy === currentUid);

    const pending = tList.filter(t => t.status === "pending" || t.status === "todo" || t.status === "backlog");
    
    const completed = tList.filter(t => t.status === "completed" || t.status === "approved" || t.status === "done");

    const overdue = tList.filter(t => {
      if (t.status === "completed" || t.status === "approved" || t.status === "done") return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    });

    return {
      total: tList.length,
      myTasks: myTasks.length,
      assignedByMe: assignedByMe.length,
      assignedToMe: myTasks.length, // Alias
      pending: pending.length,
      overdue: overdue.length,
      completed: completed.length
    };
  }, [tasks, user]);

  // Multi-Filter Chip Handling
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const currentUid = user?.uid || "";

    return tasks.filter(t => {
      // 1. Text Search
      if (q) {
        const titleMatch = (t.taskText || t.title || "").toLowerCase().includes(q);
        const descMatch = (t.description || "").toLowerCase().includes(q);
        const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : t.assignedTo ? [t.assignedTo] : [];
        const assigneeNamesMatch = assignees.some(uid => (userMap.get(uid) || "").toLowerCase().includes(q));
        const assignerMatch = (userMap.get(t.assignedBy) || "").toLowerCase().includes(q);
        
        if (!titleMatch && !descMatch && !assigneeNamesMatch && !assignerMatch) return false;
      }

      // 2. Filter Tabs
      const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : t.assignedTo ? [t.assignedTo] : [];
      
      switch (activeFilter) {
        case "my-tasks":
        case "assigned-to-me":
          return assignees.includes(currentUid);
        case "assigned-by-me":
          return t.assignedBy === currentUid;
        case "self-tasks":
          return (assignees.length === 1 && assignees[0] === t.assignedBy) || t.assignedBy === t.assignedTo;
        case "team-tasks":
          return assignees.length >= 2;
        case "completed":
          return t.status === "completed" || t.status === "approved" || t.status === "done";
        case "pending":
          return t.status === "pending" || t.status === "todo" || t.status === "backlog" || t.status === "in_progress" || t.status === "review";
        case "critical":
          return t.priority === "critical";
        case "overdue":
          const completedStatuses = ["completed", "approved", "done"];
          return !completedStatuses.includes(t.status) && t.dueDate && new Date(t.dueDate) < new Date();
        default:
          return true;
      }
    });
  }, [tasks, searchQuery, activeFilter, user, userMap]);

  // Sorting
  const sortedTasks = useMemo(() => {
    const data = [...filteredTasks];
    const PRIORITY_VAL = { critical: 4, high: 3, medium: 2, low: 1 };
    
    data.sort((a, b) => {
      switch (sortOption) {
        case "dueDate":
          const dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return dA - dB;
        case "priority":
          const pA = PRIORITY_VAL[a.priority as keyof typeof PRIORITY_VAL] || 0;
          const pB = PRIORITY_VAL[b.priority as keyof typeof PRIORITY_VAL] || 0;
          return pB - pA;
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "progress":
          return (b.progress || 0) - (a.progress || 0);
        case "newest":
        default:
          const tA = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
          const tB = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
          return tB - tA;
      }
    });
    return data;
  }, [filteredTasks, sortOption]);

  // Kanban Columns
  const boardColumns = useMemo(() => {
    const todo = sortedTasks.filter(t => t.status === "pending" || t.status === "todo" || t.status === "backlog");
    const progress = sortedTasks.filter(t => t.status === "in_progress");
    const review = sortedTasks.filter(t => t.status === "review" || t.status === "hold");
    const completed = sortedTasks.filter(t => t.status === "completed" || t.status === "approved" || t.status === "done" || t.status === "rejected");

    return [
      { key: "todo", title: "To Do / Backlog", tasks: todo, bg: "bg-slate-100/50 dark:bg-slate-900/50" },
      { key: "progress", title: "In Progress", tasks: progress, bg: "bg-indigo-50/30 dark:bg-indigo-950/10" },
      { key: "review", title: "In Review / Hold", tasks: review, bg: "bg-amber-50/20 dark:bg-amber-950/5" },
      { key: "completed", title: "Completed / Approved", tasks: completed, bg: "bg-emerald-50/20 dark:bg-emerald-950/5" }
    ];
  }, [sortedTasks]);

  // Handle status movements in Kanban directly
  const moveTaskStatus = async (task: Task, direction: "next" | "prev") => {
    const statuses: TaskStatus[] = ["pending", "in_progress", "review", "completed"];
    const currIndex = statuses.indexOf(task.status === "todo" || task.status === "backlog" ? "pending" : task.status === "approved" || task.status === "done" || task.status === "rejected" ? "completed" : task.status);
    
    let nextIndex = currIndex;
    if (direction === "next" && currIndex < statuses.length - 1) nextIndex += 1;
    if (direction === "prev" && currIndex > 0) nextIndex -= 1;

    if (nextIndex !== currIndex) {
      const nextStatus = statuses[nextIndex];
      await updateTaskStatus(task.id, nextStatus);
      await addTaskHistory(task.id, `Task moved to ${nextStatus.toUpperCase().replace("_", " ")}`, user!.uid, user!.displayName || "User");
    }
  };



  return (
    <div className="space-y-6">

      {/* ── KPI Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {STATS_CARDS_CONFIG.map(config => {
          const val = kpis[config.key as keyof typeof kpis] || 0;
          return (
            <div 
              key={config.key}
              onClick={() => {
                if (config.key === "myTasks") setActiveFilter("my-tasks");
                else if (config.key === "assignedByMe") setActiveFilter("assigned-by-me");
                else if (config.key === "assignedToMe") setActiveFilter("assigned-to-me");
                else if (config.key === "pending") setActiveFilter("pending");
                else if (config.key === "overdue") setActiveFilter("overdue");
                else if (config.key === "completed") setActiveFilter("completed");
                else setActiveFilter("all");
              }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-indigo-150 transition-all cursor-pointer group relative overflow-hidden shrink-0"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight">
                  {config.label}
                </span>
                <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${config.color} text-white flex items-center justify-center`}>
                  <config.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {val}
                </p>
              </div>
              <div className={`absolute -right-4 -bottom-4 h-12 w-12 rounded-full bg-gradient-to-br ${config.color} opacity-5 group-hover:scale-125 transition-transform`} />
            </div>
          );
        })}
      </div>

      {/* ── Tabs Bar & Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        {/* Navigation Tabs */}
        <div className="flex gap-4 overflow-x-auto pb-1 hide-scrollbar">
          {[
            { id: "dashboard" as const, label: "Overview", icon: Grid },
            { id: "board" as const, label: "Kanban Board", icon: Grid },
            { id: "list" as const, label: "List Workspace", icon: List },
            { id: "team-feed" as const, label: "Team Feed Summary", icon: FileText },
            { id: "timeline" as const, label: "Activity Logs", icon: Activity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by keywords or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full sm:w-56 text-slate-800 dark:text-slate-100 font-semibold"
            />
          </div>

          {/* Sort selection */}
          <div className="relative">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as "newest" | "dueDate" | "priority" | "status" | "progress")}
              className="pl-3 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none font-semibold text-slate-655 dark:text-slate-300 cursor-pointer"
            >
              <option value="newest">Sort: Updated</option>
              <option value="dueDate">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="progress">Sort: Progress</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Create Task Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-750 text-white px-3.5 py-2 rounded-xl font-bold text-xs uppercase transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Create Task
          </button>
        </div>
      </div>

      {/* ── Filters Chips / Pills ─────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap items-center bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 ml-1">Filters:</span>
        {[
          { id: "all" as const, label: "All Items" },
          { id: "my-tasks" as const, label: "My Tasks" },
          { id: "assigned-by-me" as const, label: "Assigned By Me" },
          { id: "assigned-to-me" as const, label: "Assigned To Me" },
          { id: "self-tasks" as const, label: "Self Tasks" },
          { id: "team-tasks" as const, label: "Team Tasks" },
          { id: "pending" as const, label: "Pending" },
          { id: "overdue" as const, label: "Overdue" },
          { id: "critical" as const, label: "Critical" },
          { id: "completed" as const, label: "Completed" },
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
              activeFilter === filter.id
                ? "bg-indigo-650 border-indigo-600 text-white dark:bg-indigo-600"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* ── Core Workspace Tabs Rendering ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-semibold text-slate-500">Retrieving tasks workspace...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 1. Dashboard View (Overview) */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Task Cards Grid */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Vetted Work Item Workspace ({sortedTasks.length})
                  </h3>
                </div>
                {sortedTasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedTasks.slice(0, 8).map(task => (
                      <MncTaskCard
                        key={task.id}
                        task={task}
                        currentUserId={user?.uid || ""}
                        users={users}
                        onOpenDetails={setSelectedTask}
                        onOpenComments={setCommentTask}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-slate-400 font-semibold italic text-xs">
                    No tasks match the active filters.
                  </div>
                )}
                {sortedTasks.length > 8 && (
                  <button
                    onClick={() => setActiveTab("list")}
                    className="w-full py-3 border border-dashed border-slate-200 hover:border-indigo-500 dark:border-slate-800 rounded-2xl text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 transition-colors"
                  >
                    View All {sortedTasks.length} Work Items In List Workspace &rarr;
                  </button>
                )}
              </div>

              {/* Activity Timeline Sidebar */}
              <div className="space-y-6">
                <ActivityTimeline
                  tasks={tasks}
                />
              </div>
            </div>
          )}

          {/* 2. Kanban Board View */}
          {activeTab === "board" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
              {boardColumns.map(col => (
                <div 
                  key={col.key} 
                  className={`rounded-2xl p-4 border border-slate-100 dark:border-slate-850 flex flex-col max-h-[75vh] ${col.bg}`}
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${
                        col.key === "todo" ? "bg-slate-400" 
                        : col.key === "progress" ? "bg-indigo-500" 
                        : col.key === "review" ? "bg-amber-500" 
                        : "bg-emerald-500"
                      }`} />
                      {col.title}
                    </h4>
                    <span className="bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px] font-black text-slate-655 dark:text-slate-300">
                      {col.tasks.length}
                    </span>
                  </div>

                  {/* Task List */}
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar min-h-[150px]">
                    {col.tasks.map(task => (
                      <div key={task.id} className="relative group/board">
                        <MncTaskCard
                          task={task}
                          currentUserId={user?.uid || ""}
                          users={users}
                          onOpenDetails={setSelectedTask}
                          onOpenComments={setCommentTask}
                        />

                        {/* Move Quick buttons for board interaction */}
                        <div className="absolute top-4 right-12 hidden group-hover/board:flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 border border-slate-100 dark:border-slate-800 shadow-lg p-1 rounded-lg">
                          {col.key !== "todo" && (
                            <button
                              onClick={() => moveTaskStatus(task, "prev")}
                              title="Move back"
                              className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                            >
                              <ArrowLeft className="h-3 w-3" />
                            </button>
                          )}
                          {col.key !== "completed" && (
                            <button
                              onClick={() => moveTaskStatus(task, "next")}
                              title="Move forward"
                              className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {col.tasks.length === 0 && (
                      <div className="h-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-xs font-semibold italic">
                        Empty column
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. Enterprise List View */}
          {activeTab === "list" && (
            <MncTaskTable
              tasks={sortedTasks}
              currentUserId={user?.uid || ""}
              users={users}
              onOpenDetails={setSelectedTask}
              onOpenComments={setCommentTask}
            />
          )}

          {/* 4. Team Feed Summary (Tasks + Diaries) */}
          {activeTab === "team-feed" && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Collaborative Team Dairy & Task Summary Feed
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Unified index of logged diary updates and active workspace tasks from the last 48 hours.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Render Diary Log list */}
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Recent Diary entries (Last 48 hours)
                  </h4>
                  {diaryEntries.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {diaryEntries.map(entry => (
                        <div 
                          key={entry.id} 
                          className="bg-slate-50/50 dark:bg-slate-850 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30 uppercase tracking-wide">
                                📓 Diary Entry
                              </span>
                              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                                {entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                              {entry.description}
                            </p>
                          </div>
                          
                          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                            <span>BY: {userMap.get(entry.userId) || "Employee"}</span>
                            <span className={entry.status === "Completed" ? "text-emerald-600" : "text-amber-600"}>
                              {entry.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-4">No diary entries logged recently.</p>
                  )}

                  {/* Tasks in same feed */}
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pt-4">
                    Active Tasks under filter ({sortedTasks.length})
                  </h4>
                  <MncTaskTable
                    tasks={sortedTasks}
                    currentUserId={user?.uid || ""}
                    users={users}
                    onOpenDetails={setSelectedTask}
                    onOpenComments={setCommentTask}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. Timeline View */}
          {activeTab === "timeline" && (
            <ActivityTimeline
              tasks={tasks}
            />
          )}

        </div>
      )}

      {/* ── Overlay Modals & Drawers ───────────────────────────────────────── */}
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

      {showCreateModal && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          users={users}
        />
      )}

    </div>
  );
}
