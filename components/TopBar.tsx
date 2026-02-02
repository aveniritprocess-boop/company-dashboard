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
    <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white/80 dark:bg-black/40 px-6 backdrop-blur-xl dark:border-white/10 transition-colors">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-4">
         {/* Search Placeholder */}
         <div className="hidden md:flex items-center gap-2 rounded-md bg-gray-100 dark:bg-white/5 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 border border-transparent focus-within:border-primary transition-colors cursor-text">
            <Search className="h-4 w-4" />
            <span className="mr-4">Search...</span>
            <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <span className="text-xs">⌘</span>K
            </kbd>
         </div>

         {/* Notifications / Actions */}
         <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-colors">
             <Bell className="h-5 w-5" />
         </button>
      </div>
    </div>
  );
}
