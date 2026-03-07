"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RoleGuard } from "@/components/RoleGuard";
import { createTask, subscribeToTasksAssignedBy, subscribeToAllTasks, Task } from "@/lib/tasks";
import { getAllUsers, AppUserSummary } from "@/lib/users";
import {
    UserCheck,
    Plus,
    Loader2,
    X,
    ClipboardList,
    Calendar,
    CheckCircle2,
    Clock
} from "lucide-react";

interface AssignForm {
    assignedTo: string;
    taskText: string;
}

const emptyForm = (): AssignForm => ({
    assignedTo: "",
    taskText: "",
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

        let unsub;
        if (role === "admin" || role === "ceo") {
            unsub = subscribeToAllTasks((tasks) => {
                setAssignedTasks(tasks);
                setLoadingTasks(false);
            });
        } else {
            unsub = subscribeToTasksAssignedBy(user.uid, (tasks) => {
                setAssignedTasks(tasks);
                setLoadingTasks(false);
            });
        }
        return () => unsub();
    }, [user, role]);

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
                form.assignedTo
            );
            showToast("Task assigned successfully.", "success");
            setForm(emptyForm());
            setShowModal(false);
        } catch (error) {
            console.error(error);
            showToast("Failed to assign task.", "error");
        } finally {
            setSubmitting(false);
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
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Tasks Assigned By You ({assignedTasks.length})
                    </h2>
                    {assignedTasks.map((task) => {
                        const assignedEmployee = employees.find((e) => e.uid === task.assignedTo);
                        return (
                            <div
                                key={task.id}
                                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${task.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                                {task.status}
                                            </span>
                                            {task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
                                        </div>
                                        <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">
                                            {task.taskText}
                                        </p>
                                        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400">
                                            {task.createdAt && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {task.createdAt.toDate ? task.createdAt.toDate().toLocaleDateString() : "Just now"}
                                                </span>
                                            )}
                                            {assignedEmployee && (
                                                <span className="flex items-center gap-1">
                                                    <UserCheck className="h-3.5 w-3.5" />
                                                    To: {assignedEmployee.name || assignedEmployee.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
        <RoleGuard allowedRoles={["admin", "manager", "ceo"]} fallbackPath="/dashboard">
            <TaskGivenContent />
        </RoleGuard>
    );
}
