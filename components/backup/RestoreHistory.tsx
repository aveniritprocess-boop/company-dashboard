"use client";

import { useState } from "react";
import { Play, RotateCcw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { BackupRecord } from "@/lib/backup/backup";
import { previewBackup, runRestoreDryRun, executeRestore, RestorePreview, DryRunResult } from "@/lib/backup/restore";
import { useAuth } from "@/components/AuthProvider";

/** Minimal shape of a Firestore Timestamp — avoids importing the full SDK type */
interface FirestoreTimestamp {
  toDate(): Date;
}

export function RestoreHistory({ history }: { history: BackupRecord[] }) {
  const { user } = useAuth();
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [dryRunRes, setDryRunRes] = useState<DryRunResult | null>(null);
  
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  const handleSimulate = async (backupId: string) => {
    setSelectedBackup(backupId);
    setLoadingPreview(true);
    setDryRunRes(null);
    try {
      const p = await previewBackup(backupId);
      setPreview(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDryRun = async () => {
    if (!preview) return;
    setLoadingDryRun(true);
    try {
      const res = await runRestoreDryRun(preview.backupId, preview.collections);
      setDryRunRes(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDryRun(false);
    }
  };

  const [restoreStatus, setRestoreStatus] = useState<{msg: string, type: "success" | "error"} | null>(null);

  const handleRestore = async () => {
    if (!preview || !user) return;
    if (!confirm("SIMULATED RESTORE ONLY: no real backup restoration is implemented. This will not read, write, or overwrite any real data — it only exercises the UI flow. Continue?")) return;

    setLoadingRestore(true);
    setRestoreStatus(null);
    try {
      await executeRestore(preview.backupId, preview.collections, user.uid, user.displayName || user.email || "Unknown");
      setRestoreStatus({ msg: "SIMULATED — no real restore occurred. This feature is not implemented for production use.", type: "success" });
      setTimeout(() => {
        setSelectedBackup(null);
        setPreview(null);
        setDryRunRes(null);
        setRestoreStatus(null);
      }, 5000);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Restore failed.";
      setRestoreStatus({ msg, type: "error" });
      setTimeout(() => setRestoreStatus(null), 5000);
    } finally {
      setLoadingRestore(false);
    }
  };

  const formatDate = (date: unknown) => {
    if (!date) return "N/A";
    try {
      const ts = date as FirestoreTimestamp;
      return typeof ts.toDate === "function"
        ? ts.toDate().toLocaleString()
        : new Date(date as string).toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      {selectedBackup && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Restore Simulator</h3>
            <button onClick={() => setSelectedBackup(null)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
          </div>

          <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
              SIMULATED — NOT FOR PRODUCTION USE
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
              Real backup restoration is not yet implemented. Nothing below reads or writes actual Firestore data.
            </p>
          </div>

          {loadingPreview ? (
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Fetching backup payload metadata...
            </div>
          ) : preview ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-xs font-bold text-slate-400 uppercase">Collections</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{preview.collections.length}</span>
                </div>
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-xs font-bold text-slate-400 uppercase">Est. Docs</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{preview.estimatedDocs}</span>
                </div>
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-xs font-bold text-slate-400 uppercase">Size</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{preview.estimatedSize}</span>
                </div>
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-xs font-bold text-slate-400 uppercase">Status</span>
                  <span className="text-lg font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> Valid</span>
                </div>
              </div>

              {!dryRunRes ? (
                <button
                  onClick={handleDryRun}
                  disabled={loadingDryRun}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {loadingDryRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run Dry-Run Test
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-emerald-800 dark:text-emerald-300">Simulated Dry Run Passed</h4>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                        Conflicts: {dryRunRes.conflicts} &bull; Overwrites: {dryRunRes.overwrites} &bull; New Docs: {dryRunRes.newDocs}
                      </p>
                      <p className="text-[11px] text-emerald-600/70 dark:text-emerald-500/70 mt-1">
                        These numbers are simulated, not read from a real backup.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-center">
                    <button
                      onClick={handleRestore}
                      disabled={loadingRestore || process.env.NODE_ENV === "production"}
                      title={process.env.NODE_ENV === "production" ? "Disabled in production — restore is not implemented" : undefined}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                    >
                      {loadingRestore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      {process.env.NODE_ENV === "production" ? "Restore Disabled (Not Implemented)" : "Run Simulated Restore"}
                    </button>
                    {restoreStatus && (
                      <span className={`text-sm font-bold ${restoreStatus.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                        {restoreStatus.msg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
          <h3 className="font-bold text-slate-800 dark:text-white">Backup History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 dark:bg-slate-800/20 text-xs font-bold text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">Started</th>
                <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">Duration</th>
                <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">Size (MB)</th>
                <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">Type</th>
                <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">Status</th>
                <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {history.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No backups found.</td></tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(record.startedAt)}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{(record.durationMs / 1000).toFixed(1)}s</td>
                    <td className="px-6 py-3 text-slate-500">{(record.sizeBytes / 1024 / 1024).toFixed(2)}</td>
                    <td className="px-6 py-3 text-slate-500 capitalize">{record.initiatedBy}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                        record.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                        record.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                        "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                      }`}>
                        {record.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                        {record.status === "failed" && <XCircle className="h-3 w-3" />}
                        {record.status === "in_progress" && <Loader2 className="h-3 w-3 animate-spin" />}
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleSimulate(record.id!)}
                        disabled={record.status !== "completed" || selectedBackup === record.id}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline disabled:opacity-50 disabled:no-underline"
                      >
                        Simulate Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
