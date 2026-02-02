"use client";

import { useAuth } from "@/components/AuthProvider";
import { ProfileCard } from "@/components/ProfileCard";
import { ProgressSummary } from "@/components/ProgressSummary";
import { DashboardShortcuts } from "@/components/DashboardShortcuts";
import { DashboardAttendanceWidget } from "@/components/DashboardAttendanceWidget";
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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-10 shadow-xl sm:px-12 sm:py-16">
                <div className="relative z-10">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-2 text-indigo-100 mb-2">
                            <Sparkles className="h-5 w-5" />
                            <span className="text-sm font-medium uppercase tracking-wider">Overview</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            {getGreeting()}, {user?.displayName?.split(" ")[0] || "User"}!
                        </h1>
                        <p className="mt-4 text-lg text-indigo-100 max-w-lg">
                            Track your projects, manage tasks, and optimize your workflow all in one place.
                        </p>
                    </div>
                </div>
                
                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute bottom-0 right-20 -mb-20 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Stats & Shortcuts */}
                <div className="lg:col-span-8 space-y-8">
                    <DashboardShortcuts />
                    <ProgressSummary />
                    
                    {/* Recent Activity Placeholder - Could be a real component later */}
                    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activity</h3>
                             <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium">View all</button>
                        </div>
                        <DashboardAttendanceWidget />
                    </div>
                </div>

                {/* Right Column: Profile & Secondary Info */}
                <div className="lg:col-span-4 space-y-8">
                    <ProfileCard />
                    
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
