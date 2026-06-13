"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { TasksHub } from "@/components/tasks/TasksHub";
import { LayoutDashboard } from "lucide-react";

function TasksBoardContent() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
          <LayoutDashboard className="h-7 w-7 text-indigo-500" />
          Kanban Task Board
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
          Visual workspace workflow. Track progress, comments, and milestones from an MNC Kanban view.
        </p>
      </div>

      <TasksHub defaultFilter="all" defaultTab="board" />
    </div>
  );
}

export default function TasksPage() {
  return (
    <RoleGuard allowedRoles={["employee", "manager", "admin", "ceo"]} fallbackPath="/dashboard">
      <TasksBoardContent />
    </RoleGuard>
  );
}
