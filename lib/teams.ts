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
import { Team, TeamMember } from "@/lib/roles";

export async function createTeam(teamName: string, ownerUid: string, ownerEmail: string) {
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
  
  // Also update the user's document to include this teamId (optional but good for rapid lookups)
  // For proper normalization we rely on the Team document's members array or a separate 'memberships' collection 
  // currently we are not strictly maintaining redundant arrays on the user doc to avoid sync issues,
  // but we might need a separate service to query "teams where user is member"
  
  return teamRef.id;
}

export async function getTeamsForUser(uid: string) {
  // Queries teams where the members array contains an object with the matching uid
  // Firestore limitation: cannot query array of objects easily for partial match unless exact match.
  // Workaround: We can't simple query `members` array contains object.
  // We need to fetch teams or structure data differently.
  // Alternative 1: Store `memberUids` array on the team doc for querying. 
  // Let's assume we update the createTeam to include `memberUids` array.
  
  // We will assume 'memberUids' exists on the team document for easy querying.
  const q = query(collection(db, "teams"), where("memberUids", "array-contains", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
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
  }
}

export async function removeMemberFromTeam(teamId: string, uidToRemove: string) {
    const teamRef = doc(db, "teams", teamId);
    const teamSnap = await getDoc(teamRef);
    
    if (teamSnap.exists()) {
        const data = teamSnap.data() as Team & { memberUids: string[] };
        const newMembers = data.members.filter(m => m.uid !== uidToRemove);
        const newMemberUids = data.memberUids.filter(id => id !== uidToRemove);
        
        await updateDoc(teamRef, {
            members: newMembers,
            memberUids: newMemberUids
        });
    }
}

export async function getTeam(teamId: string) {
    const docRef = doc(db, "teams", teamId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Team;
    }
    return null;
}
