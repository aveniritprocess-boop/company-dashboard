import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AppUserSummary {
    uid: string;
    name: string | null;
    email: string | null;
}

export async function getAllUsers(): Promise<AppUserSummary[]> {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            uid: d.id,
            name: data.name ?? data.displayName ?? null,
            email: data.email ?? null,
        };
    });
}
