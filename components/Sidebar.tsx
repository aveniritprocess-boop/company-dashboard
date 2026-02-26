"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  BarChart,
  Settings,
  Users,
  FolderGit2,
  CalendarClock,
  ClipboardList,
  ListChecks,
  UserCheck,
} from "lucide-react";
import { SidebarUser } from "./SidebarUser";
import { useAuth } from "./AuthProvider";

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Todos", href: "/dashboard/todos", icon: CheckSquare },
  { name: "Tasks", href: "/dashboard/tasks", icon: ListTodo },
  { name: "Progress", href: "/dashboard/progress", icon: BarChart },
];



import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const COLLAPSED_WIDTH = 80;

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 16rem
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Initialize state from local storage on mount
  const { role } = useAuth();

  // Filter navigation based on role
  // Everyone sees base items.
  // Admins & Managers see Teams and Projects
  // Employees/Partners see Projects (read only or assigned) - so they should see the link.

  // Let's just add them for everyone, but maybe order matters.
  // Or if we want to restrict Teams creation to Admin/Manager, the page handles it.
  // But usually "Teams" management is Admin/Manager.
  // Let's add them to the list.

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Daily Diary", href: "/dashboard/daily-diary", icon: ClipboardList },
    { name: "Your Tasks", href: "/dashboard/your-tasks", icon: ListChecks },
    ...(role === "admin"
      ? [{ name: "Task Given By Sir", href: "/dashboard/task-given-by-sir", icon: UserCheck }]
      : []),
    { name: "Attendance", href: "/dashboard/attendance", icon: CalendarClock },
    ...(role === "admin" || role === "manager"
      ? [
        { name: "Teams", href: "/dashboard/teams", icon: Users },
        { name: "Projects", href: "/dashboard/projects", icon: FolderGit2 }
      ]
      : []),
    { name: "Progress", href: "/dashboard/progress", icon: BarChart },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];


  useEffect(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    const savedWidth = localStorage.getItem("sidebarWidth");

    if (savedState) {
      setIsCollapsed(savedState === "true");
    }
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth, 10));
    }

    // Check for mobile screen size
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsCollapsed(true); // Auto collapse on mobile
      }
    }

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    localStorage.setItem("sidebarWidth", String(sidebarRef.current?.getBoundingClientRect().width || sidebarWidth));
  }, [sidebarWidth]);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = mouseMoveEvent.clientX - sidebarRef.current.getBoundingClientRect().left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (!isMobile) {
      localStorage.setItem("sidebarCollapsed", String(newState));
    }
  };

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

  return (
    <div
      ref={sidebarRef}
      className="relative flex h-full flex-col border-r bg-white dark:bg-gray-900 dark:border-gray-800 transition-all duration-300 ease-in-out group"
      style={{ width: isMobile ? (isCollapsed ? COLLAPSED_WIDTH : '100%') : currentWidth }}
    >
      <div className={`flex h-16 items-center px-4 border-b dark:border-white/10 shrink-0 ${isCollapsed ? 'justify-center' : ''}`}>
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            AT
          </div>
          {!isCollapsed && <span className="text-lg font-bold text-gray-900 dark:text-white truncate">Avenir Tech</span>}
        </Link>
      </div>

      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {[
          {
            label: "Main Menu",
            items: navigation.filter(i => ["Dashboard", "Daily Diary", "Your Tasks", "Attendance", "Progress"].includes(i.name))
          },
          ...(role === "admin" || role === "manager" ? [
            {
              label: "Management",
              items: navigation.filter(i => ["Task Given By Sir", "Teams", "Projects"].includes(i.name))
            }
          ] : []),
          {
            label: "System",
            items: navigation.filter(i => ["Settings"].includes(i.name))
          }
        ].map((section) => (
          <div key={section.label} className="space-y-1">
            {!isCollapsed && (
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {section.label}
              </h3>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : ""}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                    } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'scale-110' : 'opacity-70'}`} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-2 border-t dark:border-white/10">
        <button
          onClick={toggleSidebar}
          className={`flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          {!isCollapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>

      <SidebarUser isCollapsed={isCollapsed} />

      {/* Resize Handle */}
      {!isCollapsed && !isMobile && (
        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary transition-colors ${isResizing ? 'bg-primary' : 'bg-transparent'}`}
          onMouseDown={startResizing}
        />
      )}
    </div>
  );
}
