import { collection, query, where, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AttendanceSession } from "@/lib/attendance";
import { AttendanceSearchParams, SearchPage } from "./search-types";
import { AttendanceSearchSchema } from "@/lib/validators/search";

export async function searchOwnAttendance(
  userId: string,
  params: AttendanceSearchParams,
  pageSize: number = 25,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<SearchPage<AttendanceSession>> {
  
  const parsedParams = AttendanceSearchSchema.parse(params) as AttendanceSearchParams;
  
  const coll = collection(db, "users", userId, "attendance");
  let q = query(coll);

  if (parsedParams.dateFrom) {
    q = query(q, where("createdAt", ">=", new Date(parsedParams.dateFrom)));
  }
  if (parsedParams.dateTo) {
    const toDate = new Date(parsedParams.dateTo);
    toDate.setHours(23, 59, 59, 999);
    q = query(q, where("createdAt", "<=", toDate));
  }

  q = query(q, orderBy("createdAt", "desc"));
  q = query(q, limit(pageSize));
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  
  const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceSession));
  
  let newLastDoc = null;
  let hasMore = false;
  
  if (sessions.length > 0) {
    newLastDoc = snap.docs[snap.docs.length - 1];
    hasMore = snap.docs.length === pageSize;
  }

  return {
    items: sessions,
    lastDoc: newLastDoc,
    hasMore
  };
}
