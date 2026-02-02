import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project } from "@/lib/roles";

export async function createProject(name: string, description: string, teamId: string, ownerUid: string) {
  const projectRef = await addDoc(collection(db, "projects"), {
    name,
    description,
    teamId,
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
    status: "active"
  });
  return projectRef.id;
}

export async function getProjectsForTeam(teamId: string) {
  const q = query(
      collection(db, "projects"), 
      where("teamId", "==", teamId),
      where("status", "!=", "archived") // Example filter
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
}

// For global projects list if needed (e.g. "My Projects")
// This would need to query projects where teamId is in user's team list
export async function getProjectsForUser(teamIds: string[]) {
    if (teamIds.length === 0) return [];
    
    // Firestore 'in' query supports up to 10 items.
    // robust solution needs chunking, but for MVP/Personal dashboard 10 is fine.
    const q = query(
        collection(db, "projects"),
        where("teamId", "in", teamIds.slice(0, 10))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
}

export async function getProject(projectId: string) {
    const docRef = doc(db, "projects", projectId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Project;
    }
    return null;
}
