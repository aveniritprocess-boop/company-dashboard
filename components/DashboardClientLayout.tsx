"use client";

import { useAuth } from "@/components/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { NetworkStatus } from "@/components/NetworkStatus";
import { TopBar } from "@/components/TopBar";
import { VerifyEmailNotice } from "@/components/VerifyEmailNotice";
import { CommandMenu } from "@/components/CommandMenu";
import { ToastProvider } from "@/components/ToastProvider";

export function DashboardClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, mustChangePassword, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      fetch("/api/auth/logout", { method: "POST" }).catch(console.error);
      console.error("LOGIN_REDIRECT_TRIGGERED_LAYOUT", {
        loading,
        userIsNull: user === null,
        pathname,
        timestamp: new Date().toISOString()
      });
      console.trace("SIGNOUT_TRACE_LAYOUT");
      window.location.href = "/login";
      return;
    }

    if (!loading && mustChangePassword && pathname !== "/dashboard/update-password") {
      router.push("/dashboard/update-password");
    }
  }, [user, loading, mustChangePassword, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ToastProvider>
      <div className="h-screen bg-gray-50 dark:bg-black font-sans flex overflow-hidden">
        <NetworkStatus />
        <CommandMenu />
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <TopBar />
          <main
            className={`flex-1 min-h-0 ${pathname === "/dashboard/sheet"
                ? "overflow-hidden flex flex-col"
                : "overflow-y-auto p-4 sm:p-8 scroll-smooth"
              }`}
          >
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
