// Business hierarchy: employee < team_lead < manager < agm < md < ceo
// 'agm' sits above manager and below md/ceo. It deliberately does NOT inherit
// CEO/MD-tier powers (role management, backup/restore, monitoring).
export type UserRole = "ceo" | "md" | "agm" | "admin" | "manager" | "hr" | "team_lead" | "employee";

export interface AppUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  teamIds?: string[]; // IDs of teams the user belongs to
}

export interface Team {
  id?: string;
  name: string;
  createdBy: string;
  createdAt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  members: TeamMember[];
  memberUids?: string[]; // Array of UIDs for efficient querying
}

export interface TeamMember {
  uid: string;
  role: "admin" | "manager" | "member"; // Role within the team context
  email: string;
  joinedAt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface Project {
  id?: string;
  name: string;
  description: string;
  teamId: string;
  createdBy: string;
  createdAt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  status: "active" | "archived" | "completed";
}

export interface Invite {
  id?: string;
  email: string;
  teamId?: string; // Optional: can be a general platform invite or specific team invite
  projectId?: string; // Optional: invite strictly to a project
  role: UserRole; // The platform role they will get
  teamRole?: "admin" | "manager" | "member"; // If invited to a team
  invitedBy: string;
  status: "pending" | "accepted";
  createdAt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const CEO_PERMISSIONS = {
  canManageUsers: true,
  canManageTeams: true,
  canManageProjects: true,
  canViewAllTasks: true,
  canEditSirTasks: true,
  canAssignTasks: true,
  canUpdateTaskStatus: true,
  canViewAllEmployees: true,
  canDeleteTasks: true,
  canManageRoles: true,
  canBeDeleted: false,
};

export const PERMISSIONS: Record<string, Record<string, boolean>> = {
  ceo: CEO_PERMISSIONS,
  md: CEO_PERMISSIONS,
  admin: {
    canManageUsers: true,
    canManageTeams: true,
    canManageProjects: true,
    canViewAllTasks: true,
    canEditSirTasks: true,
    canAssignTasks: true,
    canUpdateTaskStatus: true,
    canViewAllEmployees: true,
    canDeleteTasks: true,
    canManageRoles: true,
  },
  manager: {
    canManageUsers: false,
    canManageTeams: true, // Only their own teams
    canManageProjects: true, // Only their own projects
    canViewAllTasks: false, // Only team tasks
    canEditSirTasks: false,
    canAssignTasks: true,
    canUpdateTaskStatus: true,
    canDeleteTasks: false,
    canAccessAdminSettings: false,
  },
  // AGM sits directly above manager. It gets everything a manager can do, plus
  // org-wide visibility (it is an oversight role), but deliberately NOT the
  // CEO/MD-tier capabilities: no user management, no role management, no
  // admin settings, no task deletion.
  agm: {
    canManageUsers: false,
    canManageTeams: true,
    canManageProjects: true,
    canViewAllTasks: true, // wider than manager: org-wide task visibility
    canEditSirTasks: false,
    canAssignTasks: true,
    canUpdateTaskStatus: true,
    canViewAllEmployees: true, // wider than manager: can see the full directory
    canDeleteTasks: false,
    canManageRoles: false,
    canAccessAdminSettings: false,
  },
  hr: {
    canManageUsers: true,
    canManageTeams: false,
    canManageProjects: false,
    canViewAllTasks: false,
    canEditSirTasks: false,
    canAssignTasks: true,
    canUpdateTaskStatus: true,
    canViewAllEmployees: true,
    canDeleteTasks: false,
    canManageRoles: false,
  },
  team_lead: {
    canManageUsers: false,
    canManageTeams: false,
    canManageProjects: false,
    canViewAllTasks: false,
    canAssignTasks: true,
    canUpdateTaskStatus: true,
    canViewAllEmployees: true,
    canDeleteTasks: false,
    canManageRoles: false,
  },
  employee: {
    canManageUsers: false,
    canManageTeams: false,
    canManageProjects: false,
    canViewAllTasks: false,
    canAssignTasks: true,
    canUpdateTaskStatus: true,
    canViewOwnTasksOnly: true,
  },
};

// ─── Role hierarchy helpers ──────────────────────────────────────────────
// Business hierarchy: employee < team_lead < manager < agm < md < ceo
// ('admin' and 'hr' are functional roles that sit alongside, not inside, that
// line — admin is treated as CEO-tier for access, hr as a specialist tier.)
//
// Use these instead of scattering `role === "manager" || role === "ceo" || ...`
// comparisons, which is how 'md' silently ended up excluded from several pages.

const CEO_TIER: readonly string[] = ["ceo", "md", "super_admin"];
const ADMIN_TIER: readonly string[] = [...CEO_TIER, "admin"];
const MANAGER_TIER: readonly string[] = [...ADMIN_TIER, "agm", "manager"];

/** CEO/MD-level: the highest authority. Grants role changes, backup, monitoring. */
export function isCeoTier(role?: string | null): boolean {
  return !!role && CEO_TIER.includes(role.toLowerCase());
}

/** Admin-or-above: CEO/MD plus 'admin'. */
export function isAdminTierOrAbove(role?: string | null): boolean {
  return !!role && ADMIN_TIER.includes(role.toLowerCase());
}

/** Manager-or-above: adds 'agm' and 'manager'. Team/project/oversight surfaces. */
export function isManagerTierOrAbove(role?: string | null): boolean {
  return !!role && MANAGER_TIER.includes(role.toLowerCase());
}
