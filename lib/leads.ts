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
import { createNotification, sendEmail } from "./notifications";
import { getUserById } from "./users";

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
  const leadRef = await addDoc(collection(db, col), {
    ...data,
    type,
    createdAt: now,
    updatedAt: now,
  });

  // Notification for assignment
  if (data.assignedTo) {
    const leadPath = type === "sales" ? "/dashboard/sales-leads" : "/dashboard/service-leads";
    const title = type === "sales" ? "New Sales Lead Assigned" : "New Service Lead Assigned";
    const msg = `You have been assigned a new ${type} lead: "${data.title}" for client ${data.clientName}`;

    await createNotification(data.assignedTo, title, msg, {
      link: leadPath,
      type: "record",
      fromUserId: data.createdBy,
      fromUserName: data.createdByName
    });

    // Email Notification
    const assignee = await getUserById(data.assignedTo);
    if (assignee?.email) {
      await sendEmail(
        assignee.email,
        title,
        `Hello ${assignee.name},\n\n${msg}\n\nClient: ${data.clientName}\nNotes: ${data.notes}\n\nView it on the dashboard: https://company-dashboard-avenirit.web.app${leadPath}`,
        `<p>Hello ${assignee.name},</p><p>${msg}</p><p><strong>Client:</strong> ${data.clientName}<br><strong>Notes:</strong> ${data.notes}</p><p>View it on the <a href="https://company-dashboard-avenirit.web.app${leadPath}">Dashboard</a></p>`
      );
    }
  }
}

export async function updateLead(
  type: "sales" | "service",
  id: string,
  data: Partial<Omit<Lead, "id" | "createdAt" | "updatedAt" | "type">>
) {
  const col = COLLECTIONS[type];
  const ref = doc(db, col, id);
  
  // We need current lead data to check if assignment changed
  // But for simplicity and to satisfy the user request "whenever i am assigning", 
  // if data.assignedTo is present in the update, we'll notify.
  
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  if (data.assignedTo) {
    const leadPath = type === "sales" ? "/dashboard/sales-leads" : "/dashboard/service-leads";
    const title = type === "sales" ? "Sales Lead Assignment Updated" : "Service Lead Assignment Updated";
    const msg = `You have been assigned or re-assigned a ${type} lead: "${data.title}"`;

    await createNotification(data.assignedTo, title, msg, {
      link: leadPath,
      type: "record",
    });

    const assignee = await getUserById(data.assignedTo);
    if (assignee?.email) {
      await sendEmail(
        assignee.email,
        title,
        `Hello ${assignee.name},\n\n${msg}\n\nView it on the dashboard: https://company-dashboard-avenirit.web.app${leadPath}`,
        `<p>Hello ${assignee.name},</p><p>${msg}</p><p>View it on the <a href="https://company-dashboard-avenirit.web.app${leadPath}">Dashboard</a></p>`
      );
    }
  }
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
