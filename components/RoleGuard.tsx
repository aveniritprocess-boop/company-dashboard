"use client";

import { useAuth } from "@/components/AuthProvider";
import { UserRole } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

export function RoleGuard({ children, allowedRoles, fallbackPath = "/dashboard" }: RoleGuardProps) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role && !allowedRoles.includes(role)) {
      router.push(fallbackPath);
    }
  }, [role, loading, allowedRoles, fallbackPath, router]);

  if (loading) return <div className="p-10 text-center opacity-50">Checking permissions...</div>;
  if (!role || !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
