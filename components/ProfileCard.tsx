"use client";

import { useAuth } from "@/components/AuthProvider";
import { ProfileImageUploader } from "./ProfileImageUploader";
import { CalendarDays, Mail } from "lucide-react";

export function ProfileCard() {
  const { user } = useAuth();
  
  // Create a join date string (mocked as user creation time usually not available in basic user object without admin SDK or extra calls)
  // But we can just use current year or leave it out if not essential. Let's use a nice reliable placeholder or real data if we had it.
  const joinDate = user?.metadata?.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : "Member";

  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      {/* Decorative Header */}
      <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
      
      <div className="px-6 pb-6 relative">
        {/* Profile Image - Overlapping the header */}
        <div className="-mt-12 mb-4 flex justify-center sm:justify-start">
            <div className="p-1.5 bg-white dark:bg-gray-900 rounded-full">
                 <ProfileImageUploader />
            </div>
        </div>
        
        <div className="text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {user?.displayName || "User"}
                    </h2>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-gray-500 dark:text-gray-400 text-sm">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{user?.email}</span>
                    </div>
                </div>
                
                <div className="hidden sm:block text-right">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        <CalendarDays className="h-3 w-3" />
                        Joined {joinDate}
                    </span>
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
               <div className="grid grid-cols-3 gap-4 text-center divide-x divide-gray-100 dark:divide-gray-800">
                   <div>
                       <span className="block text-xl font-bold text-gray-900 dark:text-white">12</span>
                       <span className="text-xs text-gray-500 uppercase tracking-wide">Projects</span>
                   </div>
                   <div>
                       <span className="block text-xl font-bold text-gray-900 dark:text-white">85%</span>
                       <span className="text-xs text-gray-500 uppercase tracking-wide">Success</span>
                   </div>
                   <div>
                       <span className="block text-xl font-bold text-gray-900 dark:text-white">4</span>
                       <span className="text-xs text-gray-500 uppercase tracking-wide">Teams</span>
                   </div>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
}
