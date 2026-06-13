"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { SearchDialog } from "./SearchDialog";

export function DashboardSearch() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="relative group max-w-2xl mx-auto -mt-6 sm:-mt-8 mb-8 px-4 sm:px-0">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-4 px-6 py-5 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all duration-300 text-left group/btn"
        >
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/btn:bg-indigo-50 dark:group-hover/btn:bg-indigo-900/30 group-hover/btn:text-indigo-600 transition-colors">
            <Search className="h-6 w-6" />
          </div>
          
          <div className="flex-1">
            <p className="text-slate-900 dark:text-white font-bold text-lg mb-0.5">Search the Portal</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Find tasks, employees, or attendance records...</p>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-mono text-xs font-bold text-slate-400 group-hover/btn:border-indigo-200 dark:group-hover/btn:border-indigo-800 transition-colors">
            <span className="text-sm">⌘</span>
            <span>K</span>
          </div>
        </button>
        
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-[2.2rem] opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500 -z-10" />
      </div>

      <SearchDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
