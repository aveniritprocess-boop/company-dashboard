"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getCachedTodos, getCachedTasks } from "@/lib/db";
import { CheckCircle2, ListTodo, Activity, TrendingUp } from "lucide-react";
import { ProgressChart } from "./charts/ProgressChart";

interface Todo {
  id: string;
  completed: boolean;
}

interface Task {
  id: string;
  status: "pending" | "in-progress" | "completed";
}

export function ProgressSummary() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalTodos: 0,
    completedTodos: 0,
    totalTasks: 0,
    completedTasks: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      
      try {
        const [{ data: todos }, { data: tasks }] = await Promise.all([
          getCachedTodos(user.uid),
          getCachedTasks(user.uid)
        ]);

        const typedTodos = todos as Todo[];
        const typedTasks = tasks as Task[];

        setStats({
          totalTodos: typedTodos.length,
          completedTodos: typedTodos.filter(t => t.completed).length,
          totalTasks: typedTasks.length,
          completedTasks: typedTasks.filter(t => t.status === "completed").length,
          loading: false,
        });
      } catch (error) {
        console.error("Failed to fetch stats", error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    }

    fetchStats();
  }, [user]);

  if (stats.loading) {
    return (
        <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl p-6 animate-pulse">
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
            </div>
        </div>
    );
  }

  const totalItems = stats.totalTodos + stats.totalTasks;
  const completedItems = stats.completedTodos + stats.completedTasks;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  
  const chartData = [
    { name: "Completed", value: completedItems, color: "#4f46e5" }, // Indigo 600
    { name: "Pending", value: totalItems - completedItems, color: "#e5e7eb" }, // Gray 200
  ];

  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" />
            Productivity Overview
          </h2>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              On Track
          </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats Column */}
        <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/10 transition-transform hover:scale-[1.02]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Todos</p>
                        <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedTodos}</span>
                        <span className="text-sm text-gray-500">/ {stats.totalTodos}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-indigo-200 dark:bg-indigo-900/30 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-indigo-500 rounded-full" 
                            style={{ width: `${stats.totalTodos > 0 ? (stats.completedTodos / stats.totalTodos) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/10 transition-transform hover:scale-[1.02]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Tasks</p>
                        <ListTodo className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedTasks}</span>
                         <span className="text-sm text-gray-500">/ {stats.totalTasks}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-emerald-200 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <span className="block text-sm font-medium text-gray-500 dark:text-gray-400">Total Completion</span>
                    <span className="text-xs text-gray-400">Average across all categories</span>
                </div>
                <div className="text-right">
                    <span className="block text-3xl font-bold text-gray-900 dark:text-white">{progress}%</span>
                </div>
            </div>
        </div>

        {/* Chart Column */}
        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
             <ProgressChart data={chartData} />
             <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                 Visual breakdown of your completed vs pending items.
             </p>
        </div>
      </div>
    </div>
  );
}
