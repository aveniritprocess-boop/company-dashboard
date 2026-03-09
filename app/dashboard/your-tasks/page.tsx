"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToUserTasks, updateTaskStatus, Task } from "@/lib/tasks";
import {
    ListChecks,
    Loader2,
    AlertCircle
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { EnhancedTaskCard } from "@/components/tasks/EnhancedTaskCard";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

function YourTasksContent() {
    const { user, role } = useAuth();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const unsub = subscribeToUserTasks(user.uid, (data, last) => {
            setTasks(data);
            setLastDoc(last);
            setHasMore(data.length === 20); // Syncs with limit(20)
            setLoading(false);
        }, 20);
        return () => unsub();
    }, [user]);

    const loadMore = () => {
        if (!user || !lastDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        
        const unsub = subscribeToUserTasks(user.uid, (data, last) => {
            setTasks(prev => {
                const newTasks = data.filter(d => !prev.find(p => p.id === d.id));
                return [...prev, ...newTasks];
            });
            setLastDoc(last);
            setHasMore(data.length === 20);
            setLoadingMore(false);
            unsub(); // single fetch essentially
        }, 20, lastDoc);
    };

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
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
                        <EnhancedTaskCard 
                            key={task.id} 
                            task={task} 
                            currentUserId={user!.uid} 
                            currentUserRole={role || undefined}
                            currentUserName={user?.displayName || "Employee"}
                        />
                    ))}

                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors disabled:opacity-50"
                            >
                                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loadingMore ? "Loading..." : "Load More Tasks"}
                            </button>
                        </div>
                    )}
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

