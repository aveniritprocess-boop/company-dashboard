"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

export function TopBar() {
  const pathname = usePathname();

  // Format pathname segment name for display
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (!lastSegment || lastSegment === 'dashboard') return 'Dashboard';

    // Capitalize and replace hyphens
    return lastSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white/70 dark:bg-slate-950/70 px-6 backdrop-blur-xl border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="hidden md:flex items-center gap-3 rounded-xl bg-slate-100 dark:bg-slate-900 px-4 py-2 text-sm text-slate-500 dark:text-slate-400 border border-transparent focus-within:border-primary/50 focus-within:bg-white dark:focus-within:bg-slate-800/50 transition-all duration-200 cursor-text w-64 group">
          <Search className="h-4 w-4 group-focus-within:text-primary transition-colors" />
          <span className="flex-1">Search anything...</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {/* Notifications / Actions */}
        <button className="relative rounded-xl p-2.25 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-slate-950"></span>
        </button>
      </div>
    </div>
  );
}
