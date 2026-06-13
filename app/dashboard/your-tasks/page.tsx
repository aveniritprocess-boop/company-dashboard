"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { TasksHub } from "@/components/tasks/TasksHub";
import { ListChecks } from "lucide-react";

function YourTasksContent() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                    <ListChecks className="h-7 w-7 text-emerald-500" />
                    Your Tasks Workspace
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                    Individual workspace containing work assigned to you, self-created items, and task progress.
                </p>
            </div>

            <TasksHub defaultFilter="my-tasks" defaultTab="list" />
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
