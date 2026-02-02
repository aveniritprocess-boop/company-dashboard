"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { clearIndexedDbPersistence } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "./ThemeToggle";

interface SidebarUserProps {
  isCollapsed?: boolean;
}

export function SidebarUser({ isCollapsed }: SidebarUserProps) {
  const { user, role } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out", error);
      // Fallback redirect
      router.push("/login");
    }
  };

  if (!user) return null;

  return (
    <div className={`border-t p-4 dark:border-gray-800 flex flex-col gap-4 mt-auto transition-all duration-300 ${isCollapsed ? 'items-center px-2' : ''}`}>
      <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt={user.displayName || "User"}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <UserIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user.displayName || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate" title={user.email || ""}>
              {user.email}
            </p>
            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize border border-gray-200 dark:border-gray-700">
                {role || "guest"}
            </span>
          </div>
        )}
      </div>
      
      <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between px-1'}`}>
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-md p-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
