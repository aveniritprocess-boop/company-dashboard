"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { TasksHub } from "@/components/tasks/TasksHub";
import { UserCheck } from "lucide-react";

function TasksAssignedContent() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                    <UserCheck className="h-7 w-7 text-orange-500" />
                    Delegated Actions Portal
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                    Monitor actions you delegated to employees, approve completions, and check recent status transitions.
                </p>
            </div>

            <TasksHub defaultFilter="assigned-by-me" defaultTab="list" />
        </div>
    );
}

export default function TasksAssignedPage() {
    return (
        <RoleGuard allowedRoles={["employee", "team_lead", "manager", "agm", "hr", "admin", "md", "ceo"]} fallbackPath="/dashboard">
            <TasksAssignedContent />
        </RoleGuard>
    );
}
