import type { QueryDocumentSnapshot } from "firebase/firestore";

// ─── Employee Search ────────────────────────────────────────────────────────

export type EmployeeSortBy =
  | "name_asc"
  | "name_desc"
  | "joining_asc"
  | "joining_desc"
  | "recently_added";

export interface EmployeeSearchParams {
  query: string;
  role: string;          // "all" | "ceo" | "admin" | "hr" | "manager" | "employee"
  status: string;        // "all" | "active" | "inactive" | "notice_period" | "archived" | "locked"
  employeeType: string;  // "all" | "permanent" | "contract" | "intern" | "part_time"
  department: string;    // "all" | any string
  portalAccess: string;  // "all" | "enabled" | "disabled"
  joiningDateFrom: string; // ISO date string or ""
  joiningDateTo: string;   // ISO date string or ""
  sortBy: EmployeeSortBy;
}

export const defaultEmployeeSearchParams: EmployeeSearchParams = {
  query: "",
  role: "all",
  status: "all",
  employeeType: "all",
  department: "all",
  portalAccess: "all",
  joiningDateFrom: "",
  joiningDateTo: "",
  sortBy: "name_asc",
};

// ─── Task Search ────────────────────────────────────────────────────────────

export type TaskSortBy = "newest" | "oldest" | "priority" | "due_date";

export interface TaskSearchParams {
  query: string;
  status: string;   // "all" | TaskStatus values
  priority: string; // "all" | "low" | "medium" | "high" | "critical"
  quickFilter: "all" | "assigned_to_me" | "assigned_by_me" | "overdue";
  dueDateFrom: string;
  dueDateTo: string;
  sortBy: TaskSortBy;
}

export const defaultTaskSearchParams: TaskSearchParams = {
  query: "",
  status: "all",
  priority: "all",
  quickFilter: "all",
  dueDateFrom: "",
  dueDateTo: "",
  sortBy: "newest",
};

// ─── Audit Log Search ───────────────────────────────────────────────────────

export type AuditDatePreset = "all" | "today" | "7d" | "30d" | "custom";

export interface AuditSearchParams {
  query: string;          // matches action, details, performedByName
  severity: string;       // "all" | "info" | "warning" | "critical"
  action: string;         // "all" | specific action string
  performedBy: string;    // "all" | uid
  datePreset: AuditDatePreset;
  dateFrom: string;       // ISO date string when preset = "custom"
  dateTo: string;         // ISO date string when preset = "custom"
}

export const defaultAuditSearchParams: AuditSearchParams = {
  query: "",
  severity: "all",
  action: "all",
  performedBy: "all",
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
};

// ─── Project Search ─────────────────────────────────────────────────────────

export type ProjectSortBy = "newest" | "alphabetical";

export interface ProjectSearchParams {
  query: string;
  status: string; // "all" | "active" | "archived"
  sortBy: ProjectSortBy;
}

export const defaultProjectSearchParams: ProjectSearchParams = {
  query: "",
  status: "all",
  sortBy: "newest",
};

// ─── Team Search ────────────────────────────────────────────────────────────

export type TeamSortBy = "alphabetical" | "newest";

export interface TeamSearchParams {
  query: string;
  sortBy: TeamSortBy;
}

export const defaultTeamSearchParams: TeamSearchParams = {
  query: "",
  sortBy: "alphabetical",
};

// ─── Attendance Search ──────────────────────────────────────────────────────

export interface AttendanceSearchParams {
  dateFrom: string;
  dateTo: string;
}

export const defaultAttendanceSearchParams: AttendanceSearchParams = {
  dateFrom: "",
  dateTo: "",
};

// ─── Notification Search ────────────────────────────────────────────────────

export interface NotificationSearchParams {
  query: string;
  readStatus: "all" | "read" | "unread";
}

export const defaultNotificationSearchParams: NotificationSearchParams = {
  query: "",
  readStatus: "all",
};

// ─── Pagination Cursor ──────────────────────────────────────────────────────

export interface SearchPage<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  totalCount?: number;
}
