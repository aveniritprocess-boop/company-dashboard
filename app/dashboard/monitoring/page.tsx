"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { authenticatedFetch } from "@/lib/api-client";
import { logActivityClient } from "@/lib/audit-client";
import { useAuth } from "@/components/AuthProvider";
import { 
  queryLeaderboard, 
  getActiveListenersInfo, 
  QueryPerformanceLog 
} from "@/lib/firestore-monitor";
import { 
  Activity, 
  Database, 
  Users, 
  CheckSquare, 
  Folder, 
  Users2, 
  Clock, 
  Bell, 
  Calendar, 
  AlertTriangle, 
  RefreshCw, 
  TrendingUp,
  FileText
} from "lucide-react";
import { ExportMenu } from "@/components/export/ExportMenu";

interface CollectionCounts {
  employees: number;
  tasks: number;
  projects: number;
  teams: number;
  auditLogs: number;
  notifications: number;
  attendance: number;
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<CollectionCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Real-time metrics from client performance logs
  const [leaderboard, setLeaderboard] = useState<QueryPerformanceLog[]>([]);
  const [listeners, setListeners] = useState<{ name: string; count: number }[]>([]);

  // Function to fetch database counts
  const loadCounts = async () => {
    try {
      setLoadingCounts(true);
      setErrorMsg("");
      const res = await authenticatedFetch("/api/admin/monitoring-stats");
      if (!res.ok) {
        throw new Error(`Failed to load counts: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setCounts(data.counts);
      setIsCached(data.cached);
    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as { message?: string };
      setErrorMsg(errorObj.message || "Failed to retrieve Firestore counts.");
    } finally {
      setLoadingCounts(false);
    }
  };

  // Poll local timer and listener metrics
  useEffect(() => {
    loadCounts();

    // Audit: log that monitoring dashboard was accessed
    if (user) {
      logActivityClient({
        action: "monitoring_viewed",
        performedBy: user.uid,
        performedByName: user.displayName || user.email || "Admin",
        targetId: "monitoring",
        targetType: "system",
        details: "Monitoring dashboard accessed.",
      }).catch((e) => console.error("Failed to log monitoring_viewed audit:", e));
    }

    const updateLocalStats = () => {
      setLeaderboard([...queryLeaderboard]);
      setListeners(getActiveListenersInfo());
    };

    updateLocalStats();
    const interval = setInterval(updateLocalStats, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RoleGuard allowedRoles={["admin", "ceo"]} fallbackPath="/dashboard">
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Welcome Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 px-6 py-6 shadow-xl border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-400 mb-1.5">
                <Activity className="h-4 w-4 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Platform Telemetry</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Firestore Performance & Usage
              </h1>
              <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
                Monitor database document densities, active listeners, and query timing distributions. Cost metrics are server-cached for 5 minutes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 self-start md:self-center">
              <ExportMenu 
                  data={counts ? [
                    { metric: "Total Employees", value: counts.employees },
                    { metric: "Total Tasks", value: counts.tasks },
                    { metric: "Total Projects", value: counts.projects },
                    { metric: "Total Teams", value: counts.teams },
                    { metric: "Audit Logs", value: counts.auditLogs },
                    { metric: "Notifications", value: counts.notifications },
                    { metric: "Attendance Records", value: counts.attendance },
                  ] : []}
                  columns={[
                    { key: "metric", header: "Metric" },
                    { key: "value", header: "Value" }
                  ]}
                  metadata={{
                    module: "monitoring",
                    appliedFilters: "System Telemetry Counts",
                    correlationId: crypto.randomUUID(),
                    performedBy: user?.uid || "unknown",
                    performedByName: user?.displayName || user?.email || "Unknown"
                  }}
                  disabled={!counts || loadingCounts}
              />
              <button
                onClick={loadCounts}
                disabled={loadingCounts}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95"
              >
                <RefreshCw className={`h-4 w-4 ${loadingCounts ? "animate-spin" : ""}`} />
                Refresh Counts
              </button>
            </div>
          </div>
          
          {/* Abstract background gradient decorations */}
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-[40px]" />
          <div className="absolute bottom-0 left-10 -mb-10 h-24 w-24 rounded-full bg-sky-500/10 blur-[30px]" />
        </div>

        {/* System Health Card Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-500" />
              System Health & Document Counts
            </h2>
            {isCached && counts && (
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full">
                Cached (5m lifespan)
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Employees */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Employees</span>
                <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {loadingCounts ? "..." : counts?.employees ?? 0}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
            </div>

            {/* 2. Tasks */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tasks</span>
                <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {loadingCounts ? "..." : counts?.tasks ?? 0}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <CheckSquare className="h-6 w-6" />
              </div>
            </div>

            {/* 3. Projects */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Projects</span>
                <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {loadingCounts ? "..." : counts?.projects ?? 0}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Folder className="h-6 w-6" />
              </div>
            </div>

            {/* 4. Teams */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Teams</span>
                <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {loadingCounts ? "..." : counts?.teams ?? 0}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Users2 className="h-6 w-6" />
              </div>
            </div>

            {/* 5. Audit Logs */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Audit Logs</span>
                <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {loadingCounts ? "..." : counts?.auditLogs ?? 0}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <FileText className="h-6 w-6" />
              </div>
            </div>

            {/* 6. Notifications */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notifications</span>
                <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {loadingCounts ? "..." : counts?.notifications ?? 0}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Bell className="h-6 w-6" />
              </div>
            </div>

            {/* 7. Attendance Records */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Attendance</span>
                <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {loadingCounts ? "..." : counts?.attendance ?? 0}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Calendar className="h-6 w-6" />
              </div>
            </div>

            {/* 8. Estimated Firestore Cost Label */}
            <div className="bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-indigo-950/20 dark:to-slate-900 rounded-xl p-5 border border-indigo-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Firestore Billing</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Document count usage scales linearly. Firebase dashboard provides official invoice totals.
                </p>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-2 self-start bg-indigo-100/50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
                Estimated Only
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Stats Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Query performance leaderboard */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                Query Leaderboard (Slowest Top 10)
              </h3>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Live Profiler</span>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                No local queries logged yet. Navigate to directories/tasks to trigger Firestore operations.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold text-xs">
                      <th className="pb-3 pr-2">Query API Name</th>
                      <th className="pb-3 px-2">Collection</th>
                      <th className="pb-3 px-2 text-right">Duration</th>
                      <th className="pb-3 px-2 text-right">Results</th>
                      <th className="pb-3 pl-2 text-right">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {leaderboard.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 pr-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {log.queryName}
                        </td>
                        <td className="py-3 px-2 text-slate-500 dark:text-slate-400 font-semibold text-xs">
                          {log.collection}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-950 dark:text-slate-100">
                          {log.duration.toFixed(1)} ms
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                          {log.count} docs
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            {log.isSlow && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/30">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Slow
                              </span>
                            )}
                            {log.isLarge && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-200/50 dark:border-rose-900/30">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Large
                              </span>
                            )}
                            {!log.isSlow && !log.isLarge && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">
                                Optimal
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active snap listeners list */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm rounded-xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Active Listeners ({listeners.reduce((acc, curr) => acc + curr.count, 0)})
            </h3>

            {listeners.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                No active real-time listeners registered.
              </div>
            ) : (
              <div className="space-y-4">
                {listeners.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/40 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-850 dark:text-slate-200 font-mono text-xs">{item.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Real-time observer</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      item.count > 0 
                        ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" 
                        : "bg-slate-50 dark:bg-slate-850 text-slate-400"
                    }`}>
                      {item.count} Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Future Cost Monitoring Card */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-950 rounded-2xl p-6 border border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1 block">Future Roadmap Item</span>
              <h4 className="text-base font-bold text-white">Phase 5.3B — Firebase Usage Import</h4>
              <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                To replace local estimates with invoice-grade granularity, we plan to design a routine that imports actual hourly and daily read/write billing figures directly from the Firebase Console Usage Dashboard via Google Cloud Billing / BigQuery APIs.
              </p>
            </div>
            <span className="bg-indigo-950 border border-indigo-500/30 text-indigo-400 text-xs font-semibold px-3 py-1 rounded-lg shrink-0">
              Deferred Scope
            </span>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
