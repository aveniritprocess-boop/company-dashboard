import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot,
    Timestamp,
    getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { broadcastNotification } from "./notifications";

export interface Location {
    id: string;
    name: string;
    code: string;
    state: string;
    status: "active" | "inactive";
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

const LOCATIONS_COLLECTION = "locations";

export async function createLocation(name: string, code: string, state: string, status: "active" | "inactive" = "active") {
    const now = serverTimestamp();
    await addDoc(collection(db, LOCATIONS_COLLECTION), {
        name,
        code,
        state,
        status,
        createdAt: now,
        updatedAt: now,
    });

    await broadcastNotification(
        "New Location Added",
        `A new workspace location "${name}" (${code}) has been added to the system.`,
        { type: "record" }
    );
}

export async function updateLocation(locationId: string, data: Partial<Omit<Location, "id" | "createdAt">>) {
    const locationRef = doc(db, LOCATIONS_COLLECTION, locationId);
    await updateDoc(locationRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });

    await broadcastNotification(
        "Location Updated",
        `Details for location ID ${locationId} have been modified.`,
        { type: "record" }
    );
}

export async function deleteLocation(locationId: string) {
    const locationRef = doc(db, LOCATIONS_COLLECTION, locationId);
    await deleteDoc(locationRef);

    await broadcastNotification(
        "Location Deleted",
        `A workspace location has been removed from the system.`,
        { type: "record" }
    );
}

export function subscribeToLocations(callback: (locations: Location[]) => void) {
    const q = query(
        collection(db, LOCATIONS_COLLECTION),
        orderBy("name", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const locations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Location[];

        callback(locations);
    });
}

export async function getAllLocations(): Promise<Location[]> {
    const snapshot = await getDocs(collection(db, LOCATIONS_COLLECTION));
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Location[];
}
