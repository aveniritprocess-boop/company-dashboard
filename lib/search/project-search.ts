import { collection, query, where, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot, Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project } from "@/lib/roles";
import { ProjectSearchParams, SearchPage } from "./search-types";
import { ProjectSearchSchema } from "@/lib/validators/search";

const PROJECTS_COL = "projects";

export function buildProjectQuery(params: ProjectSearchParams): Query {
  const coll = collection(db, PROJECTS_COL);
  let q = query(coll);

  if (params.status !== "all") {
    q = query(q, where("status", "==", params.status));
  }

  if (params.sortBy === "alphabetical") {
    // Requires composite index if combined with status, but typically we do alphabetical client-side if status is filtered
    // Or we rely on the index: status ASC, name ASC. We didn't add name ASC to project index, so let's sort createdAt
    // and handle alphabetical client side for projects since they are typically few in number.
    q = query(q, orderBy("createdAt", "desc"));
  } else {
    q = query(q, orderBy("createdAt", "desc"));
  }

  return q;
}

function applyClientSideFilters(projects: Project[], params: ProjectSearchParams): Project[] {
  let filtered = projects;

  if (params.query) {
    const q = params.query.toLowerCase();
    filtered = filtered.filter(p => 
      (p.name?.toLowerCase() || "").includes(q) ||
      (p.description?.toLowerCase() || "").includes(q)
    );
  }

  if (params.sortBy === "alphabetical") {
    filtered = filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  return filtered;
}

export async function searchProjects(
  params: ProjectSearchParams,
  pageSize: number = 25,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<SearchPage<Project>> {
  
  const parsedParams = ProjectSearchSchema.parse(params) as ProjectSearchParams;
  
  let q = buildProjectQuery(parsedParams);
  
  const fetchLimit = (params.query || params.sortBy === "alphabetical") ? 200 : pageSize;
  q = query(q, limit(fetchLimit));
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  
  const rawProjects = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
  const filteredProjects = applyClientSideFilters(rawProjects, parsedParams);
  
  const finalProjects = filteredProjects.slice(0, pageSize);
  
  let newLastDoc = null;
  let hasMore = false;
  
  if (finalProjects.length > 0) {
    const lastId = finalProjects[finalProjects.length - 1].id;
    const lastDocSnap = snap.docs.find(d => d.id === lastId);
    newLastDoc = lastDocSnap || null;
    hasMore = snap.docs.length === fetchLimit || filteredProjects.length > pageSize;
  }

  return {
    items: finalProjects,
    lastDoc: newLastDoc,
    hasMore
  };
}
