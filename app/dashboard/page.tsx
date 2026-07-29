"use client";

import { useAuth } from "@/components/AuthProvider";
import dynamic from "next/dynamic";

const ProfileCard = dynamic(() => import("@/components/ProfileCard").then(mod => ({ default: mod.ProfileCard })), { ssr: false });
const ProgressSummary = dynamic(() => import("@/components/ProgressSummary").then(mod => ({ default: mod.ProgressSummary })), { ssr: false });
const DashboardShortcuts = dynamic(() => import("@/components/DashboardShortcuts").then(mod => ({ default: mod.DashboardShortcuts })), { ssr: false });
const DashboardAttendanceWidget = dynamic(() => import("@/components/DashboardAttendanceWidget").then(mod => ({ default: mod.DashboardAttendanceWidget })), { ssr: false });
const RecentActivity = dynamic(() => import("@/components/RecentActivity").then(mod => ({ default: mod.RecentActivity })), { ssr: false });
const TaskAnalyticsWidget = dynamic(() => import("@/components/tasks/TaskAnalyticsWidget").then(mod => ({ default: mod.TaskAnalyticsWidget })), { ssr: false });
const RecentTaskSummary = dynamic(() => import("@/components/tasks/RecentTaskSummary").then(mod => ({ default: mod.RecentTaskSummary })), { ssr: false });
const DashboardSearch = dynamic(() => import("@/components/DashboardSearch").then(mod => ({ default: mod.DashboardSearch })), { ssr: false });
const TodayTasksWidget = dynamic(() => import("@/components/TodayTasksWidget").then(mod => ({ default: mod.TodayTasksWidget })), { ssr: false });
const DayReportWidget = dynamic(() => import("@/components/DayReportWidget").then(mod => ({ default: mod.DayReportWidget })), { ssr: false });
const QuickTaskWidget = dynamic(() => import("@/components/tasks/QuickTaskWidget").then(mod => ({ default: mod.QuickTaskWidget })), { ssr: false });
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
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 shadow-md border border-slate-800 sm:px-5 sm:py-4 group">
                <div className="relative z-10 flex items-center justify-between">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-1.5 text-indigo-400 mb-1 animate-pulse">
                            <Sparkles className="h-3 w-3 fill-indigo-400/20" />
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Platform Overview</span>
                        </div>
                        <h1 className="text-base font-medium tracking-tight text-white sm:text-lg lg:text-xl text-balance">
                            {getGreeting()}, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-sky-400">{user?.displayName?.split(" ")[0] || "User"}</span>!
                        </h1>
                        <p className="mt-1 text-xs text-slate-400 max-w-lg leading-snug">
                            Welcome back to your command center. Everything you need to manage your projects and team is right here.
                        </p>
                    </div>
                </div>

                {/* Abstract Decorative Elements */}
                <div className="absolute top-0 right-0 -mr-5 -mt-5 h-20 w-20 rounded-full bg-indigo-500/10 blur-[30px] group-hover:bg-indigo-500/20 transition-colors duration-1000" />
                <div className="absolute bottom-0 right-5 -mb-5 h-16 w-16 rounded-full bg-sky-500/10 blur-[20px] group-hover:bg-sky-500/20 transition-colors duration-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] pointer-events-none" />
            </div>

            <DashboardSearch />

            <div className="mb-8">
                <QuickTaskWidget />
            </div>

            <div className="mb-8">
                <RecentTaskSummary showDiary={true} timeWindowDays={2} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Stats & Shortcuts */}
                <div className="lg:col-span-8 space-y-8">
                    <DashboardShortcuts />
                    <ProgressSummary />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <TodayTasksWidget />
                        <DayReportWidget />
                    </div>

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
