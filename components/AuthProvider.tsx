"use client";

import { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection, getDocs, getDocFromServer } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { trackListener } from "@/lib/firestore-monitor";

interface AuthContextType {
    user: User | null;
    role: string | null;
    mustChangePassword: boolean;
    loading: boolean;
    permissions: Record<string, boolean>;
    hasPermission: (permission: string) => boolean;
    rolesList: { id: string; name: string; permissions: Record<string, boolean>; is_system?: boolean }[];
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    mustChangePassword: false,
    loading: true,
    permissions: {},
    hasPermission: () => false,
    rolesList: [],
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [rolesList, setRolesList] = useState<{ id: string; name: string; permissions: Record<string, boolean>; is_system?: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const lastUidRef = useRef<string | null>(null);

    // Auth State Changed Listener
    useEffect(() => {
        let unsubDoc: (() => void) | null = null;

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);

            if (unsubDoc) { unsubDoc(); unsubDoc = null; }

            if (firebaseUser) {
                // One-time fetch of roles with sessionStorage caching
                if (rolesList.length === 0) {
                    try {
                        const cachedRoles = sessionStorage.getItem("roles_cache");
                        if (cachedRoles) {
                            setRolesList(JSON.parse(cachedRoles));
                        } else {
                            getDocs(collection(db, "roles"))
                                .then((snap) => {
                                    const list = snap.docs.map(d => ({
                                        id: d.id,
                                        name: d.data().name || d.id,
                                        permissions: d.data().permissions || {},
                                        is_system: !!d.data().is_system
                                    }));
                                    setRolesList(list);
                                    sessionStorage.setItem("roles_cache", JSON.stringify(list));
                                })
                                .catch((err) => console.error("Failed to fetch roles:", err));
                        }
                    } catch (e) {
                        console.error("Error with sessionStorage roles cache:", e);
                    }
                }

                // Subscribe to user document for live status and role
                const cleanupUser = trackListener(`AuthProvider-user-${firebaseUser.uid}`);
                unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), async (docSnap) => {
                    try {
                        if (docSnap.exists()) {
                            let userData = docSnap.data();
                            
                            if (userData.is_active === false || userData.portal_access === false || userData.is_locked === true || userData.is_deleted === true) {
                                console.error("LOGOUT_CONDITION_MET", {
                                    exists: docSnap.exists(),
                                    fromCache: docSnap.metadata.fromCache,
                                    is_active: userData.is_active,
                                    portal_access: userData.portal_access,
                                    is_locked: userData.is_locked,
                                    is_deleted: userData.is_deleted,
                                });
                                
                                // Verify with server to prevent false logouts from cached reads
                                try {
                                    const serverSnap = await getDocFromServer(doc(db, "users", firebaseUser.uid));
                                    if (serverSnap.exists()) {
                                        const serverData = serverSnap.data();
                                        if (serverData.is_active === false || serverData.portal_access === false || serverData.is_locked === true || serverData.is_deleted === true) {
                                            await fetch("/api/auth/logout", { method: "POST" });
                                            await auth.signOut();
                                            setRole(null);
                                            setUser(null);
                                            return;
                                        }
                                        userData = serverData;
                                    } else {
                                        console.warn("User document not found on server.");
                                        return;
                                    }
                                } catch (err) {
                                    console.error("Error verifying logout condition with server:", err);
                                }
                            }

                            const userRole = userData.role || "employee";
                            setRole(userRole);
                            setMustChangePassword(!!userData.must_change_password);
                        } else {
                            setRole(null);
                        }
                    } finally {
                        setLoading(false);
                    }
                }, (error) => {
                    console.error("Error fetching user data:", error);
                    setLoading(false);
                });
                const originalUnsubDoc = unsubDoc;
                unsubDoc = () => { originalUnsubDoc(); cleanupUser(); };
            } else {
                setRole(null);
                setMustChangePassword(false);
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
            if (unsubDoc) unsubDoc();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isUltimateAdmin = useMemo(() => {
        const rLower = role?.toLowerCase();
        return rLower === "ceo" || rLower === "md";
    }, [role]);

    // Compute permissions matrix when role or rolesList changes
    const permissions = useMemo<Record<string, boolean>>(() => {
        if (!role || rolesList.length === 0) {
            return {};
        }

        // CEO & MD have ultimate access: all possible permissions are true
        if (isUltimateAdmin) {
            const allPerms: Record<string, boolean> = {};
            rolesList.forEach(r => {
                Object.keys(r.permissions).forEach(k => {
                    allPerms[k] = true;
                });
            });
            // Ensure core permissions are explicitly present
            allPerms.view_employees = true;
            allPerms.add_employees = true;
            allPerms.edit_employees = true;
            allPerms.delete_employees = true;
            allPerms.export_data = true;
            allPerms.import_data = true;
            allPerms.view_salary = true;
            allPerms.manage_payroll = true;
            allPerms.approve_leave = true;
            allPerms.manage_attendance = true;
            allPerms.manage_teams = true;
            allPerms.manage_projects = true;
            allPerms.manage_settings = true;
            return allPerms;
        }

        const match = rolesList.find(r => r.id === role);
        return match ? (match.permissions || {}) : {};
    }, [role, rolesList, isUltimateAdmin]);

    // Update last login timestamp — only runs once when user UID changes
    useEffect(() => {
        if (user && lastUidRef.current !== user.uid) {
            lastUidRef.current = user.uid;
            updateDoc(doc(db, "users", user.uid), {
                last_login_at: new Date(),
                updatedAt: new Date()
            }).catch((error: unknown) => console.error("Error updating last login:", error));
        }
    }, [user]);

    const hasPermission = (permissionName: string) => {
        if (isUltimateAdmin) return true;
        return !!permissions[permissionName];
    };

    return (
        <AuthContext.Provider value={{ user, role, mustChangePassword, loading, permissions, hasPermission, rolesList }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
