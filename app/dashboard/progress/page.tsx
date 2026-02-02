"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getCachedTasks } from "@/lib/db";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { ProgressSummary } from "@/components/ProgressSummary";

interface Task {
  id: string;
  createdAt: any; // Timestamp
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [growthData, setGrowthData] = useState<{ name: string; tasks: number }[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const { data: tasks } = await getCachedTasks(user.uid);
        const typedTasks = tasks as Task[];

        // Group tasks by date (last 7 days or so) to show activity/growth
        // Note: In a real app we would query 'createdAt' specifically. 
        // Here we do a client-side transform for simplicity.
        
        const last7Days = new Map<string, number>();
        const today = new Date();

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            last7Days.set(dateStr, 0);
        }

        // Aggregate counts
        typedTasks.forEach(task => {
            if (task.createdAt) {
                // Handle Firestore Timestamp or Date object
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

      <ProgressSummary />

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Task Activity (Last 7 Days)</h3>
        <GrowthChart data={growthData} />
      </div>
    </div>
  );
}
