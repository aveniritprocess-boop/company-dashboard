import {
  collection,
  doc,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project } from "@/lib/roles";
import { broadcastNotification } from "./notifications";

export function subscribeToAllProjects(callback: (projects: Project[]) => void) {
  const q = query(collection(db, "projects"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
  });
}

export async function createProject(name: string, description: string, teamId: string, ownerUid: string) {
  const projectRef = await addDoc(collection(db, "projects"), {
    name,
    description,
    teamId,
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
    status: "active"
  });

  await broadcastNotification(
    "New Project Created", 
    `A new project "${name}" has been initialized in the system.`,
    { type: "record", fromUserId: ownerUid }
  );

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
