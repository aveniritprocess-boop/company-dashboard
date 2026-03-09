"use client";

import { useState, useEffect } from "react";
import { Search, X, Command, FileText, CheckCircle2, Users, Settings, LayoutDashboard, Calendar, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToUserTasks, subscribeToAllTasks, Task } from "@/lib/tasks";
import { subscribeToAllUsers, AppUserSummary } from "@/lib/users";
import { subscribeToAllProjects } from "@/lib/projects";
import { subscribeToAllTeams } from "@/lib/teams";
import { Project, Team } from "@/lib/roles";

interface SearchItem {
  id: string;
  title: string;
  description?: string;
  category: "Page" | "Task" | "Employee" | "Attendance" | "Project" | "Team" | "Action";
  link: string;
  icon: React.ReactNode;
}

export function SearchDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const router = useRouter();
  const { role, user } = useAuth();
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUserSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [results, setResults] = useState<SearchItem[]>([]);

  useEffect(() => {
    if (!user || !isOpen) return;
    
    let unsubTasks: () => void;
    if (role === 'admin' || role === 'ceo') {
      unsubTasks = subscribeToAllTasks((data) => setTasks(data), 100);
    } else {
      unsubTasks = subscribeToUserTasks(user.uid, (data) => setTasks(data), 100);
    }
    
    const unsubUsers = subscribeToAllUsers((data) => setUsers(data));
    const unsubProjects = subscribeToAllProjects((data) => setProjects(data));
    const unsubTeams = subscribeToAllTeams((data) => setTeams(data));
    
    return () => {
      unsubTasks();
      unsubUsers();
      unsubProjects();
      unsubTeams();
    };
  }, [user, isOpen, role]);

  const pages: SearchItem[] = [
    { id: "p1", title: "Dashboard", category: "Page", link: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "p2", title: "Your Tasks", category: "Page", link: "/dashboard/your-tasks", icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: "p3", title: "Daily Diary", category: "Page", link: "/dashboard/daily-diary", icon: <Calendar className="h-4 w-4" /> },
    { id: "p4", title: "Settings", category: "Page", link: "/dashboard/settings", icon: <Settings className="h-4 w-4" /> },
  ];

  if (role === "admin" || role === "ceo" || role === "manager") {
    pages.push({ id: "p5", title: "Task Given By Sir", category: "Page", link: "/dashboard/task-given-by-sir", icon: <Users className="h-4 w-4" /> });
    pages.push({ id: "p6", title: "Employee Management", category: "Page", link: "/dashboard/employees", icon: <Users className="h-4 w-4" /> });
  }

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    
    const filteredPages = pages.filter(p => p.title.toLowerCase().includes(q));
    
    const filteredTasks = tasks
      .filter(t => (t.taskText || t.title || "").toLowerCase().includes(q))
      .map(t => ({
        id: t.id,
        title: t.taskText || t.title || "Untitled Task",
        description: `Status: ${t.status}`,
        category: "Task" as const,
        link: "/dashboard/your-tasks",
        icon: <FileText className="h-4 w-4" />
      }));

    const filteredUsers = users
      .filter(u => 
        (u.name || "").toLowerCase().includes(q) || 
        (u.email || "").toLowerCase().includes(q) ||
        (u.employee_id || "").toLowerCase().includes(q)
      )
      .map(u => ({
        id: u.uid,
        title: u.name || "Unknown User",
        description: `${u.role} • ${u.department || "No Department"}`,
        category: "Employee" as const,
        link: "/dashboard/employees",
        icon: (
          <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600">
            {u.name?.charAt(0) || "U"}
          </div>
        )
      }));

    const attendanceMatches: SearchItem[] = users
      .filter(u => (u.name || "").toLowerCase().includes(q))
      .map(u => ({
        id: `att-${u.uid}`,
        title: `${u.name}'s Attendance`,
        description: `View session logs and clock-in history`,
        category: "Attendance" as const,
        link: "/dashboard/attendance",
        icon: <Calendar className="h-4 w-4" />
      }));

    const filteredProjects = projects
      .filter(p => (p.name || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q))
      .map(p => ({
        id: p.id || Math.random().toString(),
        title: p.name || "Untitled Project",
        description: p.description,
        category: "Project" as const,
        link: "/dashboard/projects",
        icon: <LayoutDashboard className="h-4 w-4 text-sky-500" />
      }));

    const filteredTeams = teams
      .filter(t => (t.name || "").toLowerCase().includes(q))
      .map(t => ({
        id: t.id || Math.random().toString(),
        title: t.name || "Untitled Team",
        description: `${t.members?.length || 0} Members`,
        category: "Team" as const,
        link: "/dashboard/teams",
        icon: <Users className="h-4 w-4 text-orange-500" />
      }));

    const allResults = [
      ...filteredPages, 
      ...filteredUsers, 
      ...attendanceMatches, 
      ...filteredProjects,
      ...filteredTeams,
      ...filteredTasks
    ];
    setResults(allResults.slice(0, 10)); // Top 10 most relevant
  }, [query, tasks, users, projects, teams]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 md:px-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-top-4 duration-300">
        <div className="relative flex items-center p-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400 absolute left-6" />
          <input
            autoFocus
            type="text"
            placeholder="Search pages, tasks, or actions..."
            className="w-full pl-10 pr-10 py-2 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
          {!query && (
            <div className="p-8 text-center text-slate-400">
              <Command className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Type to search for anything...</p>
              <div className="flex justify-center gap-4 mt-6">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full">
                  <span className="text-xs">↑↓</span> Navigate
                </div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full">
                  <span className="text-xs">Enter</span> Select
                </div>
              </div>
            </div>
          )}

          {query && results.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <Search className="h-10 w-10 mx-auto mb-4 opacity-10" />
              <p className="font-medium">No results found for "{query}"</p>
              <p className="text-sm mt-1 opacity-70">Try searching for something else.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.link);
                    onClose();
                  }}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group transition-all text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate uppercase font-medium tracking-tight">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-700 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
            Search Powered by <span className="text-indigo-500">AntiGravity</span>
          </p>
        </div>
      </div>
    </div>
  );
}
