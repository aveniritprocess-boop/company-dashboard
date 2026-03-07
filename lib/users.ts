import { collection, getDocs } from "firebase/firestore";
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
    created_at?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    updated_at?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function getAllUsers(): Promise<AppUserSummary[]> {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            uid: d.id,
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
            created_at: data.created_at || data.createdAt,
            updated_at: data.updated_at || data.updatedAt,
        };
    });
}
