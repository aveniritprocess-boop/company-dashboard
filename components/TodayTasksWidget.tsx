"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToAllTasks, subscribeToTaskComments, Task, TaskComment } from "@/lib/tasks";
import { subscribeToAllUsers, AppUserSummary } from "@/lib/users";
import {
    CheckCircle2,
    Clock,
    MessageSquare,
    User,
    Calendar,
    Loader2,
    ChevronRight
} from "lucide-react";
import Link from "next/link";

interface TaskWithComments extends Task {
    lastComment?: TaskComment;
}

export function TodayTasksWidget() {
    const { user, role } = useAuth();
    const [tasks, setTasks] = useState<TaskWithComments[]>([]);
    const [users, setUsers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        // Fetch users for name mapping
        const unsubUsers = subscribeToAllUsers((fetchedUsers) => {
            const userMap: Record<string, string> = {};
            fetchedUsers.forEach(u => {
                userMap[u.uid] = u.name || "Unknown User";
            });
            setUsers(userMap);
        });

        // Fetch today's tasks
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unsubTasks = subscribeToAllTasks((allTasks) => {
            // Filter tasks created today
            const todayTasks = allTasks.filter(task => {
                const taskDate = task.createdAt?.toDate ? task.createdAt.toDate() : new Date();
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() === today.getTime();
            });

            setTasks(todayTasks as TaskWithComments[]);
            setLoading(false);

            // For each today's task, subscribe to comments to get the "people response"
            todayTasks.forEach(task => {
                subscribeToTaskComments(task.id, (comments) => {
                    if (comments.length > 0) {
                        const lastComment = comments[comments.length - 1];
                        setTasks(prev => prev.map(t =>
                            t.id === task.id ? { ...t, lastComment } : t
                        ));
                    }
                });
            });
        });

        return () => {
            unsubUsers();
            unsubTasks();
        };
    }, [user]);

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
                        Today's Tasks & Status
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Live overview of today's assignments and responses.
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
                                        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${task.status === 'completed' || task.status === 'done'
                                            ? 'text-emerald-500'
                                            : 'text-amber-500'
                                            }`}>
                                            {task.status === 'completed' || task.status === 'done'
                                                ? <CheckCircle2 className="h-3 w-3" />
                                                : <Clock className="h-3 w-3" />
                                            }
                                            {task.status.replace("_", " ")}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {task.lastComment && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                    "{task.lastComment.comment}"
                                    <div className="flex items-start gap-2 bg-white dark:bg-slate-900/50 p-2 rounded-xl">
                                        <MessageSquare className="h-3 w-3 text-indigo-400 mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-indigo-500 mb-0.5">
                                                {task.lastComment.commentedByName || "User"} response:
                                            </p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic leading-relaxed">
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
