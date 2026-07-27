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
import { Team, TeamMember } from "@/lib/roles";
import { broadcastNotification } from "./notifications";
import { logActivityClient } from "./audit-client";
import { monitorQuery, trackListener } from "./firestore-monitor";
import { CreateTeamSchema } from "./validators/team";

export function subscribeToAllTeams(callback: (teams: Team[]) => void, limitCount?: number) {
  const cleanupMonitor = trackListener("subscribeToAllTeams");
  let q = query(collection(db, "teams"));
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  const unsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
  });
  return () => {
    unsub();
    cleanupMonitor();
  };
}

export async function createTeam(teamName: string, ownerUid: string, ownerEmail: string) {
  // Validate payload before writing to Firestore
  CreateTeamSchema.parse({ name: teamName, ownerUid, ownerEmail });

  const teamRef = await addDoc(collection(db, "teams"), {
    name: teamName,
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
    members: [{
      uid: ownerUid,
      role: "admin",
      email: ownerEmail,
      joinedAt: new Date().toISOString()
    }]
  });

  // Write audit log
  try {
    const user = auth.currentUser;
    await logActivityClient({
      action: "team_created",
      performedBy: ownerUid,
      performedByName: user?.displayName || user?.email || "Employee",
      targetId: teamRef.id,
      targetType: "team",
      details: `Created new team "${teamName}".`,
      metadata: { name: teamName, ownerEmail }
    });
  } catch (auditErr) {
    console.error("Failed to log createTeam audit:", auditErr);
  }

  await broadcastNotification(
    "New Team Formed",
    `A new team "${teamName}" has been created.`,
    { type: "record", fromUserId: ownerUid }
  );

  return teamRef.id;
}

export async function getTeamsForUser(uid: string) {
  // Queries teams where the members array contains an object with the matching uid
  // Firestore limitation: cannot query array of objects easily for partial match unless exact match.
  // Workaround: We can't simple query `members` array contains object.
  // We need to fetch teams or structure data differently.
  // Alternative 1: Store `memberUids` array on the team doc for querying. 
  // Let's assume we update the createTeam to include `memberUids` array.

  return monitorQuery("getTeamsForUser", "teams", async () => {
    // We will assume 'memberUids' exists on the team document for easy querying.
    const q = query(collection(db, "teams"), where("memberUids", "array-contains", uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
  });
}

// Helper to fix the Create Team to include memberUids
export async function createTeamWithIndex(teamName: string, ownerUid: string, ownerEmail: string) {
  const teamRef = await addDoc(collection(db, "teams"), {
    name: teamName,
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
    members: [{
      uid: ownerUid,
      role: "admin",
      email: ownerEmail,
      joinedAt: new Date().toISOString()
    }],
    memberUids: [ownerUid] // Index for querying
  });

  // Write audit log
  try {
    const user = auth.currentUser;
    await logActivityClient({
      action: "team_created",
      performedBy: ownerUid,
      performedByName: user?.displayName || user?.email || "Employee",
      targetId: teamRef.id,
      targetType: "team",
      details: `Created new team "${teamName}".`,
      metadata: { name: teamName, ownerEmail }
    });
  } catch (auditErr) {
    console.error("Failed to log createTeamWithIndex audit:", auditErr);
  }

  await broadcastNotification(
    "New Team Formed",
    `A new team "${teamName}" has been created.`,
    { type: "record", fromUserId: ownerUid }
  );

  return teamRef.id;
}

export async function addMemberToTeam(teamId: string, member: TeamMember) {
  const teamRef = doc(db, "teams", teamId);
  const teamSnap = await getDoc(teamRef);

  if (teamSnap.exists()) {
    const data = teamSnap.data() as Team & { memberUids: string[] };
    const newMembers = [...data.members, member];
    const newMemberUids = [...data.memberUids, member.uid];

    await updateDoc(teamRef, {
      members: newMembers,
      memberUids: newMemberUids
    });

    // Write audit log
    try {
      const user = auth.currentUser;
      await logActivityClient({
        action: "team_updated",
        performedBy: user?.uid || "system",
        performedByName: user?.displayName || user?.email || "Employee",
        targetId: teamId,
        targetType: "team",
        details: `Added ${member.email} to team "${data.name || teamId}".`,
        metadata: { 
          memberUid: member.uid, 
          memberEmail: member.email, 
          action: "add_member",
          before: { membersCount: data.members.length },
          after: { membersCount: newMembers.length }
        }
      });
    } catch (auditErr) {
      console.error("Failed to log addMemberToTeam audit:", auditErr);
    }

    await broadcastNotification(
      "Team Member Added",
      `${member.email || "A new member"} has been added to the team.`,
      { type: "record" }
    );
  }
}

export async function removeMemberFromTeam(teamId: string, uidToRemove: string) {
  const teamRef = doc(db, "teams", teamId);
  const teamSnap = await getDoc(teamRef);

  if (teamSnap.exists()) {
    const data = teamSnap.data() as Team & { memberUids: string[] };
    const newMembers = data.members.filter(m => m.uid !== uidToRemove);
    const newMemberUids = data.memberUids.filter(id => id !== uidToRemove);
    const targetMember = data.members.find(m => m.uid === uidToRemove);

    await updateDoc(teamRef, {
      members: newMembers,
      memberUids: newMemberUids
    });

    // Write audit log
    try {
      const user = auth.currentUser;
      await logActivityClient({
        action: "team_updated",
        performedBy: user?.uid || "system",
        performedByName: user?.displayName || user?.email || "Employee",
        targetId: teamId,
        targetType: "team",
        details: `Removed ${targetMember?.email || uidToRemove} from team "${data.name || teamId}".`,
        metadata: { 
          removedUid: uidToRemove, 
          removedEmail: targetMember?.email || null,
          action: "remove_member",
          before: { membersCount: data.members.length },
          after: { membersCount: newMembers.length }
        }
      });
    } catch (auditErr) {
      console.error("Failed to log removeMemberFromTeam audit:", auditErr);
    }

    await broadcastNotification(
      "Team Member Removed",
      `A member has been removed from the team.`,
      { type: "record" }
    );
  }
}

export async function getTeam(teamId: string) {
  return monitorQuery("getTeam", "teams", async () => {
    const docRef = doc(db, "teams", teamId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Team;
    }
    return null;
  });
}

export async function updateTeam(teamId: string, name: string) {
  const teamRef = doc(db, "teams", teamId);
  const teamSnap = await getDoc(teamRef);

  if (teamSnap.exists()) {
    const data = teamSnap.data() as Team;
    const oldName = data.name;

    await updateDoc(teamRef, {
      name
    });

    try {
      const user = auth.currentUser;
      await logActivityClient({
        action: "team_updated",
        performedBy: user?.uid || "system",
        performedByName: user?.displayName || user?.email || "Employee",
        targetId: teamId,
        targetType: "team",
        details: `Renamed team from "${oldName}" to "${name}".`,
        metadata: { oldName, newName: name, action: "rename_team" }
      });
    } catch (auditErr) {
      console.error("Failed to log updateTeam audit:", auditErr);
    }

    await broadcastNotification(
      "Team Renamed",
      `The team "${oldName}" has been renamed to "${name}".`,
      { type: "record" }
    );
  }
}
