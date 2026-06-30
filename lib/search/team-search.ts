import { collection, query, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot, Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Team } from "@/lib/roles";
import { TeamSearchParams, SearchPage } from "./search-types";
import { TeamSearchSchema } from "@/lib/validators/search";

const TEAMS_COL = "teams";

export function buildTeamQuery(params: TeamSearchParams): Query {
  void params;
  const coll = collection(db, TEAMS_COL);
  let q = query(coll);

  // Teams usually have very few records. We fetch ordered by newest and client-sort for alphabetical.
  q = query(q, orderBy("createdAt", "desc"));

  return q;
}

function applyClientSideFilters(teams: Team[], params: TeamSearchParams): Team[] {
  let filtered = teams;

  if (params.query) {
    const q = params.query.toLowerCase();
    filtered = filtered.filter(t => 
      (t.name?.toLowerCase() || "").includes(q)
    );
  }

  if (params.sortBy === "alphabetical") {
    filtered = filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  return filtered;
}

export async function searchTeams(
  params: TeamSearchParams,
  pageSize: number = 25,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<SearchPage<Team>> {
  
  const parsedParams = TeamSearchSchema.parse(params) as TeamSearchParams;
  
  let q = buildTeamQuery(parsedParams);
  
  const fetchLimit = (params.query || params.sortBy === "alphabetical") ? 200 : pageSize;
  q = query(q, limit(fetchLimit));
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  
  const rawTeams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
  const filteredTeams = applyClientSideFilters(rawTeams, parsedParams);
  
  const finalTeams = filteredTeams.slice(0, pageSize);
  
  let newLastDoc = null;
  let hasMore = false;
  
  if (finalTeams.length > 0) {
    const lastId = finalTeams[finalTeams.length - 1].id;
    const lastDocSnap = snap.docs.find(d => d.id === lastId);
    newLastDoc = lastDocSnap || null;
    hasMore = snap.docs.length === fetchLimit || filteredTeams.length > pageSize;
  }

  return {
    items: finalTeams,
    lastDoc: newLastDoc,
    hasMore
  };
}
