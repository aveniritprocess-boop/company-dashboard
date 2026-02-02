"use client";

import { Clock } from "lucide-react";

interface AttendanceTimerProps {
  seconds: number;
}

export function AttendanceTimer({ seconds }: AttendanceTimerProps) {
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-100 dark:border-indigo-500/30 font-mono text-xl font-bold tracking-widest shadow-sm">
      <Clock className="h-5 w-5 animate-pulse" />
      {formatTime(seconds)}
    </div>
  );
}
