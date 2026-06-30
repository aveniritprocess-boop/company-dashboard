"use client";

import { useEffect, useState } from "react";
import { Server, HardDrive, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { BackupRecord } from "@/lib/backup/backup";

/** Minimal shape of a Firestore Timestamp — avoids importing the full SDK type */
interface FirestoreTimestamp {
  toDate(): Date;
}

export function BackupStatus({ history }: { history: BackupRecord[] }) {
  const lastBackup = history.find(h => h.status === "completed");
  
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);

  let isHealthy = false;
  if (lastBackup && now !== null) {
    const ts = lastBackup.startedAt as FirestoreTimestamp | string | Date | null;
    const backupTime =
      ts && typeof (ts as FirestoreTimestamp).toDate === "function"
        ? (ts as FirestoreTimestamp).toDate().getTime()
        : new Date(ts as string).getTime();
    isHealthy = (now - backupTime) < 48 * 60 * 60 * 1000;
  }

  const formatDate = (date: unknown) => {
    if (!date) return "None";
    try {
      const ts = date as FirestoreTimestamp;
      return typeof ts.toDate === "function"
        ? ts.toDate().toLocaleDateString()
        : new Date(date as string).toLocaleDateString();
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Health Status</span>
          <h3 className={`text-xl font-bold mt-1 ${isHealthy ? "text-emerald-500" : "text-amber-500"}`}>
            {isHealthy ? "Healthy" : "Warning"}
          </h3>
        </div>
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isHealthy ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
          {isHealthy ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Last Backup</span>
          <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-white">
            {formatDate(lastBackup?.startedAt)}
          </h3>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
          <Clock className="h-6 w-6" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Storage Usage</span>
          <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-white">
            {lastBackup ? (lastBackup.sizeBytes / 1024 / 1024).toFixed(2) : "0.00"} MB
          </h3>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
          <HardDrive className="h-6 w-6" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Backup Node</span>
          <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-white">GCP Cloud</h3>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-500/10 text-slate-500 flex items-center justify-center">
          <Server className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
