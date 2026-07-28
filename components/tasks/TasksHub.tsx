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
import { 
  subscribeToRecentDiaryEntries, 
  subscribeToRecentDiaryEntriesForUser,
  DailyDiaryEntry 
} from "@/lib/dailyDiary";
import { getAllUsers, AppUserSummary } from "@/lib/users";
import {
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
  Loader2
} from "lucide-react";
import { MncTaskCard } from "./MncTaskCard";
import { MncTaskTable } from "./MncTaskTable";
import { ActivityTimeline } from "./ActivityTimeline";
import { TaskDetailsModal } from "./TaskDetailsModal";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskCommentPanel } from "./TaskCommentPanel";
import { TaskSearchPanel } from "@/components/search/TaskSearchPanel";
import { searchTasks } from "@/lib/search/task-search";
import { ExportMenu } from "@/components/export/ExportMenu";


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

export function TasksHub({ defaultTab = "dashboard" }: TasksHubProps) {
  const { user, role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DailyDiaryEntry[]>([]);
  const [users, setUsers] = useState<AppUserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs State
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Task[]>([]);

  // Detail & Comments Overlay
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentTask, setCommentTask] = useState<Task | null>(null);

  // Task Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);


  const isAdminOrManager = role === "admin" || role === "ceo" || role === "manager";
  const isAdmin = role === "admin" || role === "ceo" || role === "super_admin";

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
    if (isAdmin) {
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
  }, [user, role, isAdmin]);

  // Listen to diary entries
  useEffect(() => {
    if (!user) return;
    const unsub = isAdmin
      ? subscribeToRecentDiaryEntries(2, setDiaryEntries)
      : subscribeToRecentDiaryEntriesForUser(user.uid, 2, setDiaryEntries);
    return () => unsub();
  }, [user, isAdmin]);

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

  // Multi-Filter Chip Handling & Sorting
  const sortedTasks = useMemo(() => {
    return isSearching ? searchResults : tasks;
  }, [tasks, isSearching, searchResults]);

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
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group relative overflow-hidden shrink-0"
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
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Active Tasks Overview</h2>
        <div className="flex items-center gap-3">
          <ExportMenu 
            data={sortedTasks.map(t => ({
              ...t,
              assignedToNames: (Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo ? [t.assignedTo] : [])).map(uid => userMap.get(uid) || uid).join(", "),
              assignedByName: userMap.get(t.assignedBy) || t.assignedBy,
              dueDateFmt: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A"
            }))}
            columns={[
              { key: "title", header: "Task Title" },
              { key: "assignedByName", header: "Assigned By" },
              { key: "assignedToNames", header: "Assigned To" },
              { key: "priority", header: "Priority" },
              { key: "status", header: "Status" },
              { key: "progress", header: "Progress (%)" },
              { key: "dueDateFmt", header: "Due Date" }
            ]}
            metadata={{
              module: "tasks",
              appliedFilters: isSearching ? "Custom Search" : "All Tasks",
              correlationId: crypto.randomUUID(),
              performedBy: user?.uid || "unknown",
              performedByName: user?.displayName || user?.email || "Unknown"
            }}
            disabled={sortedTasks.length === 0}
          />
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <TaskSearchPanel 
            onSearch={async (params) => {
              // Default params check
              if (!params.query && params.status === "all" && params.priority === "all" && params.quickFilter === "all" && !params.dueDateFrom && !params.dueDateTo && params.sortBy === "newest") {
                setIsSearching(false);
                setSearchResults([]);
                return;
              }
              setIsSearching(true);
              try {
                const res = await searchTasks(params, user?.uid || "", role || "", 500);
                setSearchResults(res.items);
              } catch (err) {
                console.error("Task search failed:", err);
              }
            }}
        />
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
                    <span className="bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px] font-black text-slate-700 dark:text-slate-300">
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
