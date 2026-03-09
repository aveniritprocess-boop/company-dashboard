"use client";

import { useAuth } from "@/components/AuthProvider";
import { ProfileCard } from "@/components/ProfileCard";
import { ProgressSummary } from "@/components/ProgressSummary";
import { DashboardShortcuts } from "@/components/DashboardShortcuts";
import { DashboardAttendanceWidget } from "@/components/DashboardAttendanceWidget";
import { RecentActivity } from "@/components/RecentActivity";
import { TaskAnalyticsWidget } from "@/components/tasks/TaskAnalyticsWidget";
import { DashboardSearch } from "@/components/DashboardSearch";
import { Sparkles } from "lucide-react";

export default function DashboardPage() {
    const { user } = useAuth();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-8 py-10 shadow-2xl border border-slate-800 sm:px-12 sm:py-16 group">
                <div className="relative z-10">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-2 text-indigo-400 mb-4 animate-pulse">
                            <Sparkles className="h-5 w-5 fill-indigo-400/20" />
                            <span className="text-xs font-bold uppercase tracking-[0.2em]">Platform Overview</span>
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl text-balance">
                            {getGreeting()}, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-sky-400">{user?.displayName?.split(" ")[0] || "User"}</span>!
                        </h1>
                        <p className="mt-6 text-lg text-slate-400 max-w-lg leading-relaxed">
                            Welcome back to your command center. Everything you need to manage your projects and team is right here.
                        </p>
                    </div>
                </div>

                {/* Abstract Decorative Elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px] group-hover:bg-indigo-500/20 transition-colors duration-1000" />
                <div className="absolute bottom-0 right-20 -mb-20 h-80 w-80 rounded-full bg-sky-500/10 blur-[100px] group-hover:bg-sky-500/20 transition-colors duration-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
            </div>

            <DashboardSearch />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Stats & Shortcuts */}
                <div className="lg:col-span-8 space-y-8">
                    <DashboardShortcuts />
                    <ProgressSummary />
                    <TaskAnalyticsWidget />

                    {/* Recent Activity Feed */}
                    <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Recent Activity</h3>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Updates</span>
                            </div>
                        </div>
                        <RecentActivity />
                    </div>
                </div>

                {/* Right Column: Profile & Secondary Info */}
                <div className="lg:col-span-4 space-y-8">
                    <ProfileCard />
                    <DashboardAttendanceWidget />

                    {/* Quick Tips or Announcements */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 rounded-xl p-6 border border-indigo-100 dark:border-indigo-500/20">
                        <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-2">Pro Tip</h4>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300">
                            Use keyboard shortcuts to quickly navigate between tabs. Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 font-mono text-xs">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 font-mono text-xs">K</kbd> to open the command menu (coming soon).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
