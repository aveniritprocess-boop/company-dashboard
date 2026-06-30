import { collection, query, where, orderBy, getDocs, limit, startAfter, onSnapshot, QueryDocumentSnapshot, Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUserSummary } from "@/lib/users";
import { EmployeeSearchParams, SearchPage } from "./search-types";
import { EmployeeSearchSchema } from "@/lib/validators/search";

const USERS_COL = "users";

export function buildEmployeeQuery(params: EmployeeSearchParams): Query {
  const coll = collection(db, USERS_COL);
  let q = query(coll);

  // Apply filters - must match composite indexes
  if (params.role !== "all") {
    q = query(q, where("role", "==", params.role));
  }
  
  if (params.status !== "all") {
    if (params.status === "active") q = query(q, where("is_active", "==", true), where("is_locked", "==", false));
    if (params.status === "inactive") q = query(q, where("is_active", "==", false), where("is_locked", "==", false));
    if (params.status === "locked") q = query(q, where("is_locked", "==", true));
    if (params.status === "archived") q = query(q, where("is_deleted", "==", true));
    if (params.status !== "archived") q = query(q, where("is_deleted", "==", false));
  } else {
    q = query(q, where("is_deleted", "==", false));
  }

  if (params.employeeType !== "all") {
    q = query(q, where("employee_type", "==", params.employeeType));
  }

  if (params.portalAccess !== "all") {
    const hasAccess = params.portalAccess === "enabled";
    q = query(q, where("portal_access", "==", hasAccess));
  }

  if (params.joiningDateFrom) {
    q = query(q, where("joining_date", ">=", params.joiningDateFrom));
  }
  if (params.joiningDateTo) {
    q = query(q, where("joining_date", "<=", params.joiningDateTo));
  }

  // Apply sorting
  switch (params.sortBy) {
    case "name_asc":
      q = query(q, orderBy("name", "asc"));
      break;
    case "name_desc":
      q = query(q, orderBy("name", "desc"));
      break;
    case "joining_asc":
      q = query(q, orderBy("joining_date", "asc"));
      break;
    case "joining_desc":
      q = query(q, orderBy("joining_date", "desc"));
      break;
    case "recently_added":
      q = query(q, orderBy("created_at", "desc"));
      break;
    default:
      q = query(q, orderBy("name", "asc"));
  }

  return q;
}

function applyClientSideFilters(users: AppUserSummary[], params: EmployeeSearchParams): AppUserSummary[] {
  let filtered = users;

  // Department is client-side since there's no index for it with every other combo
  if (params.department !== "all") {
    filtered = filtered.filter(u => u.department === params.department);
  }

  // Text search
  if (params.query) {
    const q = params.query.toLowerCase();
    filtered = filtered.filter(u => 
      (u.name?.toLowerCase() || "").includes(q) ||
      (u.email?.toLowerCase() || "").includes(q) ||
      (u.employee_id?.toLowerCase() || "").includes(q) ||
      (u.mobile?.toLowerCase() || "").includes(q) ||
      (u.designation?.toLowerCase() || "").includes(q)
    );
  }

  return filtered;
}

export async function searchEmployees(
  params: EmployeeSearchParams,
  pageSize: number = 50,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<SearchPage<AppUserSummary>> {
  
  // Validate params
  const parsedParams = EmployeeSearchSchema.parse(params) as EmployeeSearchParams;
  
  let q = buildEmployeeQuery(parsedParams);
  
  // Need to fetch more than pageSize if we're doing client-side filtering
  // to ensure we get enough results to fill a page.
  // This is a common tradeoff with Firestore.
  const fetchLimit = (parsedParams.query || parsedParams.department !== "all") ? 200 : pageSize;
  q = query(q, limit(fetchLimit));
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  
  const rawUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUserSummary));
  const filteredUsers = applyClientSideFilters(rawUsers, parsedParams);
  
  // Truncate to pageSize
  const finalUsers = filteredUsers.slice(0, pageSize);
  
  // The last doc used for pagination must be the doc of the LAST item in finalUsers
  let newLastDoc = null;
  let hasMore = false;
  
  if (finalUsers.length > 0) {
    const lastUserId = finalUsers[finalUsers.length - 1].uid;
    const lastUserDoc = snap.docs.find(d => d.id === lastUserId);
    newLastDoc = lastUserDoc || null;
    
    // We have more if we fetched the full limit and there are more docs
    // OR if we truncated the filtered results
    hasMore = snap.docs.length === fetchLimit || filteredUsers.length > pageSize;
  }

  return {
    items: finalUsers,
    lastDoc: newLastDoc,
    hasMore
  };
}

// Directory mode - pure real-time onSnapshot for normal viewing without search
export function subscribeToDirectory(
  callback: (users: AppUserSummary[]) => void,
  pageSize: number = 50
): () => void {
  const q = query(
    collection(db, USERS_COL),
    where("is_deleted", "==", false),
    orderBy("name", "asc"),
    limit(pageSize)
  );

  return onSnapshot(q, (snap) => {
    const users = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUserSummary));
    callback(users);
  }, (error) => {
    console.error("Directory subscription error:", error);
  });
}
