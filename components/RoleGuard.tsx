"use client";

import { useAuth } from "./AuthProvider";
import { UserRole, PERMISSIONS } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  permission?: keyof typeof PERMISSIONS.admin; // Use admin as template for keys
  fallback?: React.ReactNode;
  fallbackPath?: string;
}

function getRolePermissions(role?: string | null): Record<string, boolean> | null {
  if (!role || !(role in PERMISSIONS)) {
    return null;
  }
  return PERMISSIONS[role as keyof typeof PERMISSIONS] as Record<string, boolean>;
}

export function RoleGuard({
  children,
  allowedRoles,
  permission,
  fallback = null,
  fallbackPath
}: RoleGuardProps) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && fallbackPath) {
      let allowed = true;
      if (!role) {
        allowed = false;
      } else if (allowedRoles && !allowedRoles.includes(role as UserRole)) {
        allowed = false;
      } else if (permission) {
        const rolePermissions = getRolePermissions(role);
        if (!rolePermissions || !rolePermissions[permission]) {
          allowed = false;
        }
      }

      if (!allowed) {
        router.push(fallbackPath);
      }
    }
  }, [role, loading, allowedRoles, permission, fallbackPath, router]);

  if (loading) return null;
  if (!role) return fallback;

  // Check if role is in allowed roles
  if (allowedRoles && !allowedRoles.includes(role as UserRole)) {
    return fallback;
  }

  // Check specific permission if provided
  if (permission) {
    const rolePermissions = getRolePermissions(role);
    if (!rolePermissions || !rolePermissions[permission]) {
      return fallback;
    }
  }

  return <>{children}</>;
}
