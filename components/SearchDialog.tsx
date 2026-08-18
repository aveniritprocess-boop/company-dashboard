"use client";

import { useState, useEffect } from "react";
import { Search, X, Command, FileText, CheckCircle2, Users, Settings, LayoutDashboard, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useDebounce } from "@/lib/utils/hooks";

import { searchEmployees } from "@/lib/search/employee-search";
import { defaultEmployeeSearchParams } from "@/lib/search/search-types";
import { searchTasks } from "@/lib/search/task-search";
import { defaultTaskSearchParams } from "@/lib/search/search-types";
import { searchProjects } from "@/lib/search/project-search";
import { defaultProjectSearchParams } from "@/lib/search/search-types";
import { searchTeams } from "@/lib/search/team-search";
import { defaultTeamSearchParams } from "@/lib/search/search-types";
import { AppUserSummary } from "@/lib/users";
import { Task } from "@/lib/tasks";
import { Project, Team, isManagerTierOrAbove } from "@/lib/roles";
import { SearchItem } from "./SearchResultItem";
import { SearchGroupItem, SearchGroup } from "./SearchGroupItem";

export function SearchDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const router = useRouter();
  const { role, user } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<AppUserSummary[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Total flat list of results for keyboard navigation
  const [flatResults, setFlatResults] = useState<SearchItem[]>([]);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!isOpen || !user || !debouncedQuery) {
      setEmployees([]);
      setTasks([]);
      setProjects([]);
      setTeams([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const [empRes, taskRes, projRes, teamRes] = await Promise.all([
          searchEmployees({ ...defaultEmployeeSearchParams, query: debouncedQuery }, 5),
          searchTasks({ ...defaultTaskSearchParams, query: debouncedQuery }, user.uid, role || "employee", 5),
          searchProjects({ ...defaultProjectSearchParams, query: debouncedQuery }, 5),
          searchTeams({ ...defaultTeamSearchParams, query: debouncedQuery }, 5)
        ]);

        setEmployees(empRes.items);
        setTasks(taskRes.items);
        setProjects(projRes.items);
        setTeams(teamRes.items);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [isOpen, debouncedQuery, user, role]);

  // Static pages
  const pages: SearchItem[] = [
    { id: "p1", title: "Dashboard", category: "Page", link: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "p2", title: "Your Tasks", category: "Page", link: "/dashboard/your-tasks", icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: "p3", title: "Daily Diary", category: "Page", link: "/dashboard/daily-diary", icon: <Calendar className="h-4 w-4" /> },
    { id: "p4", title: "Settings", category: "Page", link: "/dashboard/settings", icon: <Settings className="h-4 w-4" /> },
  ];

  // Was missing 'md' entirely (and AGM did not exist) — now driven by the
  // shared hierarchy helper so new tiers cannot be silently omitted again.
  if (isManagerTierOrAbove(role)) {
    pages.push({ id: "p5", title: "Task Assigned", category: "Page", link: "/dashboard/tasks-assigned", icon: <Users className="h-4 w-4" /> });
    pages.push({ id: "p6", title: "Employee Management", category: "Page", link: "/dashboard/employees", icon: <Users className="h-4 w-4" /> });
  }

  // Build grouped results
  const groups: SearchGroup[] = [];
  let currentFlatList: SearchItem[] = [];

  const matchedPages = pages.filter(p => query && p.title.toLowerCase().includes(query.toLowerCase()));
  if (matchedPages.length > 0) {
    groups.push({ label: "Pages", items: matchedPages, icon: <LayoutDashboard className="h-4 w-4" /> });
    currentFlatList = [...currentFlatList, ...matchedPages];
  }

  if (employees.length > 0) {
    const empItems = employees.map(u => ({
      id: u.uid,
      title: u.name || "Unknown User",
      description: `${u.role} • ${u.department || "No Department"}`,
      category: "Employee",
      link: "/dashboard/employees",
      icon: (
        <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600">
          {u.name?.charAt(0) || "U"}
        </div>
      )
    }));
    groups.push({ label: "Employees", items: empItems, seeAllLink: "/dashboard/employees", icon: <Users className="h-4 w-4" /> });
    currentFlatList = [...currentFlatList, ...empItems];
  }

  if (tasks.length > 0) {
    const taskItems = tasks.map(t => ({
      id: t.id,
      title: t.taskText || t.title || "Untitled Task",
      description: `Status: ${t.status}`,
      category: "Task",
      link: "/dashboard/your-tasks",
      icon: <FileText className="h-4 w-4 text-blue-500" />
    }));
    groups.push({ label: "Tasks", items: taskItems, seeAllLink: "/dashboard/your-tasks", icon: <CheckCircle2 className="h-4 w-4" /> });
    currentFlatList = [...currentFlatList, ...taskItems];
  }

  if (projects.length > 0) {
    const projItems = projects.map(p => ({
      id: p.id || `p-${Math.random()}`,
      title: p.name || "Untitled Project",
      description: p.description,
      category: "Project",
      link: "/dashboard/projects",
      icon: <LayoutDashboard className="h-4 w-4 text-sky-500" />
    }));
    groups.push({ label: "Projects", items: projItems, seeAllLink: "/dashboard/projects", icon: <LayoutDashboard className="h-4 w-4" /> });
    currentFlatList = [...currentFlatList, ...projItems];
  }

  if (teams.length > 0) {
    const teamItems = teams.map(t => ({
      id: t.id || `t-${Math.random()}`,
      title: t.name || "Untitled Team",
      description: `${t.members?.length || 0} Members`,
      category: "Team",
      link: "/dashboard/teams",
      icon: <Users className="h-4 w-4 text-orange-500" />
    }));
    groups.push({ label: "Teams", items: teamItems, seeAllLink: "/dashboard/teams", icon: <Users className="h-4 w-4" /> });
    currentFlatList = [...currentFlatList, ...teamItems];
  }

  // Update flat results for keyboard nav
  useEffect(() => {
    setFlatResults(currentFlatList);
    setSelectedIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, tasks, projects, teams, query]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          router.push(flatResults[selectedIndex].link);
          onClose();
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, router, onClose]);

  // Reset query on close
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 md:px-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-top-4 duration-300">
        <div className="relative flex items-center p-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400 absolute left-6" />
          <input
            autoFocus
            type="text"
            placeholder="Search pages, employees, tasks, projects..."
            className="w-full pl-10 pr-10 py-2 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <div className="absolute right-12 h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          )}
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors absolute right-4"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
          {!query && (
            <div className="p-8 text-center text-slate-400">
              <Command className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Type to search across the portal...</p>
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

          {query && !loading && groups.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <Search className="h-10 w-10 mx-auto mb-4 opacity-10" />
              <p className="font-medium">No results found for &quot;{query}&quot;</p>
              <p className="text-sm mt-1 opacity-70">Try adjusting your search.</p>
            </div>
          )}

          {groups.length > 0 && (
            <div className="space-y-4 p-2">
              {groups.map((group) => (
                <SearchGroupItem
                  key={group.label}
                  group={group}
                  flatResults={flatResults}
                  selectedIndex={selectedIndex}
                  onSelect={(link) => {
                    router.push(link);
                    onClose();
                  }}
                  onHover={(flatIdx) => setSelectedIndex(flatIdx)}
                  onSeeAll={(link) => {
                    router.push(link);
                    onClose();
                  }}
                />
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
