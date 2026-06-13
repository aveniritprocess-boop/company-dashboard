"use client";

import { useEffect, useState } from "react";
import { subscribeToRecentTasks, Task } from "@/lib/tasks";
import { getAllUsers, AppUserSummary } from "@/lib/users";
import { Search, Filter, Loader2, CheckCircle2, Clock, ListTodo, AlignLeft, Eye } from "lucide-react";
import { TaskDetailsModal } from "./TaskDetailsModal";

export function AdminTaskSummaryWidget() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<AppUserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState("all");
    const [selectedTaskDetails, setSelectedTaskDetails] = useState<Task | null>(null);

    useEffect(() => {
        let unsubTasks: () => void;
        async function init() {
            try {
                const users = await getAllUsers();
                setEmployees(users);
                unsubTasks = subscribeToRecentTasks(2, (data) => {
                    setTasks(data);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Failed to load summary data", error);
                setLoading(false);
            }
        }
        init();
        return () => {
            if (unsubTasks) unsubTasks();
        };
    }, []);

    const employeeMap = new Map<string, string>();
    employees.forEach(e => employeeMap.set(e.uid, e.name || "Unknown User"));

    const filteredTasks = tasks.filter(t => {
        const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        const assignedNames = assignees.map(uid => employeeMap.get(uid) || "Unknown");
        
        // Employee Dropdown Filter
        if (selectedEmployee !== "all" && !assignees.includes(selectedEmployee)) {
            return false;
        }

        // Search Query Filter
        if (searchQuery) {
            const matchesName = assignedNames.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesTitle = (t.title || t.taskText || "").toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesName && !matchesTitle) return false;
        }

        return true;
    });

    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.status === "completed" || t.status === "done").length;
    const pendingTasks = filteredTasks.filter(t => t.status === "pending" || t.status === "todo").length;

    const formatDate = (dateValue: unknown) => {
        if (!dateValue) return "N/A";
        // Handle Firestore Timestamp or standard Date string
        const d = (typeof dateValue === 'object' && 'toDate' in dateValue) 
            ? (dateValue as { toDate: () => Date }).toDate() 
            : new Date(dateValue as string | number | Date);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 border-teal-200 dark:border-teal-500/20';
            case 'rejected':
                return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20';
            case 'hold':
                return 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20';
            case 'completed':
            case 'done':
                return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
            case 'in_progress':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
            case 'pending':
            case 'todo':
            case 'backlog':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
            default:
                return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <ListTodo className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Tasks (48h)</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalTasks}</p>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Completed</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{completedTasks}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Not Started</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{pendingTasks}</p>
                    </div>
                </div>
            </div>

            {/* Main Widget Area */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            <AlignLeft className="h-5 w-5 text-indigo-500" />
                            Recent Tasks Summary
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Overview of tasks created in the last 48 hours.</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search tasks or names..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full sm:w-64"
                            />
                        </div>
                        <div className="relative w-full sm:w-auto">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <select
                                value={selectedEmployee}
                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full sm:w-48 appearance-none"
                            >
                                <option value="all">All Employees</option>
                                {employees.map(e => (
                                    <option key={e.uid} value={e.uid}>{e.name || e.email}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-4 whitespace-nowrap">Task Title</th>
                                <th className="px-6 py-4 whitespace-nowrap">Assignee</th>
                                <th className="px-6 py-4 whitespace-nowrap">Assigned By</th>
                                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 whitespace-nowrap">Priority</th>
                                <th className="px-6 py-4 whitespace-nowrap">Last Update</th>
                                <th className="px-6 py-4 whitespace-nowrap text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                                        No tasks found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map(task => {
                                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                                    const employeeNames = assignees.map(uid => employeeMap.get(uid) || "Unknown User").join(", ");
                                    
                                    return (
                                        <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-[12rem] truncate font-semibold" title={task.title || task.taskText}>
                                                {task.title || task.taskText}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                {employeeNames}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                                {employeeMap.get(task.assignedBy) || "Admin"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(task.status)}`}>
                                                    {task.status === 'pending' ? 'Not Started' : task.status.replace("_", " ")}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-bold uppercase ${task.priority === 'high' ? 'text-red-500' : task.priority === 'low' ? 'text-slate-400' : 'text-blue-500'}`}>
                                                    {task.priority || "Medium"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                                                {formatDate(task.updatedAt || task.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => setSelectedTaskDetails(task)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Modal */}
            {selectedTaskDetails && (
                <TaskDetailsModal 
                    task={selectedTaskDetails} 
                    onClose={() => setSelectedTaskDetails(null)} 
                    currentUserId="admin-dashboard-view"
                    currentUserName="Admin"
                    currentUserRole="admin"
                    users={employees}
                />
            )}
        </div>
    );
}
