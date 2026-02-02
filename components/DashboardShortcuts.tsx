"use client";

import Link from "next/link";
import {
  CheckSquare,
  ListTodo,
  BarChart,
  Settings,
  Zap
} from "lucide-react";

const shortcuts = [
  { name: "Todos", href: "/dashboard/todos", icon: CheckSquare, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-100 dark:border-blue-500/10" },
  { name: "Tasks", href: "/dashboard/tasks", icon: ListTodo, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-500/10" },
  { name: "Progress", href: "/dashboard/progress", icon: BarChart, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-100 dark:border-purple-500/10" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-900/20", border: "border-gray-100 dark:border-gray-500/10" },
];

export function DashboardShortcuts() {
  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h3>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {shortcuts.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border ${item.border} hover:shadow-md transition-all duration-200 group bg-opacity-50 hover:bg-opacity-100 ${item.bg.split(' ')[0] && 'bg-white'} dark:bg-transparent`}
          >
            <div className={`p-3 rounded-xl mb-3 ${item.bg} group-hover:scale-110 transition-transform duration-200`}>
              <item.icon className={`h-6 w-6 ${item.color}`} />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
