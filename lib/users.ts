import { collection, getDocs, onSnapshot, doc, getDoc, DocumentData, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AppUserSummary {
    uid: string;
    name: string | null;
    email: string | null;
    role?: string;
    mobile?: string;
    reporting_manager_id?: string;
    department?: string;
    location?: string;
    location_id?: string;
    employee_id?: string;
    is_active?: boolean;
    must_change_password?: boolean;
    designation?: string;
    joining_date?: string;
    employee_type?: string;
    address?: string;
    emergency_contact?: {
        name: string;
        relationship: string;
        mobile: string;
    };
    profile_photo?: string;
    gender?: "male" | "female" | "non-binary" | "prefer-not-to-say";
    status?: "active" | "inactive" | "notice_period" | "archived";
    exit_details?: {
        exit_date: string;
        exit_type: "resigned" | "terminated" | "retired" | "contract_ended";
        reason: string;
    };
    created_at?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    updated_at?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    portal_access?: boolean;
    is_locked?: boolean;
    is_deleted?: boolean;
}

function mapDocToUser(uid: string, data: DocumentData): AppUserSummary {
    return {
        uid,
        name: data.name ?? data.displayName ?? null,
        email: data.email ?? null,
        role: data.role ?? "employee",
        mobile: data.mobile,
        reporting_manager_id: data.reporting_manager_id,
        department: data.department,
        location: data.location,
        employee_id: data.employee_id,
        is_active: data.is_active ?? true,
        must_change_password: data.must_change_password ?? false,
        designation: data.designation,
        joining_date: data.joining_date,
        employee_type: data.employee_type,
        address: data.address,
        emergency_contact: data.emergency_contact,
        profile_photo: data.profile_photo,
        gender: data.gender || "prefer-not-to-say",
        status: data.status || (data.is_active === false ? "inactive" : "active"),
        exit_details: data.exit_details,
        created_at: data.created_at || data.createdAt,
        updated_at: data.updated_at || data.updatedAt,
        portal_access: data.portal_access ?? true,
        is_locked: data.is_locked ?? false,
        is_deleted: data.is_deleted ?? false,
    };
}

import { monitorQuery, trackListener } from "./firestore-monitor";

export async function getAllUsers(limitCount?: number): Promise<AppUserSummary[]> {
    return monitorQuery("getAllUsers", "employee_directory", async () => {
        const q = query(collection(db, "employee_directory"));
        const snap = await getDocs(q);
        
        if (process.env.NODE_ENV === "development") {
            console.log("Firestore Returned :", snap.size);
        }

        let users = snap.docs.map((d) => mapDocToUser(d.id, d.data()));
        if (process.env.NODE_ENV === "development") {
            console.log("Mapped Users       :", users.length);
        }
        
        // Filter out deleted, inactive, portal-revoked, or locked users
        users = users.filter(u => u.is_deleted !== true && u.is_active !== false && u.portal_access !== false && u.is_locked !== true);
        if (process.env.NODE_ENV === "development") {
            console.log("Filtered Users     :", users.length);
        }
        
        // Sort in memory by name
        users.sort((a, b) => {
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            return nameA.localeCompare(nameB);
        });

        if (limitCount) {
            users = users.slice(0, limitCount);
        }
        
        return users;
    });
}

export function subscribeToAllUsers(
  callback: (users: AppUserSummary[]) => void,
  limitCount?: number
): () => void {
  const cleanupMonitor = trackListener("subscribeToAllUsers");
  const collectionRef = collection(db, "employee_directory");
  
  const q = query(collectionRef);
  
  const unsub = onSnapshot(q, (snap) => {
    if (process.env.NODE_ENV === "development") {
        console.log("Firestore Returned :", snap.size);
    }

    let users = snap.docs.map((d) => mapDocToUser(d.id, d.data()));
    if (process.env.NODE_ENV === "development") {
        console.log("Mapped Users       :", users.length);
    }
    
    // Filter out deleted, inactive, portal-revoked, or locked users
    users = users.filter(u => u.is_deleted !== true && u.is_active !== false && u.portal_access !== false && u.is_locked !== true);
    if (process.env.NODE_ENV === "development") {
        console.log("Filtered Users     :", users.length);
    }
    
    // Sort in memory
    users.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    if (limitCount) {
        users = users.slice(0, limitCount);
    }

    callback(users);
  });
  
  return () => {
    unsub();
    cleanupMonitor();
  };
}

export async function getUserById(uid: string): Promise<AppUserSummary | null> {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (!userDoc.exists()) return null;
    const mapped = mapDocToUser(userDoc.id, userDoc.data());
    return {
        uid: mapped.uid,
        name: mapped.name,
        email: mapped.email,
        role: mapped.role,
        mobile: mapped.mobile,
        reporting_manager_id: mapped.reporting_manager_id,
        department: mapped.department,
        location: mapped.location,
        employee_id: mapped.employee_id,
        is_active: mapped.is_active,
        must_change_password: mapped.must_change_password,
        created_at: mapped.created_at,
        updated_at: mapped.updated_at,
    };
}
