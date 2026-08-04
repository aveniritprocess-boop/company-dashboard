"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    Home,
    Calendar,
    Settings,
    Users,
    CheckSquare,
    Command as CommandIcon
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export function CommandMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const router = useRouter();

    const toggleMenu = useCallback(() => setIsOpen(prev => !prev), []);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggleMenu();
            }
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [toggleMenu, isOpen]);

    const navigate = (href: string) => {
        router.push(href);
        setIsOpen(false);
    };

    const { role } = useAuth();
    const actions = [
        { name: "Go to Dashboard", href: "/dashboard", icon: Home, category: "Navigation" },
        { name: "View Your Tasks", href: "/dashboard/your-tasks", icon: CheckSquare, category: "Work" },
        { name: "Daily Diary", href: "/dashboard/daily-diary", icon: Calendar, category: "Work" },
        { name: "Settings", href: "/dashboard/settings", icon: Settings, category: "System" },
        ...(role === "admin" || role === "manager" || role === "ceo" || role === "md" ? [
            { name: "Task Assigned", href: "/dashboard/tasks-assigned", icon: Users, category: "Admin" }
        ] : []),
    ];

    const filteredActions = actions.filter(action =>
        action.name.toLowerCase().includes(search.toLowerCase()) ||
        action.category.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <Search className="h-5 w-5 text-slate-400 mr-4" />
                    <input
                        autoFocus
                        placeholder="Search commands or navigate..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none font-medium"
                    />
                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-400">ESC</span>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4 scroll-smooth">
                    {filteredActions.length > 0 ? (
                        <div className="space-y-6">
                            {["Navigation", "Work", "Admin", "System"].map(category => {
                                const categoryActions = filteredActions.filter(a => a.category === category);
                                if (categoryActions.length === 0) return null;

                                return (
                                    <div key={category} className="space-y-2">
                                        <h3 className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {category}
                                        </h3>
                                        <div className="space-y-1">
                                            {categoryActions.map(action => (
                                                <button
                                                    key={action.name}
                                                    onClick={() => navigate(action.href)}
                                                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 group transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-2 bg-slate-50 dark:bg-slate-800 dark:group-hover:bg-slate-700 rounded-xl">
                                                            <action.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">
                                                            {action.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Go to page
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <div className="flex justify-center mb-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full">
                                    <AlertCircle className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                </div>
                            </div>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No results found for &quot;{search}&quot;</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select</span>
                            <div className="h-4 w-4 flex items-center justify-center rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                <span className="text-[10px] text-slate-500 leading-none">⏎</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navigate</span>
                            <div className="flex gap-1">
                                <div className="h-4 w-4 flex items-center justify-center rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-[10px] text-slate-500">↑</div>
                                <div className="h-4 w-4 flex items-center justify-center rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-[10px] text-slate-500">↓</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-50">
                        <CommandIcon className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Portal v2.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

const AlertCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);
