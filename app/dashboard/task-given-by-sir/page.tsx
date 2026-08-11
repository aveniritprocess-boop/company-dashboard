"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RoleGuard } from "@/components/RoleGuard";
import { createTask, subscribeToTasksAssignedBy, subscribeToAllTasks, Task } from "@/lib/tasks";
import { getAllUsers, AppUserSummary } from "@/lib/users";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import {
    UserCheck,
    Plus,
    Loader2,
    X,
    ClipboardList
} from "lucide-react";

import { EnhancedTaskCard } from "@/components/tasks/EnhancedTaskCard";

interface AssignForm {
    assignedTo: string;
    taskText: string;
    startDate: string;
    dueDate: string;
}

const emptyForm = (): AssignForm => ({
    assignedTo: "",
    taskText: "",
    startDate: "",
    dueDate: "",
});

function TaskGivenContent() {
    const { user, role } = useAuth();
    const [employees, setEmployees] = useState<AppUserSummary[]>([]);
    const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<AssignForm>(emptyForm());
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchUsers = useCallback(async () => {
        try {
            const users = await getAllUsers();
            // Show all users except current admin if needed, or just all users
            setEmployees(users.filter((u) => u.uid !== user?.uid));
        } catch {
            showToast("Failed to load employees.", "error");
        } finally {
            setLoadingUsers(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (!user || !role) return;

        setLoadingTasks(true);
        let unsub: () => void;
        if (role === "admin" || role === "ceo" || role === "md") {
            unsub = subscribeToAllTasks((data, last) => {
                setAssignedTasks(data);
                setLastDoc(last);
                setHasMore(data.length === 20);
                setLoadingTasks(false);
            }, 20);
        } else {
            unsub = subscribeToTasksAssignedBy(user.uid, (data, last) => {
                setAssignedTasks(data);
                setLastDoc(last);
                setHasMore(data.length === 20);
                setLoadingTasks(false);
            }, 20);
        }
        return () => unsub();
    }, [user, role]);

    const loadMore = () => {
        if (!user || !role || !lastDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);

        let unsub: () => void;
        if (role === "admin" || role === "ceo" || role === "md") {
            unsub = subscribeToAllTasks((data, last) => {
                setAssignedTasks(prev => {
                    const newTasks = data.filter(d => !prev.find(p => p.id === d.id));
                    return [...prev, ...newTasks];
                });
                setLastDoc(last);
                setHasMore(data.length === 20);
                setLoadingMore(false);
                unsub();
            }, 20, lastDoc);
        } else {
            unsub = subscribeToTasksAssignedBy(user.uid, (data, last) => {
                setAssignedTasks(prev => {
                    const newTasks = data.filter(d => !prev.find(p => p.id === d.id));
                    return [...prev, ...newTasks];
                });
                setLastDoc(last);
                setHasMore(data.length === 20);
                setLoadingMore(false);
                unsub();
            }, 20, lastDoc);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!form.assignedTo) { showToast("Please select an employee.", "error"); return; }
        if (!form.taskText.trim()) { showToast("Task description is required.", "error"); return; }

        setSubmitting(true);
        try {
            await createTask(
                form.taskText,
                "", // No detailed description field in this basic form yet
                user.uid,
                form.assignedTo,
                "medium",
                form.startDate,
                form.dueDate
            );
            showToast("Task assigned successfully.", "success");
            setForm(emptyForm());
            setShowModal(false);
        } catch (error: unknown) {
            const errorObj = error as { code?: string; message?: string; stack?: string };
            console.error("Task Assignment Error:", {
                code: errorObj?.code,
                message: errorObj?.message,
                stack: errorObj?.stack,
                error: error
            });
            showToast(`Failed to assign task: ${errorObj?.message || String(error)}`, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const totalTasks = assignedTasks.length;
    const pendingTasks = assignedTasks.filter(t => t.status === "pending").length;
    const inProgressTasks = assignedTasks.filter(t => t.status === "in_progress").length;
    const completedTasks = assignedTasks.filter(t => t.status === "completed").length;
    
    const overdueTasks = assignedTasks.filter(t => {
        if (t.status === "completed" || !t.dueDate) return false;
        const due = new Date(t.dueDate);
        const now = new Date();
        due.setHours(0,0,0,0);
        now.setHours(0,0,0,0);
        return now > due;
    }).length;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {toast && (
                <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <UserCheck className="h-7 w-7 text-orange-500" />
                        Task Given By Sir
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Assign tasks to your team members.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Assign Task
                </button>
            </div>

            {/* Enhanced Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalTasks}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50 shadow-sm text-center">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Pending</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{pendingTasks}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm text-center">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">In Progress</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{inProgressTasks}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm text-center">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Completed</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{completedTasks}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/50 shadow-sm text-center">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Overdue</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{overdueTasks}</p>
                </div>
            </div>

            {/* Assigned Tasks List */}
            {loadingTasks ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : assignedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <ClipboardList className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No tasks assigned yet.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="mt-3 text-sm text-orange-500 font-medium hover:underline"
                    >
                        Assign your first task
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Tasks Assigned By You ({assignedTasks.length})
                    </h2>
                    {assignedTasks.map((task) => (
                        <EnhancedTaskCard 
                            key={task.id} 
                            task={task} 
                            currentUserId={user!.uid} 
                            currentUserRole={role || undefined}
                            currentUserName={user?.displayName || "Admin"}
                        />
                    ))}

                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-orange-600 dark:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors disabled:opacity-50"
                            >
                                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loadingMore ? "Loading..." : "Load More Tasks"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Assign Task Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Assign New Task
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Employee Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Assign To <span className="text-red-500">*</span>
                                </label>
                                {loadingUsers ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading employees...
                                    </div>
                                ) : (
                                    <select
                                        value={form.assignedTo}
                                        onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        required
                                    >
                                        <option value="">Select employee…</option>
                                        {employees.map((emp) => (
                                            <option key={emp.uid} value={emp.uid}>
                                                {emp.name ? `${emp.name} (${emp.email})` : emp.email || emp.uid}
                                            </option>
                                        ))}

                                    </select>
                                )}
                            </div>

                            {/* Task Text */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Task Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={form.taskText}
                                    onChange={(e) => setForm({ ...form, taskText: e.target.value })}
                                    rows={4}
                                    placeholder="What needs to be done?"
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Due Date
                                    </label>
                                    <input
                                        type="date"
                                        value={form.dueDate}
                                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
                                >
                                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Assign Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TaskGivenBySirPage() {
    return (
        <RoleGuard allowedRoles={["admin", "manager", "ceo", "md"]} fallbackPath="/dashboard">
            <TaskGivenContent />
        </RoleGuard>
    );
}
