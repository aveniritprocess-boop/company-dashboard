"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToUserTasks, updateTaskStatus, Task } from "@/lib/tasks";
import {
    ListChecks,
    Loader2,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";

function YourTasksContent() {
    const { user } = useAuth();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        if (!user) return;
        const unsub = subscribeToUserTasks(user.uid, (data) => {
            setTasks(data);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleMarkCompleted = async (taskId: string) => {
        try {
            await updateTaskStatus(taskId, "completed");
            showToast("Task marked as completed!", "success");
        } catch {
            showToast("Failed to update task.", "error");
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {toast && (
                <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ListChecks className="h-7 w-7 text-emerald-500" />
                    Your Tasks
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Tasks assigned to you — {tasks.length} total.
                </p>
            </div>

            {/* Task List */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <AlertCircle className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No tasks assigned to you yet.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => (
                        <div
                            key={task.id}
                            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${task.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                            {task.status}
                                        </span>
                                        {task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
                                    </div>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                                        {task.taskText}
                                    </p>
                                    <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {task.createdAt && task.createdAt.toDate ? task.createdAt.toDate().toLocaleDateString() : "Just now"}
                                    </div>
                                </div>
                                {task.status === "pending" && (
                                    <button
                                        onClick={() => handleMarkCompleted(task.id)}
                                        className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Mark Completed
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function YourTasksPage() {
    return (
        <RoleGuard allowedRoles={["employee", "manager", "admin", "ceo"]} fallbackPath="/dashboard">
            <YourTasksContent />
        </RoleGuard>
    );
}

