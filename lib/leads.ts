import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost" | "Pending" | "In Progress" | "Resolved";

export interface Lead {
  id: string;
  title: string;
  clientName: string;
  contact: string;
  email?: string;
  status: LeadStatus;
  notes: string;
  type: "sales" | "service";
  assignedTo?: string; // UID
  assignedToName?: string;
  createdBy: string; // UID
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLLECTIONS = {
  sales: "salesLeads",
  service: "serviceLeads"
};

export async function addLead(
  type: "sales" | "service",
  data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "type">
) {
  const col = COLLECTIONS[type];
  const now = serverTimestamp();
  await addDoc(collection(db, col), {
    ...data,
    type,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateLead(
  type: "sales" | "service",
  id: string,
  data: Partial<Omit<Lead, "id" | "createdAt" | "updatedAt" | "type">>
) {
  const col = COLLECTIONS[type];
  const ref = doc(db, col, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLead(type: "sales" | "service", id: string) {
  const col = COLLECTIONS[type];
  await deleteDoc(doc(db, col, id));
}

export function subscribeToLeads(
  type: "sales" | "service",
  callback: (leads: Lead[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void,
  pageSize: number = 20,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null
) {
  const col = COLLECTIONS[type];
  let q = query(
    collection(db, col),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  if (lastVisibleDoc) {
    q = query(q, startAfter(lastVisibleDoc));
  }

  return onSnapshot(q, (snapshot) => {
    const leads = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Lead[];
    
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(leads, lastDoc);
  });
}

export function subscribeToUserLeads(
  type: "sales" | "service",
  userId: string,
  callback: (leads: Lead[]) => void
) {
  const col = COLLECTIONS[type];
  const q = query(
    collection(db, col),
    where("assignedTo", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const leads = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Lead[];
    callback(leads);
  });
}
