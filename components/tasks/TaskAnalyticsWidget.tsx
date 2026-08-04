"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToAllTasks, subscribeToUserTasks, Task } from "@/lib/tasks";
import { getAllUsers, AppUserSummary } from "@/lib/users";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { Loader2, PieChart as PieChartIcon, BarChart3 } from "lucide-react";

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

export function TaskAnalyticsWidget() {
  const { user, role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<AppUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const users = await getAllUsers();
        setEmployees(users);
      } catch (e) {
        console.error("Failed to load users for analytics", e);
      }
    }
    // Only admins/CEO load all users; managers/employees only need their own tasks
    if (role === "admin" || role === "ceo" || role === "md" || role === "super_admin") {
      loadUsers();
    }
  }, [role]);

  useEffect(() => {
    if (!user || !role) return;

    let unsub: () => void;
    
    if (role === "admin" || role === "ceo" || role === "super_admin") {
      unsub = subscribeToAllTasks((data, last) => {
        setTasks(data);
        setLastDoc(last);
        setHasMore(data.length === 20); // Assumes pageSize is 20
        setLoading(false);
      }, 20);
    } else {
      // Managers, team leads, and employees see only their own tasks
      unsub = subscribeToUserTasks(user.uid, (data, last) => {
        setTasks(data);
        setLastDoc(last);
        setHasMore(data.length === 20);
        setLoading(false);
      }, 20);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [user, role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return null; // Don't show if no tasks exist
  }

  const loadMore = () => {
    if (!user || !role || !lastDoc || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    let unsub: () => void;
    
    if (role === "admin" || role === "ceo" || role === "manager") {
      unsub = subscribeToAllTasks((data, last) => {
        setTasks(prev => {
          // Filter out duplicates to be safe, though real-time listener updates will handle it mostly. 
          // Since it's a new subscription with startAfter, we append.
          const newTasks = data.filter(d => !prev.find(p => p.id === d.id));
          return [...prev, ...newTasks];
        });
        setLastDoc(last);
        setHasMore(data.length === 20);
        setLoadingMore(false);
        unsub(); // One-shot for load more to avoid overlapping listeners
      }, 20, lastDoc);
    } else {
      unsub = subscribeToUserTasks(user.uid, (data, last) => {
        setTasks(prev => {
          const newTasks = data.filter(d => !prev.find(p => p.id === d.id));
          return [...prev, ...newTasks];
        });
        setLastDoc(last);
        setHasMore(data.length === 20);
        setLoadingMore(false);
        unsub();
      }, 20, lastDoc);
    }
  };

  // 1. Task Completion Pie Chart
  const pending = tasks.filter(t => t.status === "pending").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const completed = tasks.filter(t => t.status === "completed").length;
  
  const overdue = tasks.filter(t => {
    if (t.status === "completed" || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    const now = new Date();
    due.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    return now > due;
  }).length;

  const pieData = [
    { name: 'Pending', value: pending },
    { name: 'In Progress', value: inProgress },
    { name: 'Completed', value: completed },
  ].filter(d => d.value > 0);

  // 2. Employee Performance Bar Chart (Only for Managers/Admins/CEO)
  const showEmployeeStats = (role === "admin" || role === "ceo" || role === "manager") && employees.length > 0;
  
  let barData: { name: string; completed: number; active: number; }[] = [];
  if (showEmployeeStats) {
    const employeeMap = new Map<string, { name: string, completed: number, active: number }>();
    
    // Initialize map
    employees.forEach(emp => {
      // Skip CEO/Admin from performance chart if we want, but let's just include everyone with assigned tasks
      employeeMap.set(emp.uid, { name: emp.name?.split(" ")[0] || "User", completed: 0, active: 0 });
    });

    tasks.forEach(t => {
      const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
      assignees.forEach(uid => {
        if (employeeMap.has(uid)) {
          const stats = employeeMap.get(uid)!;
          if (t.status === "completed") {
            stats.completed += 1;
          } else {
            stats.active += 1;
          }
        }
      });
    });

    barData = Array.from(employeeMap.values()).filter(s => s.completed > 0 || s.active > 0);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      {/* Completion Graph */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-6">
          <PieChartIcon className="h-5 w-5 text-indigo-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Task Distribution</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="transparent"
              >
                {pieData.map((entry, index) => {
                  let color = COLORS[0];
                  if (entry.name === 'In Progress') color = COLORS[1];
                  if (entry.name === 'Completed') color = COLORS[2];
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {overdue > 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50 text-center">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              ⚠️ {overdue} {overdue === 1 ? 'task is' : 'tasks are'} currently overdue.
            </p>
          </div>
        )}
      </div>

      {/* Employee Performance */}
      {showEmployeeStats && barData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Team Performance</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 20, right: 30, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="active" name="Active" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      {/* Load More Button for Analytics */}
      {hasMore && (
        <div className="col-span-1 md:col-span-2 flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-medium text-sm rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors shadow-sm disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {loadingMore ? "Loading more data..." : "Analyze More Historical Data"}
          </button>
        </div>
      )}
    </div>
  );
}
