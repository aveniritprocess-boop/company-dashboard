"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserRole } from "@/lib/roles";

interface AuthContextType {
    user: User | null;
    role: UserRole | null;
    mustChangePassword: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    mustChangePassword: false,
    loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // Subscribe to user document for live role updates
                const unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        // Safely cast role, defaulting to 'employee' if missing or invalid
                        const userRole = (userData.role as UserRole) || "employee";
                        setRole(userRole);
                        setMustChangePassword(!!userData.must_change_password);
                    } else {
                        setRole(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching user role:", error);
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

    useEffect(() => {
        if (user) {
            updateDoc(doc(db, "users", user.uid), {
                last_login_at: new Date(),
                updatedAt: new Date()
            }).catch((error: unknown) => console.error("Error updating last login:", error));
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, role, mustChangePassword, loading }}>
            {children}
        </AuthContext.Provider>
    );
};


export const useAuth = () => useContext(AuthContext);
