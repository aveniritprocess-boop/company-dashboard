import { collection, query, where, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot, Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Task } from "@/lib/tasks";
import { TaskSearchParams, SearchPage } from "./search-types";
import { TaskSearchSchema } from "@/lib/validators/search";

const TASKS_COL = "tasks";

export function buildTaskQuery(params: TaskSearchParams, userId: string, userRole: string): Query {
  const coll = collection(db, TASKS_COL);
  let q = query(coll);

  // Status Filter
  if (params.status !== "all") {
    q = query(q, where("status", "==", params.status));
  }

  // Priority Filter
  if (params.priority !== "all") {
    q = query(q, where("priority", "==", params.priority));
  }

  // Due Date Filter
  if (params.dueDateFrom) {
    q = query(q, where("dueDate", ">=", params.dueDateFrom));
  }
  if (params.dueDateTo) {
    q = query(q, where("dueDate", "<=", params.dueDateTo));
  }

  // Quick Filters
  if (params.quickFilter === "assigned_to_me") {
    q = query(q, where("assignedTo", "array-contains", userId));
  } else if (params.quickFilter === "assigned_by_me") {
    q = query(q, where("assignedBy", "==", userId));
  } else if (params.quickFilter === "overdue") {
    // Requires client-side filter for `status != completed`, but we can do date here
    const today = new Date().toISOString().split('T')[0];
    q = query(q, where("dueDate", "<", today));
  } else if (userRole !== "admin" && userRole !== "ceo" && userRole !== "md" && userRole !== "manager") {
    // Regular employees MUST only see their own tasks
    // We cannot use multiple array-contains or equality on different fields in one query
    // This is handled by applying a strict client-side filter after fetching, 
    // OR by forcing the quickFilter to "assigned_to_me".
    // For now, we enforce they must be in assignedTo if no quickFilter selected
    q = query(q, where("assignedTo", "array-contains", userId));
  }

  // Sorting
  switch (params.sortBy) {
    case "newest":
      q = query(q, orderBy("createdAt", "desc"));
      break;
    case "oldest":
      q = query(q, orderBy("createdAt", "asc"));
      break;
    case "priority":
      q = query(q, orderBy("priority", "desc")); // Needs composite index
      break;
    case "due_date":
      q = query(q, orderBy("dueDate", "asc"));   // Needs composite index
      break;
    default:
      q = query(q, orderBy("createdAt", "desc"));
  }

  return q;
}

function applyClientSideFilters(tasks: Task[], params: TaskSearchParams): Task[] {
  let filtered = tasks;

  if (params.query) {
    const q = params.query.toLowerCase();
    filtered = filtered.filter(t => 
      (t.title?.toLowerCase() || "").includes(q) ||
      (t.taskText?.toLowerCase() || "").includes(q) ||
      (t.description?.toLowerCase() || "").includes(q)
    );
  }

  if (params.quickFilter === "overdue") {
    filtered = filtered.filter(t => t.status !== "completed" && t.status !== "approved" && t.status !== "done");
  }

  return filtered;
}

export async function searchTasks(
  params: TaskSearchParams,
  userId: string,
  userRole: string,
  pageSize: number = 25,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<SearchPage<Task>> {
  
  const parsedParams = TaskSearchSchema.parse(params) as TaskSearchParams;
  
  let q = buildTaskQuery(parsedParams, userId, userRole);
  
  const fetchLimit = params.query ? 100 : pageSize;
  q = query(q, limit(fetchLimit));
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  
  const rawTasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
  const filteredTasks = applyClientSideFilters(rawTasks, parsedParams);
  
  const finalTasks = filteredTasks.slice(0, pageSize);
  
  let newLastDoc = null;
  let hasMore = false;
  
  if (finalTasks.length > 0) {
    const lastTaskId = finalTasks[finalTasks.length - 1].id;
    const lastTaskDoc = snap.docs.find(d => d.id === lastTaskId);
    newLastDoc = lastTaskDoc || null;
    
    hasMore = snap.docs.length === fetchLimit || filteredTasks.length > pageSize;
  }

  return {
    items: finalTasks,
    lastDoc: newLastDoc,
    hasMore
  };
}
