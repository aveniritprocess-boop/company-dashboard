"use client";

import { useAuth } from "@/components/AuthProvider";
import { ProfileImageUploader } from "./ProfileImageUploader";
import { CalendarDays, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function ProfileCard() {
    const { user } = useAuth();
    const [joiningDate, setJoiningDate] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
            setJoiningDate(snap.exists() ? (snap.data().joining_date as string | undefined) || null : null);
        });
        return () => unsub();
    }, [user]);

    // Prefer the employee's actual joining_date from Firestore. Only fall
    // back to the Firebase Auth account-creation timestamp — which is not a
    // real HR join date and can diverge from it (password resets, migrated
    // accounts, etc.) — when no joining_date is on record at all.
    const joinDate = joiningDate
        ? new Date(joiningDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : user?.metadata?.creationTime
            ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
            : "Member";

    return (
        <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
            {/* Decorative Header */}
            <div className="h-32 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 relative">
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-pulse"></div>
            </div>

            <div className="px-6 pb-8 relative">
                {/* Profile Image - Overlapping the header */}
                <div className="-mt-16 mb-6 flex justify-center lg:justify-start">
                    <div className="p-1.5 bg-white dark:bg-slate-900 rounded-full shadow-xl">
                        <ProfileImageUploader />
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                            {user?.displayName || "User Account"}
                        </h2>
                        <div className="flex items-center justify-center lg:justify-start gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                            <Mail className="h-4 w-4 text-primary" />
                            <span>{user?.email}</span>
                        </div>
                        <div className="mt-2 flex justify-center lg:justify-start">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest text-primary border border-primary/20">
                                <CalendarDays className="h-3 w-3" />
                                Joined {joinDate}
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50">
                        <div className="grid grid-cols-3 gap-6 text-center">
                            <div className="space-y-1">
                                <span className="block text-2xl font-black text-slate-900 dark:text-white">12</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projects</span>
                            </div>
                            <div className="space-y-1">
                                <span className="block text-2xl font-black text-emerald-500">85%</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Growth</span>
                            </div>
                            <div className="space-y-1">
                                <span className="block text-2xl font-black text-slate-900 dark:text-white">4</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teams</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
