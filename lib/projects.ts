import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  limit
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Project } from "@/lib/roles";
import { broadcastNotification } from "./notifications";
import { logActivityClient } from "./audit-client";
import { monitorQuery, trackListener } from "./firestore-monitor";
import { CreateProjectSchema } from "./validators/project";

export function subscribeToAllProjects(callback: (projects: Project[]) => void, limitCount?: number) {
  const cleanupMonitor = trackListener("subscribeToAllProjects");
  let q = query(collection(db, "projects"));
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  const unsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
  });
  return () => {
    unsub();
    cleanupMonitor();
  };
}

export async function createProject(name: string, description: string, teamId: string, ownerUid: string) {
  // Validate payload before writing to Firestore
  CreateProjectSchema.parse({ name, description, teamId, ownerUid });

  const projectRef = await addDoc(collection(db, "projects"), {
    name,
    description,
    teamId,
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
    status: "active"
  });

  // Write audit log
  try {
    const user = auth.currentUser;
    await logActivityClient({
      action: "project_created",
      performedBy: ownerUid,
      performedByName: user?.displayName || user?.email || "Employee",
      targetId: projectRef.id,
      targetType: "project",
      details: `Created new project "${name}".`,
      metadata: { name, description, teamId }
    });
  } catch (auditErr) {
    console.error("Failed to log createProject audit:", auditErr);
  }

  await broadcastNotification(
    "New Project Created", 
    `A new project "${name}" has been initialized in the system.`,
    { type: "record", fromUserId: ownerUid }
  );

  return projectRef.id;
}

export async function getProjectsForTeam(teamId: string) {
  return monitorQuery("getProjectsForTeam", "projects", async () => {
    const q = query(
      collection(db, "projects"),
      where("teamId", "==", teamId),
      where("status", "!=", "archived") // Example filter
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
  });
}

// For global projects list if needed (e.g. "My Projects")
// This would need to query projects where teamId is in user's team list
export async function getProjectsForUser(teamIds: string[]) {
  if (teamIds.length === 0) return [];

  return monitorQuery("getProjectsForUser", "projects", async () => {
    // Firestore 'in' query supports up to 10 items.
    // robust solution needs chunking, but for MVP/Personal dashboard 10 is fine.
    const q = query(
      collection(db, "projects"),
      where("teamId", "in", teamIds.slice(0, 10))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
  });
}

export async function getProject(projectId: string) {
  return monitorQuery("getProject", "projects", async () => {
    const docRef = doc(db, "projects", projectId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Project;
    }
    return null;
  });
}

export async function updateProject(projectId: string, name: string, description: string, teamId: string) {
  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);

  if (projectSnap.exists()) {
    const data = projectSnap.data() as Project;
    const oldName = data.name;

    await updateDoc(projectRef, {
      name,
      description,
      teamId
    });

    try {
      const user = auth.currentUser;
      await logActivityClient({
        action: "project_updated",
        performedBy: user?.uid || "system",
        performedByName: user?.displayName || user?.email || "Employee",
        targetId: projectId,
        targetType: "project",
        details: `Updated project "${oldName}" details.`,
        metadata: { oldName, newName: name, newDescription: description, newTeamId: teamId, action: "update_project" }
      });
    } catch (auditErr) {
      console.error("Failed to log updateProject audit:", auditErr);
    }

    await broadcastNotification(
      "Project Updated",
      `The project "${oldName}" has been updated.`,
      { type: "record" }
    );
  }
}
