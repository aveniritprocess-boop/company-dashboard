"use client";

import { useEffect, useState } from "react";
import { getSessionHistory, AttendanceSession } from "@/lib/attendance";
import { useAuth } from "@/components/AuthProvider";
import { format, differenceInSeconds } from "date-fns";
import { Loader2 } from "lucide-react";

export function AttendanceHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    try {
      const records = await getSessionHistory(user.uid);
      setHistory(records);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return "Active";
    const totalSeconds = differenceInSeconds(end, start);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
     return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400"/></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Session History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
              <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Clock In</th>
              <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Clock Out</th>
              <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No session history found.</td>
                </tr>
            ) : (
                history.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                        {session.clockInAt ? format(session.clockInAt.toDate(), "PPP") : "Pending..."}
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                             {session.clockInImageUrl && (
                                <img src={session.clockInImageUrl} className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 object-cover" alt="In" />
                             )}
                             <span>{session.clockInAt ? format(session.clockInAt.toDate(), "p") : "-"}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                             {session.clockOutImageUrl && (
                                <img src={session.clockOutImageUrl} className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 object-cover" alt="Out" />
                             )}
                             <span>{session.clockOutAt ? format(session.clockOutAt.toDate(), "p") : "Active"}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">
                        {session.clockInAt ? formatDuration(session.clockInAt.toDate(), session.clockOutAt ? session.clockOutAt.toDate() : null) : "-"}
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
