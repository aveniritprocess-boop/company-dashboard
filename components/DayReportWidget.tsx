"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToAllDiaryEntriesByDate, subscribeToDiaryEntries, DailyDiaryEntry } from "@/lib/dailyDiary";
import { getAllUsers } from "@/lib/users";
import { 
  ClipboardList, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Search
} from "lucide-react";

export function DayReportWidget() {
    const { user, role } = useAuth();
    const isAdmin = role === "admin" || role === "ceo" || role === "super_admin";
    const [entries, setEntries] = useState<DailyDiaryEntry[]>([]);
    const [users, setUsers] = useState<Record<string, string>>({});
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);

    // One-time user name fetch (no real-time listener needed for a lookup map)
    useEffect(() => {
        getAllUsers()
            .then((fetchedUsers) => {
                const userMap: Record<string, string> = {};
                fetchedUsers.forEach(u => {
                    userMap[u.uid] = u.name || "Unknown User";
                });
                setUsers(userMap);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        let unsubDiary: () => void;
        if (isAdmin) {
            // Admins/CEO see all diary entries for the selected date
            unsubDiary = subscribeToAllDiaryEntriesByDate(selectedDate, (fetchedEntries) => {
                setEntries(fetchedEntries);
                setLoading(false);
            });
        } else {
            // Managers/employees see only their own diary entries for the selected date
            unsubDiary = subscribeToDiaryEntries(user.uid, (fetchedEntries) => {
                const filtered = fetchedEntries.filter(e => e.date === selectedDate);
                setEntries(filtered);
                setLoading(false);
            });
        }

        return () => unsubDiary?.();
    }, [user, isAdmin, selectedDate]);

    const changeDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
        setLoading(true);
    };

    return (
        <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-blue-500" />
                        Individual Day Report
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        View daily diary entries for all members.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <button 
                        onClick={() => changeDate(-1)}
                        className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                        <ChevronLeft className="h-4 w-4 text-slate-500" />
                    </button>
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none px-2 cursor-pointer"
                    />
                    <button 
                        onClick={() => changeDate(1)}
                        className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center py-10">
                    <div className="h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
            ) : entries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                    <div className="h-16 w-16 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">No reports for this day</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Team members haven&apos;t logged any entries for {new Date(selectedDate).toLocaleDateString()}.
                    </p>
                </div>
            ) : (
                <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar max-h-[400px]">
                    {entries.map((entry) => (
                        <div 
                            key={entry.id} 
                            className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {users[entry.userId] || "Loading..."}
                                    </span>
                                </div>
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    entry.status === 'Completed' 
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                    {entry.status === 'Completed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                    {entry.status}
                                </div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-10">
                                {entry.description}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
