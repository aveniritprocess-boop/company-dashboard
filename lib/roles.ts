export type UserRole = "admin" | "manager" | "employee" | "partner";

export interface AppUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt: any; // Firestore Timestamp
  teamIds?: string[]; // IDs of teams the user belongs to
}

export interface Team {
  id?: string;
  name: string;
  createdBy: string;
  createdAt: any;
  members: TeamMember[];
  memberUids?: string[]; // Array of UIDs for efficient querying
}

export interface TeamMember {
  uid: string;
  role: "admin" | "manager" | "member"; // Role within the team context
  email: string;
  joinedAt: any;
}

export interface Project {
  id?: string;
  name: string;
  description: string;
  teamId: string;
  createdBy: string;
  createdAt: any;
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
  createdAt: any;
}

export const PERMISSIONS = {
  admin: {
    canManageUsers: true,
    canManageTeams: true,
    canManageProjects: true,
    canViewAllTasks: true,
  },
  manager: {
    canManageUsers: false,
    canManageTeams: true, // Only their own teams
    canManageProjects: true, // Only their own projects
    canViewAllTasks: false, // Only team tasks
  },
  employee: {
    canManageUsers: false,
    canManageTeams: false,
    canManageProjects: false,
    canViewAllTasks: false,
  },
  partner: {
    canManageUsers: false,
    canManageTeams: false,
    canManageProjects: false,
    canViewAllTasks: false,
  },
};
