"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";

export function NetworkStatus() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md bg-yellow-100 px-4 py-3 text-yellow-800 shadow-lg dark:bg-yellow-900/50 dark:text-yellow-200">
      <WifiOff className="h-4 w-4" />
      <span className="text-sm font-medium">You are offline. Changes will sync when connected.</span>
    </div>
  );
}
