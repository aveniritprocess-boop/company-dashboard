"use client";

import { AttendanceActions } from "@/components/attendance/AttendanceActions";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";

export default function AttendancePage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Attendance Tracking</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Record your daily attendance and view your history.
        </p>
      </div>

      <AttendanceActions />
      <AttendanceHistory />
    </div>
  );
}
