"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { TasksHub } from "@/components/tasks/TasksHub";
import { ClipboardList } from "lucide-react";

function TaskSummaryContent() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
          <ClipboardList className="h-7 w-7 text-indigo-500" />
          Recent Tasks & Diary Summary
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
          Live real-time aggregation of task milestones and daily work diary submissions from your team.
        </p>
      </div>

      <TasksHub defaultFilter="all" defaultTab="team-feed" />
    </div>
  );
}

export default function TaskSummaryPage() {
  return (
    <RoleGuard allowedRoles={["employee", "manager", "admin", "ceo"]} fallbackPath="/dashboard">
      <TaskSummaryContent />
    </RoleGuard>
  );
}
