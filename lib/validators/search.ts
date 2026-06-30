import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z.string().refine(val => !val || datePattern.test(val), {
  message: "Invalid date format. Expected YYYY-MM-DD",
});

export const EmployeeSearchSchema = z.object({
  query: z.string().optional().default(""),
  role: z.string().optional().default("all"),
  status: z.string().optional().default("all"),
  employeeType: z.string().optional().default("all"),
  department: z.string().optional().default("all"),
  portalAccess: z.string().optional().default("all"),
  joiningDateFrom: dateString.optional().default(""),
  joiningDateTo: dateString.optional().default(""),
  sortBy: z.enum(["name_asc", "name_desc", "joining_asc", "joining_desc", "recently_added"]).optional().default("name_asc"),
});

export const TaskSearchSchema = z.object({
  query: z.string().optional().default(""),
  status: z.string().optional().default("all"),
  priority: z.string().optional().default("all"),
  quickFilter: z.enum(["all", "assigned_to_me", "assigned_by_me", "overdue"]).optional().default("all"),
  dueDateFrom: dateString.optional().default(""),
  dueDateTo: dateString.optional().default(""),
  sortBy: z.enum(["newest", "oldest", "priority", "due_date"]).optional().default("newest"),
});

export const AuditSearchSchema = z.object({
  query: z.string().optional().default(""),
  severity: z.string().optional().default("all"),
  action: z.string().optional().default("all"),
  performedBy: z.string().optional().default("all"),
  datePreset: z.enum(["all", "today", "7d", "30d", "custom"]).optional().default("all"),
  dateFrom: dateString.optional().default(""),
  dateTo: dateString.optional().default(""),
});

export const ProjectSearchSchema = z.object({
  query: z.string().optional().default(""),
  status: z.string().optional().default("all"),
  sortBy: z.enum(["newest", "alphabetical"]).optional().default("newest"),
});

export const TeamSearchSchema = z.object({
  query: z.string().optional().default(""),
  sortBy: z.enum(["alphabetical", "newest"]).optional().default("alphabetical"),
});

export const AttendanceSearchSchema = z.object({
  dateFrom: dateString.optional().default(""),
  dateTo: dateString.optional().default(""),
});

export const NotificationSearchSchema = z.object({
  query: z.string().optional().default(""),
  readStatus: z.enum(["all", "read", "unread"]).optional().default("all"),
});
