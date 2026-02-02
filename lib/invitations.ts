import { 
  collection, 
  doc, 
  addDoc,
  updateDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Invite, UserRole } from "@/lib/roles";

export async function createInvite(invitation: Omit<Invite, "id" | "createdAt" | "status">) {
    // Check if invite already exists for this email and team
    const q = query(
        collection(db, "invites"), 
        where("email", "==", invitation.email), 
        where("teamId", "==", invitation.teamId),
        where("status", "==", "pending")
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
        throw new Error("Pending invite already exists for this user.");
    }

    const inviteRef = await addDoc(collection(db, "invites"), {
        ...invitation,
        status: "pending",
        createdAt: serverTimestamp()
    });
    return inviteRef.id;
}

export async function getPendingInvitesForEmail(email: string) {
    const q = query(
        collection(db, "invites"),
        where("email", "==", email),
        where("status", "==", "pending")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite));
}

export async function acceptInvite(inviteId: string) {
    const inviteRef = doc(db, "invites", inviteId);
    await updateDoc(inviteRef, {
        status: "accepted"
    });
}
