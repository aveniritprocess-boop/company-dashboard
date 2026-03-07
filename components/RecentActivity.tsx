"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToUserTasks } from "@/lib/tasks";
import { CheckCircle2, Clock, ArrowRight, ClipboardList } from "lucide-react";
import Link from "next/link";

export function RecentActivity() {
    const { user } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        // Subscribe to tasks as a source of activity
        const unsubscribeTasks = subscribeToUserTasks(user.uid, (tasks) => {
            const taskActivities = tasks.slice(0, 5).map(task => ({
                id: task.id,
                type: "task",
                title: task.taskText,
                status: task.status,
                time: task.createdAt?.toDate ? task.createdAt.toDate() : new Date(),
                icon: task.status === "completed" ? CheckCircle2 : Clock,
                color: task.status === "completed" ? "text-emerald-500" : "text-amber-500"
            }));

            setActivities(taskActivities);
            setLoading(false);
        });

        return () => {
            unsubscribeTasks();
        };
    }, [user]);

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="h-3 w-1/4 bg-slate-50 dark:bg-slate-800/50 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-16 w-16 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                    <ClipboardList className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <h4 className="text-slate-900 dark:text-white font-bold">No recent activity</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
                    Tasks and updates will appear here once they start rolling in.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800/50 ml-[-0.5px]" />
                <div className="space-y-8">
                    {activities.map((activity) => (
                        <div key={activity.id} className="relative flex items-start gap-5 group">
                            <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                <activity.icon className={`h-5 w-5 ${activity.color}`} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                        {activity.title}
                                    </p>
                                    <time className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                                        {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(activity.time)}
                                    </time>
                                </div>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <span className={`h-1.5 w-1.5 rounded-full ${activity.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    {activity.status === 'completed' ? 'Task completed successfully' : 'Task pending verification'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Link href="/dashboard/your-tasks" className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all">
                View Full Timeline <ArrowRight className="h-3 w-3" />
            </Link>
        </div>
    );
}
