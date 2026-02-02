"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { NetworkStatus } from "@/components/NetworkStatus";
import { TopBar } from "@/components/TopBar";
import { VerifyEmailNotice } from "@/components/VerifyEmailNotice";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

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
    <div className="h-screen bg-gray-50 dark:bg-black font-sans flex overflow-hidden">
      <NetworkStatus />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
            {!user.emailVerified ? <VerifyEmailNotice /> : children}
          </main>
      </div>
    </div>
  );
}
