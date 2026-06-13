"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { initializeRolesAndPermissions } from "@/lib/init-db";

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

    // 1. Subscribe to the roles collection in real time
    useEffect(() => {
        const unsubRoles = onSnapshot(collection(db, "roles"), (snap) => {
            const list = snap.docs.map(d => ({
                id: d.id,
                name: d.data().name || d.id,
                permissions: d.data().permissions || {},
                is_system: !!d.data().is_system
            }));
            setRolesList(list);
        });
        return () => unsubRoles();
    }, []);

    // 2. Auth State Changed Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // Initialize default roles in database
                initializeRolesAndPermissions(db);

                // Subscribe to user document for live status and role
                const unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        
                        // Enforce deactivation, locked status, and portal access disabled
                        if (userData.is_active === false || userData.portal_access === false || userData.is_locked === true || userData.is_deleted === true) {
                            auth.signOut();
                            document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
                            setRole(null);
                            setUser(null);
                            setLoading(false);
                            return;
                        }

                        const userRole = userData.role || "employee";
                        setRole(userRole);
                        setMustChangePassword(!!userData.must_change_password);
                    } else {
                        setRole(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching user data:", error);
                    setLoading(false);
                });

                return () => unsubDoc();
            } else {
                setRole(null);
                setMustChangePassword(false);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // 3. Compute permissions matrix when role or rolesList changes
    const permissions = useMemo<Record<string, boolean>>(() => {
        if (!role || rolesList.length === 0) {
            return {};
        }

        // CEO has ultimate access: all possible permissions are true
        if (role.toLowerCase() === "ceo") {
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
    }, [role, rolesList]);

    // 4. Update last login timestamp in the background
    useEffect(() => {
        if (user) {
            updateDoc(doc(db, "users", user.uid), {
                last_login_at: new Date(),
                updatedAt: new Date()
            }).catch((error: unknown) => console.error("Error updating last login:", error));
        }
    }, [user]);

    const hasPermission = (permissionName: string) => {
        if (role?.toLowerCase() === "ceo") return true;
        return !!permissions[permissionName];
    };

    return (
        <AuthContext.Provider value={{ user, role, mustChangePassword, loading, permissions, hasPermission, rolesList }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
