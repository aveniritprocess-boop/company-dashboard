"use client";

import { useAttendanceSession } from "@/hooks/useAttendanceSession";
import { AttendanceTimer } from "@/components/attendance/AttendanceTimer";
import { Sparkles } from "lucide-react";

export function DashboardAttendanceWidget() {
  const { activeSession, elapsedSeconds, loading } = useAttendanceSession();

  if (loading) {
      return <div className="text-sm text-gray-400">Loading status...</div>;
  }

  if (activeSession && activeSession.status === "active") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center bg-primary-light/50 dark:bg-primary/5 rounded-lg border border-primary-light dark:border-primary/20">
        <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-primary-hover dark:text-primary-light font-medium">Currently Clocked In</span>
        </div>
        <AttendanceTimer seconds={elapsedSeconds} />
        <p className="text-xs text-primary dark:text-primary mt-2">
            Started: {activeSession.clockInAt?.toDate().toLocaleTimeString()}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
            <Sparkles className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-gray-900 dark:text-white font-medium">No active session</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            You are currently clocked out.
        </p>
    </div>
  );
}
