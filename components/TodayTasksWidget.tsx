"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToAllTasks, subscribeToAllTasksForUser, Task } from "@/lib/tasks";
import { subscribeToAllUsers } from "@/lib/users";
import {
    CheckCircle2,
    Clock,
    User,
    Calendar,
    ChevronRight
} from "lucide-react";
import Link from "next/link";

export function TodayTasksWidget() {
    const { user, role } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [users, setUsers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    // Track if component is still mounted to avoid state updates after unmount
    const mountedRef = useRef(true);

    const isAdmin = role === "admin" || role === "ceo" || role === "md" || role === "super_admin";

    // Load user names once auth is ready; realtime so it recovers automatically
    // if the initial subscribe races Firebase Auth's post-login state restore
    // instead of leaving the name lookup permanently empty for the session.
    useEffect(() => {
        if (!user) return;
        // subscribeToAllUsers's own unsub() on cleanup guarantees no callbacks
        // fire after this effect tears down — mountedRef (below) guards the
        // separate tasks-subscription effect and must not be touched here, since
        // that effect's cleanup only runs on actual component unmount.
        const unsub = subscribeToAllUsers((fetchedUsers) => {
            const userMap: Record<string, string> = {};
            fetchedUsers.forEach(u => {
                userMap[u.uid] = u.name || "Unknown User";
            });
            setUsers(userMap);
        });

        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filterToday = (allTasks: Task[]): Task[] =>
            allTasks.filter(task => {
                const createdAt = task.createdAt as { toDate?: () => Date };
                const taskDate = createdAt?.toDate ? createdAt.toDate() : new Date(0);
                const taskDay = new Date(taskDate);
                taskDay.setHours(0, 0, 0, 0);
                return taskDay.getTime() === today.getTime();
            });

        let unsub: () => void;

        if (isAdmin) {
            // Admins/CEO see all tasks created today (with limit for perf)
            unsub = subscribeToAllTasks((allTasks) => {
                if (!mountedRef.current) return;
                setTasks(filterToday(allTasks));
                setLoading(false);
            }, 50);
        } else {
            // Managers and employees see only their own tasks
            unsub = subscribeToAllTasksForUser(user.uid, (allTasks) => {
                if (!mountedRef.current) return;
                setTasks(filterToday(allTasks));
                setLoading(false);
            });
        }

        return () => unsub?.();
    }, [user, role, isAdmin]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 animate-pulse">
                <div className="h-6 w-48 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-indigo-500" />
                        Today&apos;s Tasks &amp; Status
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Live overview of today&apos;s assignments.
                    </p>
                </div>
                <Link
                    href="/dashboard/your-tasks"
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group"
                >
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-500" />
                </Link>
            </div>

            {tasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                    <div className="h-16 w-16 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                        <Clock className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">No tasks created today</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        New tasks assigned today will appear here.
                    </p>
                </div>
            ) : (
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[400px]">
                    {tasks.map((task) => (
                        <div
                            key={task.id}
                            className="group bg-slate-50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 p-4 rounded-2xl transition-all duration-300"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {task.taskText}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <User className="h-3 w-3" />
                                            {Array.isArray(task.assignedTo)
                                                ? task.assignedTo.map(uid => users[uid] || "User").join(", ")
                                                : users[task.assignedTo as string] || "User"
                                            }
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${task.status === "completed" || task.status === "done"
                                            ? "text-emerald-500"
                                            : "text-amber-500"
                                            }`}>
                                            {task.status === "completed" || task.status === "done"
                                                ? <CheckCircle2 className="h-3 w-3" />
                                                : <Clock className="h-3 w-3" />
                                            }
                                            {task.status.replace("_", " ")}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
