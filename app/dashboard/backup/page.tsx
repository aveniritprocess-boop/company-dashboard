"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Database } from "lucide-react";
import { getBackupHistory, triggerBackup, BackupRecord } from "@/lib/backup/backup";
import { useAuth } from "@/components/AuthProvider";
import { BackupStatus } from "@/components/backup/BackupStatus";
import { RestoreHistory } from "@/components/backup/RestoreHistory";

export default function BackupDashboardPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const records = await getBackupHistory(15);
      setHistory(records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleManualBackup = async () => {
    if (!user) return;
    setTriggering(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await triggerBackup(user.uid, user.displayName || user.email || "Unknown");
      await loadData();
      setSuccessMsg("Backup triggered successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to trigger backup.");
      setTimeout(() => setErrorMsg(""), 3000);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["admin", "ceo", "md"]} fallbackPath="/dashboard">
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 px-6 py-6 shadow-xl border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-sky-400 mb-1.5">
                <Database className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Disaster Recovery</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Backup & Restore Center
              </h1>
              <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
                Manage automated Firestore backups, perform manual snapshots, and simulate database restorations.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleManualBackup}
                disabled={triggering}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                {triggering ? "Creating Backup..." : "Run Manual Backup"}
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-[40px]" />
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-200">
            <p className="text-sm font-medium text-red-800">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800">{successMsg}</p>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        ) : (
          <>
            <BackupStatus history={history} />
            <RestoreHistory history={history} />
          </>
        )}
      </div>
    </RoleGuard>
  );
}
