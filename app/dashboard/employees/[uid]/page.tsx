"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, orderBy, limit, addDoc, updateDoc } from "firebase/firestore";
import { AppUserSummary } from "@/lib/users";
import { getSessionHistory, AttendanceSession } from "@/lib/attendance";
import { subscribeToAllTasksForUser, Task } from "@/lib/tasks";
import { logActivityClient } from "@/lib/audit-client";
import {
    ArrowLeft, Mail, Phone, MapPin, Briefcase, User, Clock, AlertCircle, FileText, Activity, ShieldCheck, Loader2, Calendar, Award, Download, Trash2, Plus, FileSignature, CheckCircle2, XCircle
} from "lucide-react";

interface AuditLogEntry {
    id: string;
    operator_name: string;
    action: string;
    details: string;
    timestamp: unknown;
}

interface LeaveRequest {
    id: string;
    user_id?: string;
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
    status?: string;
    created_at?: unknown;
    approved_by?: string;
    total_days?: number;
}

interface PerformanceReview {
    id: string;
    user_id?: string;
    evaluator_id?: string;
    evaluator_name?: string;
    review_period?: string;
    rating_productivity?: number;
    rating_collaboration?: number;
    rating_communication?: number;
    overall_score?: number;
    comments?: string;
    goals?: string[];
    created_at?: unknown;
}

interface DocumentItem {
    id: string;
    name: string;
    size: string;
    type: string;
    uploadedAt: string;
}

export default function EmployeeProfilePage() {
    const { uid } = useParams() as { uid: string };
    const { user, role: currentUserRole } = useAuth();
    const router = useRouter();

    const [employee, setEmployee] = useState<AppUserSummary | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"personal" | "employment" | "tasks" | "attendance" | "audit" | "leaves" | "performance" | "documents">("personal");

    // Form inputs states
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    // Leaves tab states
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [leaveType, setLeaveType] = useState<string>("annual");
    const [leaveStart, setLeaveStart] = useState("");
    const [leaveEnd, setLeaveEnd] = useState("");
    const [leaveReason, setLeaveReason] = useState("");
    const [leaveSubmitting, setLeaveSubmitting] = useState(false);
    const [actioningLeaveId, setActioningLeaveId] = useState<string | null>(null);

    // Performance tab states
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [ratingProductivity, setRatingProductivity] = useState(5);
    const [ratingCollaboration, setRatingCollaboration] = useState(5);
    const [ratingCommunication, setRatingCommunication] = useState(5);
    const [evalPeriod, setEvalPeriod] = useState("Q1 2026");
    const [evalComments, setEvalComments] = useState("");
    const [evalGoals, setEvalGoals] = useState("");
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    // Documents tab states
    const [documents, setDocuments] = useState<DocumentItem[]>([
        { id: "doc-1", name: "Employment_Agreement.pdf", size: "1.2 MB", type: "PDF", uploadedAt: "2026-01-10" },
        { id: "doc-2", name: "National_Identity_Card.png", size: "480 KB", type: "Image", uploadedAt: "2026-01-11" },
        { id: "doc-3", name: "Degree_Certificate.pdf", size: "950 KB", type: "PDF", uploadedAt: "2026-01-12" }
    ]);
    const [docName, setDocName] = useState("");
    const [docType, setDocType] = useState("PDF");

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Guard & Data Loading
    useEffect(() => {
        if (!uid) return;

        // Security check
        const allowed = currentUserRole === "ceo" || currentUserRole === "md" || currentUserRole === "admin" || currentUserRole === "hr" || user?.uid === uid;
        if (!allowed && currentUserRole !== null) {
            router.push("/dashboard");
            return;
        }

        // 1. Subscribe to employee Firestore doc
        const unsubEmployee = onSnapshot(doc(db, "users", uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setEmployee({
                    uid: snap.id,
                    name: data.name || data.displayName || "Unknown",
                    email: data.email || "",
                    role: data.role || "employee",
                    mobile: data.mobile || "",
                    reporting_manager_id: data.reporting_manager_id || "",
                    department: data.department || "",
                    location: data.location || "",
                    employee_id: data.employee_id || "",
                    is_active: data.is_active ?? true,
                    designation: data.designation || "Specialist",
                    joining_date: data.joining_date || "",
                    employee_type: data.employee_type || "permanent",
                    address: data.address || "",
                    emergency_contact: data.emergency_contact || { name: "", relationship: "", mobile: "" },
                    profile_photo: data.profile_photo || "",
                    gender: data.gender || "prefer-not-to-say",
                    status: data.status || (data.is_active === false ? "inactive" : "active"),
                    exit_details: data.exit_details
                });
            } else {
                setEmployee(null);
            }
            setLoading(false);
        });

        // 2. Subscribe to employee's tasks
        const unsubTasks = subscribeToAllTasksForUser(uid, (data) => {
            setTasks(data);
        });

        // 3. Fetch attendance history
        getSessionHistory(uid, 50).then(data => {
            setAttendance(data);
        }).catch(err => console.error("Error loading attendance history:", err));

        // 4. Subscribe to target user audit logs
        const qLogs = query(
            collection(db, "audit_logs"),
            where("target_id", "==", uid),
            orderBy("timestamp", "desc"),
            limit(50)
        );
        const unsubLogs = onSnapshot(qLogs, (snap) => {
            const logsList: AuditLogEntry[] = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as AuditLogEntry));
            setAuditLogs(logsList);
        }, (err) => console.error("Error loading audit logs:", err));

        // 5. Subscribe to user leave requests
        const qLeaves = query(
            collection(db, "leave_requests"),
            where("user_id", "==", uid),
            orderBy("created_at", "desc")
        );
        const unsubLeaves = onSnapshot(qLeaves, (snap) => {
            const leavesList = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setLeaves(leavesList);
        }, (err) => console.error("Error loading leave requests:", err));

        // 6. Subscribe to user performance reviews
        const qReviews = query(
            collection(db, "performance_reviews"),
            where("user_id", "==", uid),
            orderBy("created_at", "desc")
        );
        const unsubReviews = onSnapshot(qReviews, (snap) => {
            const reviewsList = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setReviews(reviewsList);
        }, (err) => console.error("Error loading performance reviews:", err));

        return () => {
            unsubEmployee();
            unsubTasks();
            unsubLogs();
            unsubLeaves();
            unsubReviews();
        };
    }, [uid, user, currentUserRole, router]);

    const handleRequestLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leaveStart || !leaveEnd || !leaveReason) {
            showToast("Please fill in leave dates and reason coords", "error");
            return;
        }
        setLeaveSubmitting(true);
        try {
            const start = new Date(leaveStart);
            const end = new Date(leaveEnd);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            await addDoc(collection(db, "leave_requests"), {
                user_id: uid,
                user_name: employee?.name || "Unknown",
                leave_type: leaveType,
                start_date: leaveStart,
                end_date: leaveEnd,
                total_days: totalDays,
                reason: leaveReason,
                status: "pending",
                created_at: new Date()
            });

            // Write audit log
            await logActivityClient({
                action: "leave_request_submitted",
                performedBy: user?.uid || "system",
                performedByName: user?.displayName || user?.email || "Employee",
                targetId: uid,
                targetType: "leave",
                details: `Submitted a leave request for ${totalDays} days of ${leaveType} leave.`,
                metadata: { totalDays, leaveType }
            });

            showToast("Leave request filed successfully.", "success");
            setLeaveReason("");
            setLeaveStart("");
            setLeaveEnd("");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An error occurred";
            showToast(errorMessage, "error");
        } finally {
            setLeaveSubmitting(false);
        }
    };

    const handleActionLeave = async (leaveId: string, status: "approved" | "rejected") => {
        setActioningLeaveId(leaveId);
        try {
            await updateDoc(doc(db, "leave_requests", leaveId), {
                status,
                approved_by: user?.uid || "system"
            });

            // Write audit log
            await logActivityClient({
                action: status === "approved" ? "leave_approved" : "leave_rejected",
                performedBy: user?.uid || "system",
                performedByName: user?.displayName || user?.email || "Manager",
                targetId: uid,
                targetType: "leave",
                details: `${status === 'approved' ? 'Approved' : 'Rejected'} leave request (ID: ${leaveId}).`,
                metadata: { 
                    leaveId, 
                    before: { status: "pending" }, 
                    after: { status } 
                }
            });

            showToast(`Leave request ${status} successfully.`, "success");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An error occurred";
            showToast(errorMessage, "error");
        } finally {
            setActioningLeaveId(null);
        }
    };

    const handleAddReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!evalComments) {
            showToast("Please provide review feedback comments", "error");
            return;
        }
        setReviewSubmitting(true);
        try {
            const overall_score = Math.round(((ratingProductivity + ratingCollaboration + ratingCommunication) / 3) * 10) / 10;
            const goalsArray = evalGoals.split("\n").map(g => g.trim()).filter(g => g.length > 0);

            await addDoc(collection(db, "performance_reviews"), {
                user_id: uid,
                evaluator_id: user?.uid || "system",
                evaluator_name: user?.displayName || user?.email || "Evaluator",
                review_period: evalPeriod,
                rating_productivity: ratingProductivity,
                rating_collaboration: ratingCollaboration,
                rating_communication: ratingCommunication,
                overall_score,
                comments: evalComments,
                goals: goalsArray,
                created_at: new Date()
            });

            // Write audit log
            await logActivityClient({
                action: "settings_changed",
                performedBy: user?.uid || "system",
                performedByName: user?.displayName || user?.email || "Manager",
                targetId: uid,
                targetType: "settings",
                details: `Submitted a performance evaluation review for ${evalPeriod} with overall rating of ${overall_score}/5.`,
                metadata: {
                    evalPeriod,
                    overall_score,
                    ratingProductivity,
                    ratingCollaboration,
                    ratingCommunication
                }
            });

            showToast("Performance review logged successfully.", "success");
            setEvalComments("");
            setEvalGoals("");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An error occurred";
            showToast(errorMessage, "error");
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleAddDocument = (e: React.FormEvent) => {
        e.preventDefault();
        if (!docName) return;
        const newDoc = {
            id: "doc-" + Math.floor(1000 + Math.random() * 9000),
            name: docName.endsWith(".pdf") || docName.endsWith(".png") || docName.endsWith(".jpg") ? docName : `${docName}.${docType.toLowerCase()}`,
            size: "1.1 MB",
            type: docType,
            uploadedAt: new Date().toISOString().split("T")[0]
        };
        setDocuments(prev => [newDoc, ...prev]);
        setDocName("");
        showToast("Mock Document uploaded successfully.", "success");
    };

    const handleDeleteDoc = (id: string, name: string) => {
        setDocuments(prev => prev.filter(d => d.id !== id));
        showToast(`Document ${name} deleted successfully.`, "success");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-sm text-slate-500 font-medium">Synchronizing profile dossier...</p>
                </div>
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="text-center py-16 space-y-4 max-w-md mx-auto">
                <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Profile Dossier Missing</h3>
                <p className="text-sm text-slate-500">The requested employee directory file could not be retrieved from the ledger.</p>
                <button onClick={() => router.push("/dashboard/employees")} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20">
                    Back to Directory
                </button>
            </div>
        );
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const pendingTasks = tasks.filter(t => t.status !== "completed" && t.status !== "rejected").length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Check if evaluator has write privileges
    const hasWriteRights = currentUserRole === "ceo" || currentUserRole === "md" || currentUserRole === "admin" || currentUserRole === "hr";

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {toast && (
                <div className={`fixed top-8 right-8 z-50 px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white transition-all animate-in slide-in-from-right-4 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
                    <div className="flex items-center gap-2">
                        {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {toast.msg}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => router.push("/dashboard/employees")}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:shadow-sm transition-all"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                    <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">Employee Profile</span>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        {employee.name}
                        <span className="text-sm font-medium text-slate-400">({employee.employee_id || "NO-ID"})</span>
                    </h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Card: Core Avatar & Contact Details */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center space-y-6 h-fit">
                    <div className="relative">
                        {employee.profile_photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={employee.profile_photo} alt={employee.name || ""} className="w-32 h-32 rounded-full object-cover ring-4 ring-indigo-50 dark:ring-indigo-900/30" />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-4xl ring-4 ring-indigo-50 dark:ring-indigo-900/30">
                                {employee.name?.charAt(0) || "U"}
                            </div>
                        )}
                        <span className={`absolute bottom-1 right-2 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${employee.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{employee.name}</h2>
                        <p className="text-sm font-semibold text-indigo-500 mt-1 capitalize">{employee.designation} &bull; {employee.department}</p>
                    </div>

                    <div className="w-full h-px bg-slate-100 dark:bg-slate-800" />

                    <div className="w-full space-y-4 text-left">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span className="text-xs font-semibold truncate">{employee.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span className="text-xs font-semibold">{employee.mobile || "No phone added"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span className="text-xs font-semibold truncate">{employee.location || "Remote"}</span>
                        </div>
                    </div>

                    {/* Exit details display if inactive */}
                    {employee.status === "inactive" && employee.exit_details && (
                        <div className="w-full p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 text-left space-y-2">
                            <span className="text-[10px] text-rose-600 dark:text-rose-450 font-black uppercase tracking-wider block">Offboarding record</span>
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 space-y-1">
                                <div>Exit Date: <span className="text-slate-950 dark:text-white font-black">{employee.exit_details.exit_date}</span></div>
                                <div className="capitalize">Exit Type: <span className="text-slate-950 dark:text-white font-black">{employee.exit_details.exit_type.replace('_', ' ')}</span></div>
                                <div className="italic">&quot;{employee.exit_details.reason}&quot;</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Card: Tabbed Details & metrics */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Key metrics Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Task Performance</span>
                            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 block mt-1">{completionRate}%</span>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Tasks</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white block mt-1">{totalTasks}</span>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Active Pending</span>
                            <span className="text-xl font-black text-amber-500 block mt-1">{pendingTasks}</span>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm flex flex-wrap gap-1">
                        <button onClick={() => setActiveTab("personal")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "personal" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                            Personal
                        </button>
                        <button onClick={() => setActiveTab("employment")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "employment" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                            Job Info
                        </button>
                        <button onClick={() => setActiveTab("leaves")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "leaves" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                            Leaves
                        </button>
                        <button onClick={() => setActiveTab("performance")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "performance" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                            Review
                        </button>
                        <button onClick={() => setActiveTab("documents")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "documents" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                            Docs
                        </button>
                        <button onClick={() => setActiveTab("tasks")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "tasks" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                            Tasks
                        </button>
                        <button onClick={() => setActiveTab("attendance")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "attendance" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                            Attendance
                        </button>
                        {(currentUserRole === "ceo" || currentUserRole === "md" || currentUserRole === "admin" || currentUserRole === "hr") && (
                            <button onClick={() => setActiveTab("audit")} className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${activeTab === "audit" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                                Audits
                            </button>
                        )}
                    </div>

                    {/* Tab Contents Panel */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm min-h-[300px]">
                        
                        {/* PERSONAL TAB */}
                        {activeTab === "personal" && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <User className="h-4 w-4 text-indigo-500" />
                                    Personal Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Residential Address</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{employee.address || "No address added"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mobile Number</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{employee.mobile || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gender Demographics</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{employee.gender || "prefer-not-to-say"}</p>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100 dark:bg-slate-800" />

                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Emergency Contact Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contact Name</span>
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{employee.emergency_contact?.name || "No name registered"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Relationship</span>
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{employee.emergency_contact?.relationship || "N/A"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contact Number</span>
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{employee.emergency_contact?.mobile || "N/A"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EMPLOYMENT TAB */}
                        {activeTab === "employment" && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-indigo-500" />
                                    Employment Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Employee ID</span>
                                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{employee.employee_id || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Employee Type</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{employee.employee_type}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Designation</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{employee.designation}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Department</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{employee.department}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Joining Date</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{employee.joining_date || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Authorization Role</span>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{employee.role}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LEAVES TAB */}
                        {activeTab === "leaves" && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-indigo-500" />
                                    Leave Management
                                </h3>

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    {/* Request Leave Form */}
                                    <div className="xl:col-span-1 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">File Leave Request</h4>
                                        <form onSubmit={handleRequestLeave} className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leave Classification</label>
                                                <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none">
                                                    <option value="annual">Annual Leave</option>
                                                    <option value="sick">Sick Leave</option>
                                                    <option value="casual">Casual Leave</option>
                                                    <option value="unpaid">Unpaid Leave</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Start Date</label>
                                                <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">End Date</label>
                                                <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Reason Coords</label>
                                                <input type="text" placeholder="State reason details..." value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none" />
                                            </div>
                                            <button type="submit" disabled={leaveSubmitting} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                                                {leaveSubmitting && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                                                Submit Request
                                            </button>
                                        </form>
                                    </div>

                                    {/* Leaves History */}
                                    <div className="xl:col-span-2 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Leave Ledger Queue</h4>
                                        <div className="space-y-3">
                                            {leaves.length === 0 ? (
                                                <p className="text-xs text-slate-400 font-semibold italic">No leave logs registered under this account.</p>
                                            ) : (
                                                leaves.map(l => (
                                                    <div key={l.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-white capitalize">{l.leave_type} Leave</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${l.status === 'approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : l.status === 'rejected' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'}`}>
                                                                    {l.status}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 block mt-1">{l.start_date} to {l.end_date} &bull; {l.total_days} Days</span>
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-350 italic mt-1">&quot;{l.reason}&quot;</p>
                                                        </div>

                                                        {/* Approver Controls for CEO/Admin/HR */}
                                                        {hasWriteRights && l.status === "pending" && (
                                                            <div className="flex gap-1.5 self-end sm:self-center">
                                                                <button 
                                                                    disabled={actioningLeaveId === l.id}
                                                                    onClick={() => handleActionLeave(l.id, "rejected")} 
                                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition-all"
                                                                >
                                                                    Reject
                                                                </button>
                                                                <button 
                                                                    disabled={actioningLeaveId === l.id}
                                                                    onClick={() => handleActionLeave(l.id, "approved")} 
                                                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-bold transition-all"
                                                                >
                                                                    Approve
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PERFORMANCE TAB */}
                        {activeTab === "performance" && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Award className="h-4 w-4 text-indigo-500" />
                                    Performance & Goals Reviews
                                </h3>

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    {/* Evaluate Review Form for Manager/CEO/HR */}
                                    <div className="xl:col-span-1 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Evaluate Employee</h4>
                                        {hasWriteRights ? (
                                            <form onSubmit={handleAddReview} className="space-y-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Review Cycle Period</label>
                                                    <input required placeholder="e.g. Q1 2026" value={evalPeriod} onChange={e => setEvalPeriod(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Productivity Rating (1-5)</label>
                                                    <div className="flex gap-1.5">
                                                        {[1, 2, 3, 4, 5].map(val => (
                                                            <button type="button" key={val} onClick={() => setRatingProductivity(val)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${ratingProductivity === val ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-500'}`}>{val}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Collaboration Rating (1-5)</label>
                                                    <div className="flex gap-1.5">
                                                        {[1, 2, 3, 4, 5].map(val => (
                                                            <button type="button" key={val} onClick={() => setRatingCollaboration(val)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${ratingCollaboration === val ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-500'}`}>{val}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Communication Rating (1-5)</label>
                                                    <div className="flex gap-1.5">
                                                        {[1, 2, 3, 4, 5].map(val => (
                                                            <button type="button" key={val} onClick={() => setRatingCommunication(val)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${ratingCommunication === val ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-500'}`}>{val}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Evaluation Comments</label>
                                                    <textarea required rows={2} placeholder="State performance comments..." value={evalComments} onChange={e => setEvalComments(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Assign Goals (Line separated)</label>
                                                    <textarea rows={2} placeholder="Goal 1&#10;Goal 2..." value={evalGoals} onChange={e => setEvalGoals(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none" />
                                                </div>
                                                <button type="submit" disabled={reviewSubmitting} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                                                    {reviewSubmitting && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                                                    Log Evaluation
                                                </button>
                                            </form>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic font-semibold">Evaluation forms are restricted to reporting heads, HR leads, or administrators.</p>
                                        )}
                                    </div>

                                    {/* Evaluation Reviews Ledger */}
                                    <div className="xl:col-span-2 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Reviews history log</h4>
                                        <div className="space-y-4">
                                            {reviews.length === 0 ? (
                                                <p className="text-xs text-slate-400 font-semibold italic">No performance review logs captured.</p>
                                            ) : (
                                                reviews.map(r => (
                                                    <div key={r.id} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-sm">
                                                        <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-850 pb-2">
                                                            <div>
                                                                <span className="text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 px-2.5 py-0.5 rounded-full">{r.review_period} Cycle</span>
                                                                <p className="text-[10px] text-slate-450 mt-1">Evaluated by: <span className="font-bold">{r.evaluator_name}</span></p>
                                                            </div>
                                                            <div className="text-center p-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-850 w-16">
                                                                <span className="text-[8px] text-slate-400 font-black block uppercase">SCORE</span>
                                                                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{r.overall_score}/5</span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-650 dark:text-slate-350">
                                                            <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-950/20">Prod: {r.rating_productivity || 5}</div>
                                                            <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-950/20">Collab: {r.rating_collaboration || 5}</div>
                                                            <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-950/20">Comm: {r.rating_communication || 5}</div>
                                                        </div>

                                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium italic mt-2">&quot;{r.comments}&quot;</p>

                                                        {r.goals && r.goals.length > 0 && (
                                                            <div className="pt-2">
                                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mb-1">Target Goals Assigned</span>
                                                                <ul className="list-disc pl-4 text-xs font-semibold text-slate-550 dark:text-slate-350 space-y-0.5">
                                                                    {r.goals.map((g: string, idx: number) => <li key={idx}>{g}</li>)}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DOCUMENTS TAB */}
                        {activeTab === "documents" && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <FileSignature className="h-4 w-4 text-indigo-500" />
                                    Secure Documents Locker
                                </h3>

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    {/* Upload document form */}
                                    <div className="xl:col-span-1 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Register Document</h4>
                                        <form onSubmit={handleAddDocument} className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Document Name</label>
                                                <input required placeholder="e.g. Identity_Card" value={docName} onChange={e => setDocName(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Classification Type</label>
                                                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none">
                                                    <option value="PDF">PDF document</option>
                                                    <option value="Image">Image snapshot</option>
                                                    <option value="Doc">Word file</option>
                                                </select>
                                            </div>
                                            <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                                                <Plus className="h-4.5 w-4.5" />
                                                Add to Vault
                                            </button>
                                        </form>
                                    </div>

                                    {/* Documents file list */}
                                    <div className="xl:col-span-2 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Documents vault</h4>
                                        <div className="space-y-3">
                                            {documents.map(docItem => (
                                                <div key={docItem.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="h-8 w-8 text-indigo-500" />
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-800 dark:text-white block truncate max-w-xs">{docItem.name}</span>
                                                            <span className="text-[9px] text-slate-400 font-bold">{docItem.size} &bull; Uploaded: {docItem.uploadedAt}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => showToast(`Downloading ${docItem.name} (Simulation)...`, "success")}
                                                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg hover:text-slate-750 transition-colors"
                                                            title="Download File"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </button>
                                                        {hasWriteRights && (
                                                            <button 
                                                                onClick={() => handleDeleteDoc(docItem.id, docItem.name)}
                                                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-650 rounded-lg transition-colors"
                                                                title="Delete File"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TASKS TAB */}
                        {activeTab === "tasks" && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-indigo-500" />
                                    Assigned Action Ledger
                                </h3>
                                <div className="space-y-3">
                                    {tasks.length === 0 ? (
                                        <p className="text-xs text-slate-500 font-medium">No tasks currently assigned to this account.</p>
                                    ) : (
                                        tasks.map(t => (
                                            <div key={t.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{t.taskText || t.title}</h4>
                                                    <p className="text-[10px] text-slate-400 mt-1">Priority: <span className="font-bold text-indigo-500 uppercase">{t.priority}</span> &bull; Due: {t.dueDate || 'N/A'}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10' : 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-500/10'}`}>
                                                    {t.status}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ATTENDANCE TAB */}
                        {activeTab === "attendance" && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-indigo-500" />
                                    Recent Attendance Logs
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                                                <th className="py-2">Clock In Time</th>
                                                <th className="py-2">Clock Out Time</th>
                                                <th className="py-2">Duration</th>
                                                <th className="py-2 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                            {attendance.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-6 text-center text-slate-400 font-medium">No clock sessions found.</td>
                                                </tr>
                                            ) : (
                                                attendance.map(a => {
                                                    const inTime = a.clockInAt?.toDate?.()?.toLocaleString() || "N/A";
                                                    const outTime = a.clockOutAt?.toDate?.()?.toLocaleString() || "--";
                                                    
                                                    // Duration calc
                                                    let duration = "Active session";
                                                    if (a.durationSeconds) {
                                                        const hrs = Math.floor(a.durationSeconds / 3600);
                                                        const mins = Math.floor((a.durationSeconds % 3600) / 60);
                                                        duration = `${hrs}h ${mins}m`;
                                                    } else if (a.clockInAt && a.clockOutAt) {
                                                        const diffSec = Math.floor((a.clockOutAt.toDate().getTime() - a.clockInAt.toDate().getTime()) / 1000);
                                                        const hrs = Math.floor(diffSec / 3600);
                                                        const mins = Math.floor((diffSec % 3600) / 60);
                                                        duration = `${hrs}h ${mins}m`;
                                                    }

                                                    return (
                                                        <tr key={a.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                                                            <td className="py-3 font-medium">{inTime}</td>
                                                            <td className="py-3 font-medium">{outTime}</td>
                                                            <td className="py-3 font-medium">{duration}</td>
                                                            <td className="py-3 text-right">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${a.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                                    {a.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* AUDITS TAB */}
                        {activeTab === "audit" && (currentUserRole === "ceo" || currentUserRole === "md" || currentUserRole === "admin" || currentUserRole === "hr") && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-indigo-500" />
                                    Security Audit History
                                </h3>
                                <div className="space-y-4">
                                    {auditLogs.length === 0 ? (
                                        <p className="text-xs text-slate-400 font-medium">No audit items captured for this employee.</p>
                                    ) : (
                                        auditLogs.map(log => (
                                            <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                                <div className="space-y-1">
                                                    <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                                                        <ShieldCheck className="h-3 w-3" />
                                                        {log.action}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{log.details}</p>
                                                    <p className="text-[10px] text-slate-400">By Operator: <span className="font-semibold">{log.operator_name}</span></p>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                    {log.timestamp && typeof log.timestamp === 'object' && 'toDate' in log.timestamp
                                                        ? (log.timestamp as { toDate: () => Date }).toDate().toLocaleString()
                                                        : (log.timestamp ? new Date(log.timestamp as string).toLocaleString() : "N/A")}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
