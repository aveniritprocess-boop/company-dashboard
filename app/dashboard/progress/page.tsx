"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getCachedTasks } from "@/lib/db";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { ProgressSummary } from "@/components/ProgressSummary";

interface Task {
  id: string;
  createdAt: any; // Timestamp
  status: string;
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [growthData, setGrowthData] = useState<{ name: string; tasks: number }[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    total: 0,
    efficiency: 0
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const { data: tasks } = await getCachedTasks(user.uid);
        const typedTasks = tasks as Task[];

        const pendingCount = typedTasks.filter(t => t.status === "pending").length;
        const completedCount = typedTasks.filter(t => t.status === "completed").length;
        const totalCount = typedTasks.length;
        const efficiency = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        setStats({
          pending: pendingCount,
          completed: completedCount,
          total: totalCount,
          efficiency
        });

        // Group tasks by date (last 7 days or so) to show activity/growth
        const last7Days = new Map<string, number>();
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          last7Days.set(dateStr, 0);
        }

        typedTasks.forEach(task => {
          if (task.createdAt) {
            const date = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
            const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            if (last7Days.has(dateStr)) {
              last7Days.set(dateStr, (last7Days.get(dateStr) || 0) + 1);
            }
          }
        });

        const chartData = Array.from(last7Days.entries()).map(([name, tasks]) => ({
          name,
          tasks
        }));

        setGrowthData(chartData);

      } catch (error) {
        console.error("Error fetching progress details", error);
      }
    }

    fetchData();
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Progress & Insights</h1>
        <p className="text-gray-500 dark:text-gray-400">Track your productivity trends and completion rates.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Tasks", value: stats.pending, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/10" },
          { label: "Completed Tasks", value: stats.completed, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/10" },
          { label: "Total Assignments", value: stats.total, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/10" },
          { label: "Efficiency Rate", value: `${stats.efficiency}%`, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/10" },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-6 rounded-2xl border border-white/10 shadow-sm`}>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <ProgressSummary />

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Task Activity (Last 7 Days)</h3>
        <GrowthChart data={growthData} />
      </div>
    </div>
  );
}
