"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RoleGuard } from "@/components/RoleGuard";
import { getAllUsers, AppUserSummary } from "@/lib/users";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserRole } from "@/lib/roles";
import { sendPasswordResetEmail } from "firebase/auth";
import { broadcastNotification } from "@/lib/notifications";
import Papa from "papaparse";
import {
    Users,
    Search,
    UserPlus,
    MoreVertical,
    Shield,
    Loader2,
    CheckCircle2,
    XCircle,
    KeyRound
} from "lucide-react";

interface CreationForm {
    name: string;
    email: string;
    mobile: string;
    role: UserRole;
    reporting_manager_id: string;
    department: string;
    location: string;
}

const initialForm = (): CreationForm => ({
    name: "",
    email: "",
    mobile: "",
    role: "employee",
    reporting_manager_id: "",
    department: "",
    location: "",
});

function EmployeesContent() {
    const { user, role: currentUserRole } = useAuth();
    const [users, setUsers] = useState<AppUserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLocation, setFilterLocation] = useState("all");
    const [filterDept, setFilterDept] = useState("all");
    const [updatingUid, setUpdatingUid] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [form, setForm] = useState<CreationForm>(initialForm());
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const roles: UserRole[] = ["ceo", "admin", "manager", "employee"];

    const fetchUsers = async () => {
        try {
            const data = await getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error(error);
            showToast("Failed to fetch users", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Not authenticated");

            // Auto-generate temporary password and employee ID
            const tempPassword = Math.random().toString(36).slice(-8) + "!";
            const employee_id = "EMP-" + Math.floor(1000 + Math.random() * 9000);

            const response = await fetch("/api/admin/create-employee", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    ...form,
                    password: tempPassword,
                    employee_id
                })
            });

            const result = await response.json();
            if (result.success) {
                showToast(`Employee created! Temp Password: ${tempPassword}`, "success");
                
                await broadcastNotification(
                    "New Employee Onboarded",
                    `${form.name} was added to the ${form.department} department.`,
                    { type: "record", fromUserName: user?.displayName || "Admin" }
                );

                setShowCreateModal(false);
                setForm(initialForm());
                fetchUsers();
            } else {
                throw new Error(result.error || "Failed to create employee");
            }
        } catch (error: unknown) {
            const err = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
            showToast(err.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
        setUpdatingUid(userId);
        try {
            const userToUpdate = users.find(u => u.uid === userId);
            await updateDoc(doc(db, "users", userId), {
                is_active: !currentStatus,
                updatedAt: new Date()
            });

            await broadcastNotification(
                "Employee Status Updated",
                `${userToUpdate?.name || "An employee"} has been ${!currentStatus ? 'activated' : 'deactivated'}.`,
                { type: "record", fromUserName: user?.displayName || "Admin" }
            );

            setUsers(users.map(u => u.uid === userId ? { ...u, is_active: !currentStatus } : u));
            showToast(`Account ${!currentStatus ? 'activated' : 'deactivated'}`, "success");
        } catch {
            showToast("Update failed", "error");
        } finally {
            setUpdatingUid(null);
        }
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        setUpdatingUid(userId);
        try {
            const userToUpdate = users.find(u => u.uid === userId);
            await updateDoc(doc(db, "users", userId), {
                role: newRole,
                updatedAt: new Date()
            });

            await broadcastNotification(
                "Employee Role Changed",
                `${userToUpdate?.name || "An employee"} is now a ${newRole}.`,
                { type: "record", fromUserName: user?.displayName || "Admin" }
            );

            setUsers(users.map(u => u.uid === userId ? { ...u, role: newRole } : u));
            showToast(`Role updated to ${newRole}`, "success");
        } catch {
            showToast("Failed to update role", "error");
        } finally {
            setUpdatingUid(null);
        }
    };

    const handleResetPassword = async (email: string) => {
        if (!email) return;
        try {
            await sendPasswordResetEmail(auth, email);
            showToast(`Password reset link sent to ${email}`, "success");
        } catch {
            showToast("Failed to send reset link", "error");
        }
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
                if (rows.length > 30) {
                    showToast("Max 30 employees per upload", "error");
                    setLoading(false);
                    return;
                }

                let successCount = 0;
                let failCount = 0;

                for (const row of rows) {
                    try {
                        const idToken = await auth.currentUser?.getIdToken();
                        if (!idToken) throw new Error("Not authenticated");

                        const tempPassword = Math.random().toString(36).slice(-8) + "!";
                        const employee_id = "EMP-" + Math.floor(1000 + Math.random() * 9000);

                        const response = await fetch("/api/admin/create-employee", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${idToken}`
                            },
                            body: JSON.stringify({
                                name: row.name,
                                email: row.email,
                                mobile: row.mobile || "",
                                role: row.role?.toLowerCase() || "employee",
                                reporting_manager_id: row.reporting_manager_id || "",
                                department: row.department || "",
                                location: row.location || "",
                                password: tempPassword,
                                employee_id
                            })
                        });

                        const result = await response.json();
                        if (result.success) successCount++;
                        else failCount++;
                    } catch {
                        failCount++;
                    }
                }

                showToast(`Bulk upload complete! ${successCount} success, ${failCount} failed.`, successCount > 0 ? "success" : "error");
                fetchUsers();
                setLoading(false);
            },
            error: () => {
                showToast("CSV parsing failed", "error");
                setLoading(false);
            }
        });
    };

    const uniqueLocations = Array.from(new Set(users.map(u => u.location).filter(Boolean)));
    const uniqueDepts = Array.from(new Set(users.map(u => u.department).filter(Boolean)));
    const managers = users.filter(u => u.role === "manager" || u.role === "admin" || u.role === "ceo");

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLocation = filterLocation === "all" || u.location === filterLocation;
        const matchesDept = filterDept === "all" || u.department === filterDept;
        return matchesSearch && matchesLocation && matchesDept;
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {toast && (
                <div className={`fixed top-8 right-8 z-50 px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white transition-all animate-in slide-in-from-right-4 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
                    <div className="flex items-center gap-2">
                        {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {toast.msg}
                    </div>
                </div>
            )}

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <Users className="h-8 w-8 text-indigo-600" />
                        Directory
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage portal access, roles, and reporting structures.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full md:w-64"
                        />
                    </div>

                    <select
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none"
                    >
                        <option value="all">All Locations</option>
                        {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>

                    <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none"
                    >
                        <option value="all">All Departments</option>
                        {uniqueDepts.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    </select>

                    {currentUserRole === "admin" && (
                        <div className="flex gap-2">
                            <input
                                type="file"
                                id="csvUpload"
                                accept=".csv"
                                className="hidden"
                                onChange={handleBulkUpload}
                            />
                            <label
                                htmlFor="csvUpload"
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl transition-all cursor-pointer"
                            >
                                <Users className="h-4 w-4" />
                                Bulk Upload
                            </label>

                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                                <UserPlus className="h-4 w-4" />
                                Add Employee
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">ID & Name</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Role</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Dept & Location</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Manager</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
                                        <p className="mt-2 text-sm text-slate-500 font-medium">Synchronizing directory...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <p className="text-sm text-slate-500 font-medium">No matches in current directory.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-xs ring-2 ring-white dark:ring-slate-900">
                                                    {u.name?.charAt(0) || "U"}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{u.name}</p>
                                                    <p className="text-[10px] text-indigo-500 font-bold tracking-tight">{u.employee_id || "NO-ID"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={u.role || "employee"}
                                                onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                disabled={updatingUid === u.uid || currentUserRole !== "admin" || u.role === "ceo"}
                                                className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                                            >
                                                {roles.map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{u.department || 'N/A'}</p>
                                            <p className="text-[10px] text-slate-500">{u.location || 'Remote'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                {managers.find(m => m.uid === u.reporting_manager_id)?.name || "Not Assigned"}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleStatusToggle(u.uid, !!u.is_active)}
                                                disabled={updatingUid === u.uid || currentUserRole !== "admin" || u.role === "ceo"}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${u.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                    } disabled:opacity-40`}
                                            >
                                                <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {currentUserRole === "admin" && u.role !== "ceo" ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        title="Send Password Reset"
                                                        onClick={() => handleResetPassword(u.email || "")}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                    >
                                                        <KeyRound className="h-4 w-4" />
                                                    </button>
                                                    <button className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Locked</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Employee Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in slide-in-from-bottom-8 duration-300">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white">Create Account</h2>
                                <p className="text-xs text-slate-500">Add a new professional member to the portal.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2.5 rounded-2xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateEmployee} className="p-8 space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input
                                        required
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium"
                                        placeholder="John Carter"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email (Primary ID)</label>
                                    <input
                                        required
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium"
                                        placeholder="john@avenir.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                                    <input
                                        value={form.mobile}
                                        onChange={e => setForm({ ...form, mobile: e.target.value })}
                                        className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium"
                                        placeholder="+91-0000000000"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Role Allocation</label>
                                    <select
                                        value={form.role}
                                        onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
                                        className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium"
                                    >
                                        <option value="employee">Employee</option>
                                        <option value="manager">Manager</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reporting Authority</label>
                                <select
                                    value={form.reporting_manager_id}
                                    onChange={e => setForm({ ...form, reporting_manager_id: e.target.value })}
                                    className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium"
                                >
                                    <option value="">Select Manager</option>
                                    {managers.map(m => (
                                        <option key={m.uid} value={m.uid}>{m.name} ({m.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                    <input
                                        value={form.department}
                                        onChange={e => setForm({ ...form, department: e.target.value })}
                                        className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium"
                                        placeholder="Engineering"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Work Location</label>
                                    <input
                                        value={form.location}
                                        onChange={e => setForm({ ...form, location: e.target.value })}
                                        className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium"
                                        placeholder="Gurugram (HQ)"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 mt-4 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                                Initialize Credentials
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function EmployeesPage() {
    return (
        <RoleGuard allowedRoles={["admin", "ceo"]} fallbackPath="/dashboard">
            <EmployeesContent />
        </RoleGuard>
    );
}
