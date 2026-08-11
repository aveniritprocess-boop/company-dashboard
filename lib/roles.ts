export type UserRole = "ceo" | "md" | "admin" | "manager" | "hr" | "team_lead" | "employee";

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
