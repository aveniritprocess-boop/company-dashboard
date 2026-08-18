"use client";

import { useAuth } from "@/components/AuthProvider";
import { isManagerTierOrAbove } from "@/lib/roles";
import {
  ClipboardList,
  BarChart3,
  Settings,
  Zap,
  UserCheck,
} from "lucide-react";
import { QuickActionCard } from "@/components/QuickActionCard";

export function DashboardShortcuts() {
  const { role } = useAuth();

  const shortcuts = [
    {
      name: "Daily Diary",
      href: "/dashboard/daily-diary",
      icon: ClipboardList,
      theme: "blue" as const,
    },
    ...(isManagerTierOrAbove(role)
      ? [{
        name: "Task Assigned",
        href: "/dashboard/tasks-assigned",
        icon: UserCheck,
        theme: "orange" as const,
      }]
      : []),
    {
      name: "Progress",
      href: "/dashboard/progress",
      icon: BarChart3,
      theme: "purple" as const,
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      theme: "gray" as const,
    },
  ];


  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {shortcuts.map((item) => (
          <QuickActionCard key={item.name} {...item} />
        ))}
      </div>
    </div>
  );
}
