"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { db, auth } from "@/lib/firebase";
import { subscribeToAllUsers, AppUserSummary } from "@/lib/users";
import { broadcastNotification } from "@/lib/notifications";
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc, deleteDoc, updateDoc, getDocs, startAfter, getCountFromServer, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import Link from "next/link";
import Papa from "papaparse";
import { authenticatedFetch } from "@/lib/api-client";
import { CreateEmployeeSchema } from "@/lib/validators/employee";
import { ResetPasswordSchema } from "@/lib/validators/auth";
import {
    Users, UserPlus, MoreVertical, Shield, Loader2, CheckCircle2, XCircle, KeyRound, Lock, Unlock, Download, Check, X, BarChart2, GitFork, ClipboardCheck, LayoutGrid, AlertCircle, Mail, Upload, FileText, Trash2, RotateCcw, ArrowLeft, ArrowRight
} from "lucide-react";
import { ExportMenu } from "@/components/export/ExportMenu";

import { EmployeeSearchPanel } from "@/components/search/EmployeeSearchPanel";
import { searchEmployees } from "@/lib/search/employee-search";

import { AuditSearchPanel } from "@/components/search/AuditSearchPanel";
import { searchAuditLogs } from "@/lib/search/audit-search";

/**
 * Generates a cryptographically-adequate temporary password that
 * satisfies passwordSchema: min 8 chars, ≥1 uppercase, ≥1 digit.
 *
 * Math.random().toString(36) only produces [a-z0-9] — it can NEVER
 * produce an uppercase letter, so it was always rejected by the Zod
 * schema added in Phase 5.4. This replaces both broken generators.
 */
function generateTempPassword(): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const all = upper + lower + digits;
    // Guarantee at least one uppercase and one digit (both required by passwordSchema)
    const guaranteed =
        upper[Math.floor(Math.random() * upper.length)] +
        digits[Math.floor(Math.random() * digits.length)];
    // Fill remaining 6 chars from the full pool (total length = 8)
    const rest = Array.from({ length: 6 }, () =>
        all[Math.floor(Math.random() * all.length)]
    ).join("");
    // Shuffle so the guaranteed chars are not always at the front
    return (guaranteed + rest)
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");
}


interface ChangeRequest {
    id: string;
    target_id: string;
    target_name: string;
    requested_by: string;
    requested_by_name: string;
    changes: Record<string, string | boolean | undefined>;
    previous_values: Record<string, string | boolean | undefined>;
    reason: string;
    status: "pending" | "approved" | "rejected";
    timestamp: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface AuditLogEntry {
    id: string;
    operator_name?: string;
    performedByName?: string;
    action: string;
    details?: string;
    ip?: string;
    browser?: string;
    device?: string;
    timestamp?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    createdAt?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface CreationForm {
    name: string;
    email: string;
    mobile: string;
    role: string;
    reporting_manager_id: string;
    department: string;
    location: string;
    location_id: string;
    is_active: boolean;
    portal_access: boolean;
    is_locked: boolean;
    designation: string;
    joining_date: string;
    employee_type: "permanent" | "contract" | "intern";
    address: string;
    gender: "male" | "female" | "non-binary" | "prefer-not-to-say";
    emergency_contact: {
        name: string;
        relationship: string;
        mobile: string;
    };
    profile_photo: string;
    status: string;
}

const initialForm = (): CreationForm => ({
    name: "",
    email: "",
    mobile: "",
    role: "employee",
    reporting_manager_id: "",
    department: "",
    location: "",
    location_id: "",
    is_active: true,
    portal_access: true,
    is_locked: false,
    designation: "",
    joining_date: new Date().toISOString().split("T")[0],
    employee_type: "permanent",
    address: "",
    gender: "prefer-not-to-say",
    emergency_contact: {
        name: "",
        relationship: "",
        mobile: "",
    },
    profile_photo: "",
    status: "active"
});

export default function EmployeesDashboard() {
    const { role: currentUserRole, rolesList, hasPermission, user } = useAuth();
    
    // Core data states
    const [users, setUsers] = useState<AppUserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
    const [globalAuditLogs, setGlobalAuditLogs] = useState<AuditLogEntry[]>([]);

    // Employee directory pagination states
    const [usersLimit, setUsersLimit] = useState(50);
    const [hasMoreUsers, setHasMoreUsers] = useState(true);
    const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);

    // Audit logs pagination states
    const [lastAuditDoc, setLastAuditDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [loadingMoreAudit, setLoadingMoreAudit] = useState(false);
    const [hasMoreAudit, setHasMoreAudit] = useState(true);
    const [totalAuditCount, setTotalAuditCount] = useState<number | null>(null);
    
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<AppUserSummary[]>([]);
    
    // UI control states
    const [activeTab, setActiveTab] = useState<"registry" | "orgchart" | "analytics" | "approvals" | "roles" | "audit">("registry");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const sortField: keyof AppUserSummary = "name";
    const sortOrder: "asc" | "desc" = "asc";
    const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Roles and Permissions Tab States
    const [newRoleCode, setNewRoleCode] = useState("");
    const [newRoleName, setNewRoleName] = useState("");
    const [roleCreating, setRoleCreating] = useState(false);
    const [seedingEmployees, setSeedingEmployees] = useState(false);

    // Audit logs filters
    const [isAuditSearching, setIsAuditSearching] = useState(false);
    const [auditSearchResults, setAuditSearchResults] = useState<AuditLogEntry[]>([]);
    
    // Modal controls
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [manualIdOverride, setManualIdOverride] = useState(false);
    const [customEmployeeId, setCustomEmployeeId] = useState("");
    const [wizardStep, setWizardStep] = useState(1);
    const [form, setForm] = useState<CreationForm>(initialForm());
    const [submitting, setSubmitting] = useState(false);
    const [showOffboardModal, setShowOffboardModal] = useState<AppUserSummary | null>(null);
    const [offboardingSubmitting, setOffboardingSubmitting] = useState(false);
    const [exitReason, setExitReason] = useState("");
    const [exitType, setExitType] = useState<"resigned" | "terminated" | "retired" | "contract_ended">("resigned");
    const [exitDate, setExitDate] = useState(new Date().toISOString().split("T")[0]);
    const [confirmOffboardName, setConfirmOffboardName] = useState("");
    const [showReactivateModal, setShowReactivateModal] = useState<AppUserSummary | null>(null);
    
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    
    // Edit Modal states
    const [showEditModal, setShowEditModal] = useState<AppUserSummary | null>(null);
    const [editForm, setEditForm] = useState<Partial<CreationForm>>({});
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editValidationErrors, setEditValidationErrors] = useState<Record<string, string>>({});

    // Password reset modal states
    const [showResetPasswordModal, setShowResetPasswordModal] = useState<AppUserSummary | null>(null);
    const [tempPassword, setTempPassword] = useState("");
    const [resettingPassword, setResettingPassword] = useState(false);

    useEffect(() => {
        if (showOffboardModal) {
            setConfirmOffboardName("");
            setExitReason("");
            setExitType("resigned");
            setExitDate(new Date().toISOString().split("T")[0]);
        }
    }, [showOffboardModal]);

    // Bulk Import states
    const [importing, setImporting] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // 1. Subscribe to users in real time with dynamic limit
    useEffect(() => {
        const fetchTotalUsersCount = async () => {
            try {
                const coll = collection(db, "users");
                const countSnap = await getCountFromServer(coll);
                setTotalUsersCount(countSnap.data().count);
            } catch (err) {
                console.error("Error getting users count:", err);
            }
        };
        fetchTotalUsersCount();
    }, []);

    useEffect(() => {
        const unsub = subscribeToAllUsers((data) => {
            setUsers(data);
            setLoading(false);
            setHasMoreUsers(data.length === usersLimit);
        }, usersLimit);
        return () => unsub();
    }, [usersLimit]);

    // 2. Real-time listener for Change Requests approvals queue
    useEffect(() => {
        if (currentUserRole !== "ceo" && currentUserRole !== "admin") return;
        const unsub = onSnapshot(collection(db, "change_approval_queue"), (snap) => {
            const list = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as ChangeRequest));
            setChangeRequests(list);
        });
        return () => unsub();
    }, [currentUserRole]);

    // 3. Paginated cursor fetching for global audit logs (Tab 6)
    const fetchAuditLogs = async (firstPage = false) => {
        if (currentUserRole !== "ceo" && currentUserRole !== "admin" && currentUserRole !== "hr") return;
        
        if (firstPage) {
            setLoadingAudit(true);
            setGlobalAuditLogs([]);
            setLastAuditDoc(null);
            setHasMoreAudit(true);
            
            // Fetch total count once for this filter (cached)
            try {
                const coll = collection(db, "audit_logs");
                const countQ = query(coll);
                const countSnap = await getCountFromServer(countQ);
                setTotalAuditCount(countSnap.data().count);
            } catch (err) {
                console.error("Error getting audit logs count:", err);
            }
        } else {
            setLoadingMoreAudit(true);
        }

        try {
            const coll = collection(db, "audit_logs");
            let q = query(coll, orderBy("timestamp", "desc"), limit(25));

            if (!firstPage && lastAuditDoc) {
                q = query(q, startAfter(lastAuditDoc));
            }

            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as unknown as AuditLogEntry));

            setGlobalAuditLogs(prev => firstPage ? list : [...prev, ...list]);
            setLastAuditDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
            setHasMoreAudit(snap.docs.length === 25);
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        } finally {
            setLoadingAudit(false);
            setLoadingMoreAudit(false);
        }
    };

    useEffect(() => {
        if (activeTab === "audit") {
            fetchAuditLogs(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Handle clicks outside of dropdown menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpenId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {};
        if (step === 1) {
            if (!form.name || form.name.trim().length < 3) {
                errors.name = "Full Name must be at least 3 characters.";
            }
            if (!form.email) {
                errors.email = "Email is required.";
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
                errors.email = "Please enter a valid email address.";
            } else {
                const dupEmail = users.some(u => u.email?.toLowerCase() === form.email.toLowerCase() && !u.is_deleted);
                if (dupEmail) {
                    errors.email = "This email is already in use by another employee.";
                }
            }
            if (!form.mobile) {
                errors.mobile = "Mobile number is required.";
            } else if (!/^(\+91[-\s]?)?[6-9]\d{9}$/.test(form.mobile.replace(/[\s-]/g, ''))) {
                errors.mobile = "Must be a 10-digit Indian mobile number.";
            }
            if (form.profile_photo && !/^https?:\/\/.+/.test(form.profile_photo)) {
                errors.profile_photo = "Profile Photo must be a valid URL.";
            }
        } else if (step === 2) {
            if (!form.designation || form.designation.trim().length < 2) {
                errors.designation = "Designation is required.";
            }
            if (!form.department || form.department.trim().length < 2) {
                errors.department = "Department is required.";
            }
            if (!form.location || form.location.trim().length < 2) {
                errors.location = "Office location is required.";
            }
            if (!form.joining_date) {
                errors.joining_date = "Joining date is required.";
            }
        } else if (step === 3) {
            if (manualIdOverride) {
                if (!customEmployeeId) {
                    errors.customEmployeeId = "Employee ID override cannot be empty.";
                } else if (!/^EMP-[0-9]{4,6}$/i.test(customEmployeeId)) {
                    errors.customEmployeeId = "Employee ID must follow the format 'EMP-XXXX' (4-6 digits).";
                } else {
                    const dupId = users.some(u => u.employee_id?.toLowerCase() === customEmployeeId.toLowerCase() && !u.is_deleted);
                    if (dupId) {
                        errors.customEmployeeId = "This Employee ID is already assigned to another employee.";
                    }
                }
            }
        }
        setValidationErrors(errors);
        
        const firstErrorKey = Object.keys(errors)[0];
        if (firstErrorKey) {
            setTimeout(() => {
                const element = document.getElementById(`input-${firstErrorKey}`);
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                    element.focus();
                }
            }, 50);
            return false;
        }
        return Object.keys(errors).length === 0;
    };

    const validateField = (fieldName: string, value: string) => {
        let errorMsg = "";
        if (fieldName === "name") {
            if (!value || value.trim().length < 3) {
                errorMsg = "Full Name must be at least 3 characters.";
            }
        } else if (fieldName === "profile_photo") {
            if (value && !/^https?:\/\/.+/.test(value)) {
                errorMsg = "Profile Photo must be a valid URL.";
            }
        } else if (fieldName === "email") {
            if (!value) {
                errorMsg = "Email is required.";
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                errorMsg = "Please enter a valid email address.";
            } else {
                const dupEmail = users.some(u => u.email?.toLowerCase() === value.toLowerCase() && !u.is_deleted);
                if (dupEmail) {
                    errorMsg = "This email is already in use by another employee.";
                }
            }
        } else if (fieldName === "mobile") {
            if (!value) {
                errorMsg = "Mobile number is required.";
            } else if (!/^(\+91[-\s]?)?[6-9]\d{9}$/.test(value.replace(/[\s-]/g, ''))) {
                errorMsg = "Must be a 10-digit Indian mobile number.";
            }
        } else if (fieldName === "designation") {
            if (!value || value.trim().length < 2) {
                errorMsg = "Designation is required.";
            }
        } else if (fieldName === "department") {
            if (!value || value.trim().length < 2) {
                errorMsg = "Department is required.";
            }
        } else if (fieldName === "location") {
            if (!value || value.trim().length < 2) {
                errorMsg = "Office location is required.";
            }
        } else if (fieldName === "joining_date") {
            if (!value) {
                errorMsg = "Joining date is required.";
            }
        } else if (fieldName === "customEmployeeId") {
            if (!value) {
                errorMsg = "Employee ID override cannot be empty.";
            } else if (!/^EMP-[0-9]{4,6}$/i.test(value)) {
                errorMsg = "Employee ID must follow the format 'EMP-XXXX' (4-6 digits).";
            } else {
                const dupId = users.some(u => u.employee_id?.toLowerCase() === value.toLowerCase() && !u.is_deleted);
                if (dupId) {
                    errorMsg = "This Employee ID is already assigned to another employee.";
                }
            }
        }

        setValidationErrors(prev => {
            const nextErrors = { ...prev };
            if (errorMsg) {
                nextErrors[fieldName] = errorMsg;
            } else {
                delete nextErrors[fieldName];
            }
            return nextErrors;
        });
    };

    const isStepValid = (step: number): boolean => {
        if (step === 1) {
            if (!form.name || form.name.trim().length < 3) return false;
            if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return false;
            if (!form.mobile || !/^(\+91[-\s]?)?[6-9]\d{9}$/.test(form.mobile.replace(/[\s-]/g, ''))) return false;
            const dupEmail = users.some(u => u.email?.toLowerCase() === form.email.toLowerCase() && !u.is_deleted);
            if (dupEmail) return false;
            if (form.profile_photo && !/^https?:\/\/.+/.test(form.profile_photo)) return false;
            if (validationErrors.name || validationErrors.email || validationErrors.mobile || validationErrors.profile_photo) return false;
        } else if (step === 2) {
            if (!form.designation || form.designation.trim().length < 2) return false;
            if (!form.department || form.department.trim().length < 2) return false;
            if (!form.location || form.location.trim().length < 2) return false;
            if (!form.joining_date) return false;
            if (validationErrors.designation || validationErrors.department || validationErrors.location || validationErrors.joining_date) return false;
        } else if (step === 3) {
            if (manualIdOverride) {
                if (!customEmployeeId || !/^EMP-[0-9]{4,6}$/i.test(customEmployeeId)) return false;
                const dupId = users.some(u => u.employee_id?.toLowerCase() === customEmployeeId.toLowerCase() && !u.is_deleted);
                if (dupId) return false;
                if (validationErrors.customEmployeeId) return false;
            }
        }
        return true;
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
            showToast("Please resolve all validation errors before onboarding.", "error");
            return;
        }
        setSubmitting(true);
        try {
            const tempPasswordStr = generateTempPassword();
            const generatedEmpId = "EMP-" + Math.floor(1000 + Math.random() * 9000);
            const finalEmployeeId = manualIdOverride && customEmployeeId ? customEmployeeId : generatedEmpId;

            const payload = {
                ...form,
                password: tempPasswordStr,
                employee_id: finalEmployeeId
            };

            // Final Zod client-side validation before API call
            const zodResult = CreateEmployeeSchema.safeParse(payload);
            if (!zodResult.success) {
                const firstError = zodResult.error.issues[0];
                showToast(firstError?.message || "Validation failed. Please check all fields.", "error");
                setSubmitting(false);
                return;
            }

            const response = await authenticatedFetch("/api/admin/create-employee", {
                method: "POST",
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (response.ok && result.success) {
                showToast(`Employee onboarded successfully! Temp Password: ${tempPasswordStr}`, "success");
                await broadcastNotification(
                    "New Employee Onboarded",
                    `${form.name} was added to the directory with ID: ${finalEmployeeId}.`,
                    { type: "record", fromUserName: auth.currentUser?.displayName || "Admin" }
                );
                setShowCreateModal(false);
                setWizardStep(1);
                setForm(initialForm());
                setManualIdOverride(false);
                setCustomEmployeeId("");
            } else {
                throw new Error(result.error || "Failed to create employee");
            }
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleUpdateField = async (uid: string, fieldName: string, newValue: unknown) => {
        try {
            const response = await authenticatedFetch("/api/admin/update-employee", {
                method: "POST",
                body: JSON.stringify({
                    uid,
                    [fieldName]: newValue
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Update failed");
            
            showToast(`Employee updated successfully`, "success");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    const handleToggleStatus = async (uid: string, updates: Record<string, boolean>) => {
        try {
            const response = await authenticatedFetch("/api/admin/toggle-status", {
                method: "POST",
                body: JSON.stringify({
                    uid,
                    ...updates
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Status update failed");
            
            showToast(`Account status updated`, "success");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    const handleEditEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showEditModal) return;
        
        const errors: Record<string, string> = {};
        if (!editForm.name || editForm.name.trim().length < 3) errors.name = "Name must be at least 3 characters.";
        if (!editForm.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) errors.email = "Valid email is required.";
        
        if (editForm.email && editForm.email.toLowerCase() !== showEditModal.email?.toLowerCase()) {
            const dupEmail = users.some(u => u.email?.toLowerCase() === editForm.email?.toLowerCase() && !u.is_deleted);
            if (dupEmail) errors.email = "This email is already in use.";
        }
        
        if (!editForm.mobile || !/^(\+91[-\s]?)?[6-9]\d{9}$/.test(editForm.mobile.replace(/[\s-]/g, ''))) errors.mobile = "Valid 10-digit Indian mobile is required.";
        if (!editForm.department || editForm.department.trim().length < 2) errors.department = "Department is required.";
        if (!editForm.designation || editForm.designation.trim().length < 2) errors.designation = "Designation is required.";
        
        if (Object.keys(errors).length > 0) {
            setEditValidationErrors(errors);
            showToast("Please resolve all validation errors.", "error");
            return;
        }

        setEditValidationErrors({});
        setEditSubmitting(true);
        try {
            const response = await authenticatedFetch("/api/admin/update-employee", {
                method: "POST",
                body: JSON.stringify({
                    uid: showEditModal.uid,
                    ...editForm
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Failed to update employee");

            showToast("Employee profile updated successfully", "success");
            setShowEditModal(null);
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        } finally {
            setEditSubmitting(false);
        }
    };

    const handleOffboardSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showOffboardModal) return;
        if (confirmOffboardName.trim() !== showOffboardModal.name?.trim()) {
            showToast("Confirmation name does not match the employee's name.", "error");
            return;
        }
        setOffboardingSubmitting(true);
        try {
            // Offboarding marks as archived (soft-delete), logs details, and revokes tokens
            const response = await authenticatedFetch("/api/admin/remove-employee", {
                method: "POST",
                body: JSON.stringify({ uid: showOffboardModal.uid })
            });

            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Failed to archive employee");

            // Save offboarding reason metadata in Firestore
            await updateDoc(doc(db, "users", showOffboardModal.uid), {
                exit_details: {
                    exit_date: exitDate,
                    exit_type: exitType,
                    reason: exitReason
                }
            });

            showToast(`${showOffboardModal.name} archived successfully`, "success");
            setShowOffboardModal(null);
            setExitReason("");
            setConfirmOffboardName("");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        } finally {
            setOffboardingSubmitting(false);
        }
    };

    const handleReactivateSubmit = async () => {
        if (!showReactivateModal) return;
        try {
            // Restore endpoint restores is_deleted: false, is_active: true, status: active
            const response = await authenticatedFetch("/api/admin/restore-employee", {
                method: "POST",
                body: JSON.stringify({ uid: showReactivateModal.uid })
            });

            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Failed to restore employee");

            showToast(`${showReactivateModal.name} restored and reactivated successfully.`, "success");
            setShowReactivateModal(null);
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showResetPasswordModal || !tempPassword) return;

        // Zod client-side validation: enforce new password policy (8+ chars, uppercase, number)
        const zodResult = ResetPasswordSchema.safeParse({
            uid: showResetPasswordModal.uid,
            password: tempPassword,
        });
        if (!zodResult.success) {
            showToast(zodResult.error.issues[0]?.message || "Password does not meet requirements.", "error");
            return;
        }

        setResettingPassword(true);
        try {
            const response = await authenticatedFetch("/api/admin/reset-password", {
                method: "POST",
                body: JSON.stringify({
                    uid: showResetPasswordModal.uid,
                    password: tempPassword
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Failed to reset password");

            showToast(`Password successfully reset!`, "success");
            setShowResetPasswordModal(null);
            setTempPassword("");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        } finally {
            setResettingPassword(false);
        }
    };

    const handleSendWelcomeEmail = async (uid: string) => {
        try {
            const response = await authenticatedFetch("/api/admin/send-welcome", {
                method: "POST",
                body: JSON.stringify({ uid })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Failed to send welcome email");

            showToast(`Welcome email queued and dispatched!`, "success");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    // CSV Import Handler
    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportErrors([]);
        setImportSuccessCount(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                interface ImportedEmployee {
                    name: string;
                    email: string;
                    mobile?: string;
                    role?: string;
                    designation?: string;
                    department?: string;
                    employee_id?: string;
                    is_active: boolean;
                    portal_access: boolean;
                    is_locked: boolean;
                }
                const parsedRows = results.data as Record<string, string>[];
                const errors: string[] = [];
                const validEmployees: ImportedEmployee[] = [];

                // Validations loop
                for (let i = 0; i < parsedRows.length; i++) {
                    const row = parsedRows[i];
                    const rowNum = i + 2; // header is row 1
                    
                    const name = row.name || row.Name || row.full_name;
                    const email = row.email || row.Email || row.email_address;
                    const mobile = row.mobile || row.Mobile || row.phone;
                    const role = (row.role || row.Role || "employee").toLowerCase().trim();
                    const designation = row.designation || row.Designation || "";
                    const department = row.department || row.Department || "";
                    const employee_id = row.employee_id || row.EmployeeID || row.employee_id || "";

                    if (!name || !email) {
                        errors.push(`Row ${rowNum}: Name and Email are required.`);
                        continue;
                    }

                    // Check duplicate email in current directory state
                    const emailDup = users.some(u => u.email?.toLowerCase() === email.toLowerCase());
                    const fileEmailDup = validEmployees.some(u => u.email?.toLowerCase() === email.toLowerCase());
                    if (emailDup || fileEmailDup) {
                        errors.push(`Row ${rowNum}: Email "${email}" is a duplicate.`);
                        continue;
                    }

                    // Check duplicate employee ID
                    if (employee_id) {
                        const idDup = users.some(u => u.employee_id?.toLowerCase() === employee_id.toLowerCase());
                        const fileIdDup = validEmployees.some(u => u.employee_id?.toLowerCase() === employee_id.toLowerCase());
                        if (idDup || fileIdDup) {
                            errors.push(`Row ${rowNum}: Employee ID "${employee_id}" is a duplicate.`);
                            continue;
                        }
                    }

                    validEmployees.push({
                        name,
                        email,
                        mobile,
                        role,
                        designation,
                        department,
                        employee_id: employee_id || "EMP-" + Math.floor(1000 + Math.random() * 9000),
                        is_active: true,
                        portal_access: true,
                        is_locked: false,
                    });
                }

                if (errors.length > 0) {
                    setImportErrors(errors);
                    setImporting(false);
                    return;
                }

                // If no errors, commit onboarding sequentially
                let successCount = 0;
                for (const emp of validEmployees) {
                    try {
                        const tempPass = generateTempPassword();
                        const response = await authenticatedFetch("/api/admin/create-employee", {
                            method: "POST",
                            body: JSON.stringify({ ...emp, password: tempPass })
                        });
                        if (response.ok) {
                            successCount++;
                        } else {
                            const errBody = await response.json();
                            errors.push(`Failed to onboard ${emp.name}: ${errBody.error || "Unknown"}`);
                        }
                    } catch (err: unknown) {
                        const error = err as Error;
                        errors.push(`Error onboarding ${emp.name}: ${error.message}`);
                    }
                }

                setImportSuccessCount(successCount);
                if (errors.length > 0) {
                    setImportErrors(errors);
                } else {
                    showToast(`Bulk onboarded ${successCount} employees successfully!`, "success");
                    setShowImportModal(false);
                }
                setImporting(false);
            },
            error: (err) => {
                setImportErrors([`Failed to parse CSV: ${err.message}`]);
                setImporting(false);
            }
        });
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoleCode || !newRoleName) return;
        setRoleCreating(true);
        try {
            const roleId = newRoleCode.toLowerCase().trim().replace(/\s+/g, "_");
            const duplicateRole = rolesList.some(r => r.id === roleId);
            if (duplicateRole) {
                showToast(`Role code "${newRoleCode}" already exists. Please choose a different code.`, "error");
                return;
            }
            const docRef = doc(db, "roles", roleId);
            
            // Create role with empty permissions
            await setDoc(docRef, {
                name: newRoleName,
                is_system: false,
                permissions: {
                    view_employees: true,
                }
            });

            // Log role creation audit
            await authenticatedFetch("/api/auth/log-event", {
                method: "POST",
                body: JSON.stringify({ 
                    action: "role_create",
                    target_id: roleId,
                    target_name: newRoleName,
                    details: `Created new custom role: ${newRoleName} (${roleId})`,
                    before: {},
                    after: { name: newRoleName, is_system: false, permissions: { view_employees: true } }
                })
            }).catch(() => {});

            showToast(`Role "${newRoleName}" successfully created.`, "success");
            setNewRoleCode("");
            setNewRoleName("");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        } finally {
            setRoleCreating(false);
        }
    };

    const handleTogglePermission = async (roleId: string, permissionKey: string, currentValue: boolean) => {
        try {
            const docRef = doc(db, "roles", roleId);
            const roleData = rolesList.find(r => r.id === roleId);
            if (!roleData) return;

            const updatedPermissions = {
                ...roleData.permissions,
                [permissionKey]: !currentValue
            };

            await updateDoc(docRef, {
                permissions: updatedPermissions
            });

            // Log permission update audit
            await authenticatedFetch("/api/auth/log-event", {
                method: "POST",
                body: JSON.stringify({
                    action: "permission_change",
                    target_id: roleId,
                    target_name: roleData.name || roleId,
                    details: `Updated permission '${permissionKey}' for role '${roleData.name || roleId}' to ${!currentValue}`,
                    before: { [permissionKey]: currentValue },
                    after: { [permissionKey]: !currentValue }
                })
            }).catch(() => {});

            showToast("Role permission matrix updated successfully.", "success");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    const handleSeedMockEmployees = async () => {
        if (!confirm("Are you sure you want to seed 30 mock employees into the directory? This will execute client-side API requests to populate the directory.")) return;
        setSeedingEmployees(true);
        try {
            const departmentsList = ["Engineering", "HR", "Sales", "Finance", "Operations", "Marketing"];
            const designationsList: Record<string, string> = {
                super_admin: "System Administrator",
                hr_admin: "HR Director",
                hr_executive: "Talent Acquisition Specialist",
                manager: "Engineering Manager",
                team_lead: "Tech Lead",
                employee: "Software Engineer",
                viewer: "Read-Only Auditor"
            };

            const locationsList = ["San Francisco, CA", "London, UK", "Noida, IN", "Singapore"];
            const fNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Elizabeth", "William", "Linda", 
                            "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen",
                            "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra"];
            const lNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                            "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

            const ceoId = auth.currentUser?.uid || "ceo";

            const createdSuperAdmins: string[] = [];
            const createdHrAdmins: string[] = [];
            const createdManagers: string[] = [];
            const createdHrExecutives: string[] = [];
            const createdTeamLeads: string[] = [];
            let employeeCount = 0;

            const helperCreateEmployee = async (roleRand: string, index: number, managerId: string): Promise<string | null> => {
                const fName = fNames[index - 1] || "User";
                const lName = lNames[index % lNames.length];
                const name = `${fName} ${lName}`;
                const email = `${fName.toLowerCase()}.${lName.toLowerCase()}@avenir.com`;
                
                let dept = departmentsList[index % departmentsList.length];
                if (roleRand.startsWith("hr")) dept = "HR";
                if (roleRand === "super_admin") dept = "IT Operations";
                
                const desig = designationsList[roleRand];
                const empId = `EMP-${1000 + index}`;
                const tempPass = "AvenirMock123!";

                const payload = {
                    email,
                    password: tempPass,
                    name,
                    mobile: `+91 98765${index.toString().padStart(5, '0')}`,
                    role: roleRand,
                    reporting_manager_id: managerId,
                    department: dept,
                    location: locationsList[index % locationsList.length],
                    location_id: `loc_${index % 4}`,
                    employee_id: empId,
                    is_active: true,
                    portal_access: true,
                    is_locked: false,
                    designation: desig,
                    joining_date: `2025-0${(index % 9) + 1}-10`,
                    employee_type: index % 10 === 0 ? "contract" : "permanent",
                    address: `12${index} Corporate Blvd, Suite ${index * 10}`,
                    emergency_contact: {
                        name: `Emergency Contact ${index}`,
                        relationship: index % 3 === 0 ? "Spouse" : "Parent",
                        mobile: `+91 98765${index.toString().padStart(5, '0')}`
                    },
                    profile_photo: `https://images.unsplash.com/photo-${1500000000000 + index * 1000}?w=150&h=150&fit=crop&crop=face`,
                    gender: index % 2 === 0 ? "male" : "female",
                    status: "active"
                };

                const response = await authenticatedFetch("/api/admin/create-employee", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    return result.uid;
                }
                return null;
            };

            for (let i = 1; i <= 2; i++) {
                const uid = await helperCreateEmployee("super_admin", i, ceoId);
                if (uid) createdSuperAdmins.push(uid);
            }

            for (let i = 3; i <= 4; i++) {
                const uid = await helperCreateEmployee("hr_admin", i, ceoId);
                if (uid) createdHrAdmins.push(uid);
            }

            for (let i = 5; i <= 9; i++) {
                const uid = await helperCreateEmployee("manager", i, ceoId);
                if (uid) createdManagers.push(uid);
            }

            const hrAdminId = createdHrAdmins[0] || ceoId;
            for (let i = 10; i <= 12; i++) {
                const uid = await helperCreateEmployee("hr_executive", i, hrAdminId);
                if (uid) createdHrExecutives.push(uid);
            }

            for (let i = 13; i <= 17; i++) {
                const mgrId = createdManagers[(i - 13) % createdManagers.length] || ceoId;
                const uid = await helperCreateEmployee("team_lead", i, mgrId);
                if (uid) createdTeamLeads.push(uid);
            }

            for (let i = 18; i <= 28; i++) {
                const tlId = createdTeamLeads[(i - 18) % createdTeamLeads.length] || ceoId;
                const uid = await helperCreateEmployee("employee", i, tlId);
                if (uid) employeeCount++;
            }

            for (let i = 29; i <= 30; i++) {
                await helperCreateEmployee("viewer", i, ceoId);
            }

            const totalCreated = createdSuperAdmins.length + createdHrAdmins.length + createdManagers.length + 
                                 createdHrExecutives.length + createdTeamLeads.length + employeeCount + 2;

            showToast(`Successfully seeded ${totalCreated} simulation employee records with full organizational hierarchy!`, "success");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(`Seeding failed: ${err.message}`, "error");
        } finally {
            setSeedingEmployees(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm("Are you sure you want to delete this role? Any employees assigned to it will default to Employee access.")) return;
        try {
            const roleData = rolesList.find(r => r.id === roleId);
            const roleName = roleData?.name || roleId;
            await deleteDoc(doc(db, "roles", roleId));

            // Log role deletion audit
            await authenticatedFetch("/api/auth/log-event", {
                method: "POST",
                body: JSON.stringify({
                    action: "update",
                    target_id: roleId,
                    target_name: roleName,
                    details: `Deleted custom role: ${roleName} (${roleId})`
                })
            }).catch(() => {});

            showToast("Custom role successfully deleted.", "success");
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    const handleApproveChange = async (reqId: string) => {
        try {
            const note = prompt("Enter review approval notes (optional):") || "";
            const response = await authenticatedFetch("/api/admin/approve-change", {
                method: "POST",
                body: JSON.stringify({ requestId: reqId, action: "approve", review_note: note })
            });
            const result = await response.json();
            if (response.ok) {
                showToast("Change request approved and profile updated.", "success");
            } else {
                throw new Error(result.error);
            }
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    const handleRejectChange = async (reqId: string) => {
        try {
            const note = prompt("Enter reason for rejection:") || "";
            if (!note) {
                showToast("Rejection notes are required", "error");
                return;
            }
            const response = await authenticatedFetch("/api/admin/approve-change", {
                method: "POST",
                body: JSON.stringify({ requestId: reqId, action: "reject", review_note: note })
            });
            const result = await response.json();
            if (response.ok) {
                showToast("Change request rejected successfully.", "success");
            } else {
                throw new Error(result.error);
            }
        } catch (error: unknown) {
            const err = error as Error;
            showToast(err.message, "error");
        }
    };

    const handleExportCSV = () => {
        const headers = ["Employee ID", "Name", "Email", "Mobile", "Role", "Department", "Designation", "Joining Date", "Type", "Status", "Portal Access", "Locked"];
        const rows = sortedUsers.map(u => [
            u.employee_id || "",
            u.name || "",
            u.email || "",
            u.mobile || "",
            u.role || "",
            u.department || "",
            u.designation || "",
            u.joining_date || "",
            u.employee_type || "",
            u.status || "",
            u.portal_access !== false ? "Enabled" : "Disabled",
            u.is_locked ? "Yes" : "No"
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `employee_directory_export_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const managers = users.filter(u => u.role === "manager" || u.role === "admin" || u.role === "ceo" || u.role === "super_admin");


    // Dashboard metrics (excludes soft-deleted employees for Total, Active)
    const activeNonDeletedUsers = users.filter(u => !u.is_deleted);
    const totalEmployees = activeNonDeletedUsers.length;
    const activeEmployees = activeNonDeletedUsers.filter(u => u.is_active && !u.is_locked).length;
    const inactiveEmployees = activeNonDeletedUsers.filter(u => !u.is_active || u.is_locked).length;
    const uniqueDepartments = new Set(activeNonDeletedUsers.filter(u => u.department).map(u => u.department?.trim().toLowerCase())).size;

    // Filter Logic
    const filteredUsers = isSearching ? searchResults : users.filter(u => !u.is_deleted);

    // Sorting Logic
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (valA === undefined) valA = "";
        if (valB === undefined) valB = "";
        
        if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
    });

    // Pagination Logic
    const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
    const paginatedUsers = sortedUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Growth analytics helper
    const getGrowthData = () => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const counts: { [key: string]: number } = {};
        activeNonDeletedUsers.forEach(u => {
            if (u.joining_date) {
                const date = new Date(u.joining_date);
                if (!isNaN(date.getTime())) {
                    const label = `${months[date.getMonth()]} ${date.getFullYear()}`;
                    counts[label] = (counts[label] || 0) + 1;
                }
            }
        });
        const items = Object.entries(counts).map(([label, count]) => ({ label, count }));
        return items.slice(-6); // last 6 months
    };

    // Department Distribution helper
    const getDeptData = () => {
        const counts: { [key: string]: number } = {};
        activeNonDeletedUsers.forEach(u => {
            if (u.department) {
                const key = u.department.trim();
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([dept, val]) => ({ dept, val }));
    };

    // Gender Distribution helper
    const getGenderData = () => {
        const counts = { male: 0, female: 0, other: 0 };
        activeNonDeletedUsers.forEach(u => {
            if (u.gender === "male") counts.male++;
            else if (u.gender === "female") counts.female++;
            else counts.other++;
        });
        return counts;
    };

    // Visual Org Chart direct reports lookup
    const [selectedManagerId, setSelectedManagerId] = useState<string>("");
    const activeManagerObj = users.find(u => u.uid === selectedManagerId) || users.find(u => u.role === "ceo" || u.role === "super_admin") || users[0];
    const directReports = activeManagerObj ? users.filter(u => u.reporting_manager_id === activeManagerObj.uid && !u.is_deleted) : [];

    // Filter audit logs
    const filteredAuditLogs = isAuditSearching ? auditSearchResults : globalAuditLogs;

    const rolesAvailable = rolesList.map(r => r.id);

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            </div>
        );
    }

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

            {/* Title & Core Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <Users className="h-8 w-8 text-indigo-600" />
                        Directory Workspace
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage portal access, roles, departments, organization charts, and security audits.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {hasPermission("export_data") && (
                        <button 
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-all"
                        >
                            <Download className="h-4 w-4" />
                            Export Directory
                        </button>
                    )}
                    {hasPermission("import_data") && (
                        <button 
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-all"
                        >
                            <Upload className="h-4 w-4" />
                            Bulk Import
                        </button>
                    )}
                    {hasPermission("add_employees") && (
                        <button
                            onClick={() => { setShowCreateModal(true); setWizardStep(1); setValidationErrors({}); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                        >
                            <UserPlus className="h-4 w-4" />
                            Add Employee
                        </button>
                    )}
                </div>
            </div>

            {/* Interactive Workspace Tab Toggles */}
            <div className="bg-slate-100 dark:bg-slate-800/40 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-200/50 dark:border-slate-800/60 shadow-inner">
                <button 
                    onClick={() => setActiveTab("registry")} 
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "registry" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                >
                    <LayoutGrid className="h-4 w-4" />
                    Directory Registry
                </button>
                <button 
                    onClick={() => setActiveTab("orgchart")} 
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "orgchart" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                >
                    <GitFork className="h-4 w-4" />
                    Org Chart
                </button>
                <button 
                    onClick={() => setActiveTab("analytics")} 
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "analytics" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                >
                    <BarChart2 className="h-4 w-4" />
                    Dashboard Analytics
                </button>
                {hasPermission("approve_leave") && (
                    <button 
                        onClick={() => setActiveTab("approvals")} 
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 relative ${activeTab === "approvals" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                    >
                        <ClipboardCheck className="h-4 w-4" />
                        Approvals Queue
                        {changeRequests.filter(r => r.status === 'pending').length > 0 && (
                            <span className="absolute top-2 right-2 h-4 min-w-[16px] px-1 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                {changeRequests.filter(r => r.status === 'pending').length}
                            </span>
                        )}
                    </button>
                )}
                {hasPermission("manage_settings") && (
                    <button 
                        onClick={() => setActiveTab("roles")} 
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "roles" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                    >
                        <Shield className="h-4 w-4" />
                        Roles Matrix
                    </button>
                )}
                {(currentUserRole === "ceo" || currentUserRole === "admin" || currentUserRole === "super_admin" || currentUserRole === "hr") && (
                    <button 
                        onClick={() => setActiveTab("audit")} 
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "audit" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                    >
                        <FileText className="h-4 w-4" />
                        Audit Trail
                    </button>
                )}
            </div>

            {/* TAB 1: EMPLOYEE REGISTRY TABLE */}
            {activeTab === "registry" && (
                <div className="space-y-6">
                    {/* Metric Cards Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Directory</span>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{totalEmployees}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Staff</span>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{activeEmployees}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                <Lock className="h-6 w-6" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Inactive / Locked</span>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{inactiveEmployees}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Departments</span>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{uniqueDepartments}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Filter and Search Box */}
                    <div className="mb-4 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Directory Options</h2>
                            <ExportMenu 
                                data={paginatedUsers.map(u => ({
                                    ...u,
                                    joining_date: typeof u.joining_date === 'string' ? u.joining_date : ((u.joining_date as unknown as { toDate(): Date } | null)?.toDate?.()?.toLocaleDateString() ?? "N/A"),
                                    last_login: typeof (u as unknown as Record<string, unknown>).last_login === 'string' ? String((u as unknown as Record<string, unknown>).last_login) : (((u as unknown as Record<string, unknown>).last_login as unknown as { toDate(): Date } | null)?.toDate?.()?.toLocaleString() ?? "N/A")
                                })) as Record<string, unknown>[]} 
                                columns={[
                                    { key: "name", header: "Name" },
                                    { key: "employee_id", header: "Employee ID" },
                                    { key: "email", header: "Email" },
                                    { key: "department", header: "Department" },
                                    { key: "role", header: "Role" },
                                    { key: "status", header: "Status" },
                                    { key: "employee_type", header: "Employee Type" },
                                    { key: "joining_date", header: "Joining Date" },
                                    { key: "mobile", header: "Mobile" },
                                    { key: "last_login", header: "Last Login" }
                                ]}
                                metadata={{
                                    module: "employees",
                                    appliedFilters: isSearching ? "Custom Search" : "All (Directory)",
                                    correlationId: crypto.randomUUID(),
                                    performedBy: user?.uid || "unknown",
                                    performedByName: user?.displayName || user?.email || "Unknown"
                                }}
                                disabled={paginatedUsers.length === 0}
                            />
                        </div>
                        <EmployeeSearchPanel 
                            onSearch={async (params) => {
                                // Default params check - fallback to realtime directory
                                if (!params.query && params.role === "all" && params.status === "all" && params.department === "all" && params.employeeType === "all" && params.portalAccess === "all") {
                                    setIsSearching(false);
                                    setSearchResults([]);
                                    return;
                                }
                                setIsSearching(true);
                                try {
                                    // Fetch up to 500 results for client-side pagination
                                    const result = await searchEmployees(params, 500);
                                    setSearchResults(result.items);
                                    setCurrentPage(1); // Reset to first page on new search
                                } catch (error) {
                                    console.error("Employee search failed:", error);
                                }
                            }} 
                        />
                    </div>

                    {/* Table View */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Job Info</th>
                                        <th className="px-6 py-4">Status & Locks</th>
                                        <th className="px-6 py-4">Portal Access</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                                                No employee profiles matching the active filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedUsers.map(u => (
                                            <tr key={u.uid} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {u.profile_photo ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={u.profile_photo} alt={u.name || ""} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/10" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                                                {u.name?.charAt(0) || "U"}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <Link href={`/dashboard/employees/${u.uid}`} className="text-xs font-black text-slate-900 dark:text-white hover:text-indigo-500 transition-colors block">
                                                                {u.name}
                                                            </Link>
                                                            <span className="text-[10px] text-slate-400 font-bold">{u.employee_id || "NO-ID"} &bull; {u.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-0.5">
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize block">{u.designation || "Specialist"}</span>
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                                            <Shield className="h-3 w-3" />
                                                            {u.role}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 block">{u.department || "N/A"} &bull; {u.employee_type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        {u.is_deleted ? (
                                                            <span className="inline-flex items-center justify-center w-24 py-1 rounded-full text-[9px] font-black uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">Archived</span>
                                                        ) : (
                                                            <>
                                                                <span className={`inline-flex items-center justify-center w-24 py-1 rounded-full text-[9px] font-black uppercase border ${u.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                                                    {u.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                                {u.is_locked && (
                                                                    <span className="inline-flex items-center justify-center w-24 py-1 rounded-full text-[9px] font-black uppercase bg-red-500/10 text-red-500 border border-red-500/20">Suspended</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {!u.is_deleted ? (
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer" 
                                                                checked={u.portal_access !== false} 
                                                                onChange={(e) => handleToggleStatus(u.uid, { portal_access: e.target.checked })} 
                                                            />
                                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                        </label>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 font-bold">Locked</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {u.is_deleted ? (
                                                            <button
                                                                onClick={() => { setShowReactivateModal(u); }}
                                                                className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-all flex items-center gap-1.5 text-[10px] font-bold"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                                Restore Record
                                                            </button>
                                                        ) : (
                                                            <div className="relative inline-block text-left">
                                                                <button 
                                                                    onClick={() => setDropdownOpenId(dropdownOpenId === u.uid ? null : u.uid)}
                                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                                                >
                                                                    <MoreVertical className="h-4 w-4 text-slate-500" />
                                                                </button>
                                                                
                                                                {dropdownOpenId === u.uid && (
                                                                    <div ref={dropdownRef} className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-950 shadow-2xl border border-slate-100 dark:border-slate-850 py-2 z-30 transform scale-95 duration-200">
                                                                        <button 
                                                                            onClick={() => handleToggleStatus(u.uid, { is_active: !u.is_active })}
                                                                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                        >
                                                                            {u.is_active ? <X className="h-4 w-4 text-amber-500" /> : <Check className="h-4 w-4 text-emerald-500" />}
                                                                            {u.is_active ? "Deactivate Account" : "Activate Account"}
                                                                        </button>
                                                                        
                                                                        <button 
                                                                            onClick={() => handleToggleStatus(u.uid, { is_locked: !u.is_locked })}
                                                                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                        >
                                                                            {u.is_locked ? <Unlock className="h-4 w-4 text-indigo-500" /> : <Lock className="h-4 w-4 text-red-500" />}
                                                                            {u.is_locked ? "Unlock Session" : "Lock / Suspend"}
                                                                        </button>

                                                                        <button 
                                                                            onClick={() => {
                                                                                setEditForm({
                                                                                    name: u.name || "",
                                                                                    email: u.email || "",
                                                                                    mobile: u.mobile || "",
                                                                                    role: u.role || "employee",
                                                                                    department: u.department || "",
                                                                                    designation: u.designation || "",
                                                                                    location: u.location || "",
                                                                                    employee_type: u.employee_type as "permanent" | "contract" | "intern" | undefined,
                                                                                });
                                                                                setShowEditModal(u);
                                                                                setDropdownOpenId(null);
                                                                            }}
                                                                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                        >
                                                                            <FileText className="h-4 w-4 text-indigo-600" />
                                                                            Edit Profile Details
                                                                        </button>

                                                                        <button 
                                                                            onClick={() => { setShowResetPasswordModal(u); setDropdownOpenId(null); }}
                                                                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                        >
                                                                            <KeyRound className="h-4 w-4 text-indigo-600" />
                                                                            Reset Password
                                                                        </button>

                                                                        <button 
                                                                            onClick={() => handleSendWelcomeEmail(u.uid)}
                                                                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                        >
                                                                            <Mail className="h-4 w-4 text-indigo-600" />
                                                                            Send Welcome Email
                                                                        </button>

                                                                        <div className="h-px bg-slate-100 dark:bg-slate-850 my-1" />

                                                                        <button 
                                                                            onClick={() => { setShowOffboardModal(u); setDropdownOpenId(null); }}
                                                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                            Archive & Remove
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 dark:bg-slate-800/5 gap-4">
                            <span className="text-xs text-slate-400 font-bold">
                                Showing {filteredUsers.length} of {totalUsersCount ?? "..."} employees
                                {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                            </span>
                            <div className="flex items-center gap-3">
                                {totalPages > 1 && (
                                    <div className="flex gap-2">
                                        <button 
                                            disabled={currentPage === 1} 
                                            onClick={() => setCurrentPage(c => c - 1)}
                                            className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:bg-slate-50"
                                        >
                                            Prev
                                        </button>
                                        <button 
                                            disabled={currentPage === totalPages} 
                                            onClick={() => setCurrentPage(c => c + 1)}
                                            className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:bg-slate-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                                {hasMoreUsers && (
                                    <button 
                                        onClick={() => setUsersLimit(prev => prev + 50)}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                    >
                                        Load More
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ORGANISATION CHART */}
            {activeTab === "orgchart" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-8">
                    <div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">Reporting structure visualizer</h3>
                        <p className="text-xs text-slate-500">Illustrating active supervisor-subordinate reporting hierarchies.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 max-w-md">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Node Manager:</label>
                        <select 
                            value={selectedManagerId} 
                            onChange={e => setSelectedManagerId(e.target.value)}
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-350 focus:outline-none"
                        >
                            <option value="">Top Level (CEO/Super Admin)</option>
                            {managers.map(m => <option key={m.uid} value={m.uid}>{m.name} ({m.designation})</option>)}
                        </select>
                    </div>

                    {/* Chart visual representation */}
                    <div className="flex flex-col items-center py-6 space-y-8">
                        {/* Parent Node */}
                        {activeManagerObj && (
                            <div className="flex flex-col items-center">
                                <div className="p-5 rounded-2xl bg-indigo-600 text-white text-center shadow-xl shadow-indigo-600/10 min-w-[200px]">
                                    <h4 className="font-black text-sm">{activeManagerObj.name}</h4>
                                    <span className="text-[9px] uppercase tracking-wider block font-bold text-indigo-200 mt-1">{activeManagerObj.designation}</span>
                                    <span className="text-[9px] block text-indigo-300 font-medium">{activeManagerObj.department} &bull; ID: {activeManagerObj.employee_id}</span>
                                </div>
                                <div className="w-0.5 h-8 bg-indigo-200 dark:bg-slate-800" />
                            </div>
                        )}

                        {/* Child Nodes */}
                        {directReports.length === 0 ? (
                            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm text-xs font-bold text-slate-400">
                                No direct subordinate reports found mapped to this node manager.
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Horizontal Connector */}
                                {directReports.length > 1 && (
                                    <div className="absolute top-0 left-[10%] right-[10%] h-0.5 bg-indigo-200 dark:bg-slate-800" />
                                )}
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pt-6">
                                    {directReports.map((report) => (
                                        <div key={report.uid} className="flex flex-col items-center relative">
                                            {/* Vertical connector to horizontal line */}
                                            <div className="absolute -top-6 w-0.5 h-6 bg-indigo-200 dark:bg-slate-800" />
                                            
                                            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-center min-w-[180px] shadow-sm hover:border-indigo-400 hover:shadow-md transition-all">
                                                <h5 className="font-black text-xs text-slate-800 dark:text-slate-100">{report.name}</h5>
                                                <span className="text-[8px] uppercase tracking-wider block font-bold text-indigo-500 mt-0.5">{report.designation}</span>
                                                <span className="text-[8px] block text-slate-400 font-medium">{report.department}</span>
                                                
                                                {/* If this subordinate is also a manager, provide a quick explore button */}
                                                {managers.some(m => m.uid === report.uid) && (
                                                    <button 
                                                        onClick={() => setSelectedManagerId(report.uid)}
                                                        className="mt-2 text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:underline"
                                                    >
                                                        Explore Node &rarr;
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: HRMS DASHBOARD ANALYTICS */}
            {activeTab === "analytics" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SVG Column Chart: Department distribution */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-950 dark:text-white">Department Headcounts</h3>
                            <p className="text-xs text-slate-500">Distribution of active personnel records across major departments.</p>
                        </div>
                        
                        <div className="h-[250px] w-full flex items-end justify-between px-4 pt-10 border-b border-l border-slate-100 dark:border-slate-800">
                            {getDeptData().length === 0 ? (
                                <div className="w-full text-center py-12 text-sm text-slate-400 font-bold">No department headcounts available.</div>
                            ) : (
                                getDeptData().map(({ dept, val }) => {
                                    const maxVal = Math.max(...getDeptData().map(d => d.val)) || 1;
                                    const percentageHeight = (val / maxVal) * 80; // scale bars to 80% container height
                                    return (
                                        <div key={dept} className="flex flex-col items-center flex-1 group relative">
                                            {/* Tooltip */}
                                            <span className="absolute bottom-[calc(100%+8px)] opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg transition-opacity duration-200">
                                                {val} Staff
                                            </span>
                                            {/* Bar */}
                                            <div 
                                                style={{ height: `${percentageHeight}%` }} 
                                                className="w-10 sm:w-16 bg-indigo-500/20 group-hover:bg-indigo-600/30 rounded-t-lg border border-indigo-500/30 transition-all flex items-end justify-center pb-2"
                                            >
                                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{val}</span>
                                            </div>
                                            {/* Label */}
                                            <span className="text-[9px] font-bold text-slate-400 mt-2 truncate w-14 text-center block" title={dept}>{dept}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* SVG Pie Chart: Gender Demographics */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-950 dark:text-white">Gender Demographics</h3>
                            <p className="text-xs text-slate-500">Gender distribution of registered staff.</p>
                        </div>

                        <div className="flex flex-col items-center space-y-6">
                            {/* SVG Stacked Bar representation */}
                            <div className="w-full h-8 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden flex shadow-inner">
                                {(() => {
                                    const { male, female, other } = getGenderData();
                                    const total = (male + female + other) || 1;
                                    const pMale = (male / total) * 100;
                                    const pFemale = (female / total) * 100;
                                    const pOther = (other / total) * 100;
                                    return (
                                        <>
                                            {male > 0 && <div style={{ width: `${pMale}%` }} className="bg-indigo-500 hover:bg-indigo-600 transition-colors" title={`Male: ${male}`} />}
                                            {female > 0 && <div style={{ width: `${pFemale}%` }} className="bg-rose-400 hover:bg-rose-500 transition-colors" title={`Female: ${female}`} />}
                                            {other > 0 && <div style={{ width: `${pOther}%` }} className="bg-slate-400 hover:bg-slate-500 transition-colors" title={`Other: ${other}`} />}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Legend labels */}
                            <div className="w-full space-y-3 font-semibold text-xs text-slate-600 dark:text-slate-300">
                                {(() => {
                                    const { male, female, other } = getGenderData();
                                    return (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full bg-indigo-500 block" />
                                                    <span>Male</span>
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-white">{male} ({Math.round((male / (male + female + other || 1)) * 100)}%)</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full bg-rose-400 block" />
                                                    <span>Female</span>
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-white">{female} ({Math.round((female / (male + female + other || 1)) * 100)}%)</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full bg-slate-400 block" />
                                                    <span>Other / Prefer not to say</span>
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-white">{other} ({Math.round((other / (male + female + other || 1)) * 100)}%)</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* 6-Month Hiring Trends */}
                    <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-950 dark:text-white">Directory Growth (Hiring Trend)</h3>
                            <p className="text-xs text-slate-500">Aggregated hiring volumes over the past 6 months.</p>
                        </div>

                        <div className="h-[180px] w-full flex items-end justify-between px-4 pt-10 border-b border-slate-100 dark:border-slate-800 relative">
                            {getGrowthData().length === 0 ? (
                                <div className="w-full text-center py-12 text-sm text-slate-400 font-bold">No hiring data logged.</div>
                            ) : (
                                getGrowthData().map(({ label, count }) => {
                                    const maxCount = Math.max(...getGrowthData().map(d => d.count)) || 1;
                                    const percentageHeight = (count / maxCount) * 75;
                                    return (
                                        <div key={label} className="flex flex-col items-center flex-1 group relative">
                                            <span className="absolute bottom-[calc(100%+8px)] opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg transition-opacity duration-200">
                                                +{count} Onboardings
                                            </span>
                                            {/* Line/bar hybrid connector */}
                                            <div 
                                                style={{ height: `${percentageHeight}%` }} 
                                                className="w-1.5 bg-indigo-500 dark:bg-indigo-400/80 rounded-t group-hover:bg-indigo-600 transition-all"
                                            />
                                            {/* Dot */}
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-600 shadow-md -mt-1.5" />
                                            {/* Label */}
                                            <span className="text-[9px] font-bold text-slate-400 mt-2 block">{label}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: CHANGE REQUESTS APPROVALS QUEUE */}
            {activeTab === "approvals" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">Profile revisions queue</h3>
                        <p className="text-xs text-slate-500">Pending changes queued by HR operators requiring CEO or Admin authorization.</p>
                    </div>

                    <div className="space-y-4">
                        {changeRequests.filter(r => r.status === 'pending').length === 0 ? (
                            <div className="p-8 text-center text-sm font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-800/5 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                Zero pending changes revisions logged in the queue.
                            </div>
                        ) : (
                            changeRequests.filter(r => r.status === 'pending').map(req => (
                                <div key={req.id} className="p-6 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-800/80 rounded-2xl space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                        <div>
                                            <span className="text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 px-2 py-0.5 rounded-full">Request Code: {req.id.slice(0, 8)}</span>
                                            <h4 className="font-black text-sm mt-1 text-slate-800 dark:text-slate-100">Revision for: <span className="text-indigo-600 dark:text-indigo-400">{req.target_name}</span></h4>
                                        </div>
                                        <div className="text-right text-[10px] text-slate-400 font-semibold">
                                            <span>Requested by: {req.requested_by_name}</span>
                                            <span className="block mt-0.5">
                                                {req.timestamp && typeof req.timestamp === 'object' && 'toDate' in req.timestamp
                                                    ? (req.timestamp as { toDate: () => Date }).toDate().toLocaleString()
                                                    : (req.timestamp ? new Date(req.timestamp as string | number | Date).toLocaleString() : "N/A")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Diffs Table */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-rose-950/5 border border-rose-100 dark:border-rose-950/20 space-y-2">
                                            <span className="text-[10px] text-rose-500 font-black uppercase">Previous values</span>
                                            <div className="space-y-1 font-semibold text-slate-700 dark:text-slate-300">
                                                {Object.entries(req.previous_values || {}).map(([k, val]) => (
                                                    <div key={k} className="flex justify-between">
                                                        <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                                                        <span className="font-bold line-through text-slate-400">{String(val || 'N/A')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/5 border border-emerald-100 dark:border-emerald-950/20 space-y-2">
                                            <span className="text-[10px] text-emerald-500 font-black uppercase">Proposed values</span>
                                            <div className="space-y-1 font-semibold text-slate-700 dark:text-slate-300">
                                                {Object.entries(req.changes || {}).map(([k, val]) => (
                                                    <div key={k} className="flex justify-between">
                                                        <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{String(val || 'N/A')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reasons & Actions */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs">
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Change Justification</span>
                                            <p className="font-medium text-slate-650 dark:text-slate-300 mt-0.5">{req.reason}</p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleRejectChange(req.id)}
                                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/25 dark:hover:bg-rose-955 text-rose-600 dark:text-rose-450 text-xs font-bold rounded-xl transition-all"
                                            >
                                                Reject Change
                                            </button>
                                            <button 
                                                onClick={() => handleApproveChange(req.id)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10"
                                            >
                                                Authorize Approval
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 5: ROLES & PERMISSIONS MATRIX */}
            {activeTab === "roles" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-950 dark:text-white">Role Permission Configuration Matrix</h3>
                            <p className="text-xs text-slate-500">Configure access permissions across standard and custom directory roles without code changes.</p>
                        </div>
                        <div className="flex gap-3 items-center flex-wrap">
                            {(currentUserRole === "ceo" || currentUserRole === "admin") && (
                                <button
                                    onClick={handleSeedMockEmployees}
                                    disabled={seedingEmployees}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/10 flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {seedingEmployees ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Seeding...
                                        </>
                                    ) : (
                                        <>
                                            <GitFork className="h-3.5 w-3.5" />
                                            Seed 30 Employees
                                        </>
                                    )}
                                </button>
                            )}
                            <form onSubmit={handleCreateRole} className="flex gap-2 items-center">
                                <input 
                                    placeholder="Role ID (e.g. sales)" 
                                    value={newRoleCode} 
                                    onChange={e => setNewRoleCode(e.target.value)} 
                                    className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium" 
                                    required
                                />
                                <input 
                                    placeholder="Role Name (e.g. Sales Executive)" 
                                    value={newRoleName} 
                                    onChange={e => setNewRoleName(e.target.value)} 
                                    className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium" 
                                    required
                                />
                                <button 
                                    type="submit" 
                                    disabled={roleCreating}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                                >
                                    {roleCreating ? "Adding..." : "Add Role"}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <th className="px-6 py-4">Permission Action</th>
                                    {rolesList.map(r => (
                                        <th key={r.id} className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-black text-slate-850 dark:text-white">{r.name}</span>
                                                <span className="text-[7px] text-slate-400 font-bold tracking-wider mt-0.5">{r.id}</span>
                                                {!r.is_system && (
                                                    <button 
                                                        onClick={() => handleDeleteRole(r.id)} 
                                                        className="text-[8px] text-rose-500 font-black uppercase hover:underline mt-1"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                                {[
                                    { key: "view_employees", label: "View Employees Directory" },
                                    { key: "add_employees", label: "Onboard New Employees" },
                                    { key: "edit_employees", label: "Edit Profile Details" },
                                    { key: "delete_employees", label: "Soft Delete & Restore Records" },
                                    { key: "export_data", label: "Export Directory CSV/Excel" },
                                    { key: "import_data", label: "Bulk Import CSV files" },
                                    { key: "view_salary", label: "View Employee Salary" },
                                    { key: "manage_payroll", label: "Manage Employee Payroll" },
                                    { key: "approve_leave", label: "Approve / Reject Leave Requests" },
                                    { key: "manage_attendance", label: "Manage Attendance Registers" },
                                    { key: "manage_teams", label: "Manage Team Assignments" },
                                    { key: "manage_projects", label: "Manage Project Alignments" },
                                    { key: "manage_settings", label: "Configure Access Settings" }
                                ].map(p => (
                                    <tr key={p.key} className="hover:bg-slate-50/20 transition-colors">
                                        <td className="px-6 py-3 font-bold text-slate-900 dark:text-white">{p.label}</td>
                                        {rolesList.map(r => {
                                            const hasAccess = !!r.permissions[p.key];
                                            const isC = r.id.toLowerCase() === "ceo";
                                            return (
                                                <td key={r.id} className="px-6 py-3 text-center">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isC || hasAccess}
                                                        disabled={isC || r.id === "super_admin" && p.key === "manage_settings"} // super admin always manages settings
                                                        onChange={() => handleTogglePermission(r.id, p.key, hasAccess)}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 disabled:opacity-50"
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 6: SEARCHABLE AUDIT TRAIL LOGS */}
            {activeTab === "audit" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">Security & Audit Logs Ledger</h3>
                        <p className="text-xs text-slate-500">Chronological logging of administrative updates, locks, creations, logins, and restores.</p>
                    </div>

                    {/* Filters bar */}
                    <div className="mb-4 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <h4 className="font-semibold text-slate-800 dark:text-white">Audit Export</h4>
                            <ExportMenu 
                                data={globalAuditLogs.map(log => ({
                                    ...log,
                                    createdAt: typeof log.createdAt === 'string' ? log.createdAt : (((log.createdAt as { toDate(): Date } | null)?.toDate?.()?.toLocaleString()) ?? ((log.timestamp as { toDate(): Date } | null)?.toDate?.()?.toLocaleString()) ?? "N/A")
                                })) as Record<string, unknown>[]} 
                                columns={[
                                    { key: "action", header: "Action" },
                                    { key: "targetId", header: "Target ID" },
                                    { key: "severity", header: "Severity" },
                                    { key: "createdAt", header: "Created At" },
                                    { key: "details", header: "Details" }
                                ]}
                                metadata={{
                                    module: "audit_logs",
                                    appliedFilters: isAuditSearching ? "Custom Search" : "All",
                                    correlationId: crypto.randomUUID(),
                                    performedBy: user?.uid || "unknown",
                                    performedByName: user?.displayName || user?.email || "Unknown"
                                }}
                                disabled={globalAuditLogs.length === 0}
                            />
                        </div>
                        <AuditSearchPanel 
                            onSearch={async (params) => {
                                // Default params check - fallback to realtime directory
                                if (!params.query && params.action === "all" && params.severity === "all" && params.performedBy === "all" && params.datePreset === "all") {
                                    setIsAuditSearching(false);
                                    setAuditSearchResults([]);
                                    return;
                                }
                                setIsAuditSearching(true);
                                try {
                                    const result = await searchAuditLogs(params, 100);
                                    // Map to local AuditLogEntry format
                                    setAuditSearchResults(result.items.map(i => ({
                                        ...i,
                                        operator_name: i.performedByName || "System",
                                        action: i.action,
                                        details: i.details || ""
                                    })));
                                } catch (error) {
                                    console.error("Audit search failed:", error);
                                }
                            }}
                        />
                    </div>

                    {/* Logs Table */}
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">Operator</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Details</th>
                                    <th className="px-6 py-4">Client IP / Node</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-750 dark:text-slate-300">
                                {loadingAudit ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center">
                                            <div className="flex justify-center items-center gap-2 text-slate-500 font-bold">
                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                                Loading security logs...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredAuditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-slate-450 font-bold">No security events found matching query.</td>
                                    </tr>
                                ) : (
                                    filteredAuditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/20 transition-colors">
                                            <td className="px-6 py-3 whitespace-nowrap text-[10px] text-slate-400 font-black">
                                                {log.timestamp && typeof log.timestamp === 'object' && 'toDate' in log.timestamp
                                                    ? (log.timestamp as { toDate: () => Date }).toDate().toLocaleString()
                                                    : (log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A")}
                                            </td>
                                            <td className="px-6 py-3 font-bold text-slate-900 dark:text-white">{log.operator_name}</td>
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${log.action === 'create' ? 'bg-emerald-500/10 text-emerald-500' : log.action === 'delete' ? 'bg-rose-500/10 text-rose-500' : log.action === 'login' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{log.details}</td>
                                            <td className="px-6 py-3 whitespace-nowrap text-[10px] text-slate-400">
                                                <div>IP: <span className="font-bold text-slate-650 dark:text-slate-300">{log.ip || '127.0.0.1'}</span></div>
                                                <div className="mt-0.5">{log.device || 'Desktop'} &bull; {log.browser || 'Chrome'}</div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/5 rounded-2xl">
                        <span className="text-xs text-slate-400 font-bold">
                            Showing {globalAuditLogs.length} of {totalAuditCount ?? "..."} events
                        </span>
                        {hasMoreAudit && (
                            <button 
                                disabled={loadingMoreAudit}
                                onClick={() => fetchAuditLogs(false)}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                                {loadingMoreAudit ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    "Load More"
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: EDIT EMPLOYEE */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in slide-in-from-bottom-8 duration-300 my-8">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white">Edit Employee Profile</h2>
                                <p className="text-xs text-slate-500">Update details for {showEditModal.name} ({showEditModal.employee_id})</p>
                            </div>
                            <button onClick={() => setShowEditModal(null)} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleEditEmployee} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
                                    <input disabled value={showEditModal.employee_id || ""} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-sm focus:outline-none font-medium text-slate-500 cursor-not-allowed" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input required value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={`w-full px-5 py-3 rounded-2xl border ${editValidationErrors.name ? 'border-rose-500' : 'border-slate-150 dark:border-slate-800'} bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white`} />
                                    {editValidationErrors.name && <p className="text-rose-500 text-[10px] font-bold ml-1">{editValidationErrors.name}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                    <input required type="email" value={editForm.email || ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={`w-full px-5 py-3 rounded-2xl border ${editValidationErrors.email ? 'border-rose-500' : 'border-slate-150 dark:border-slate-800'} bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white`} />
                                    {editValidationErrors.email && <p className="text-rose-500 text-[10px] font-bold ml-1">{editValidationErrors.email}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile</label>
                                    <input required value={editForm.mobile || ""} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} className={`w-full px-5 py-3 rounded-2xl border ${editValidationErrors.mobile ? 'border-rose-500' : 'border-slate-150 dark:border-slate-800'} bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white`} />
                                    {editValidationErrors.mobile && <p className="text-rose-500 text-[10px] font-bold ml-1">{editValidationErrors.mobile}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                    <input required value={editForm.department || ""} onChange={e => setEditForm({ ...editForm, department: e.target.value })} className={`w-full px-5 py-3 rounded-2xl border ${editValidationErrors.department ? 'border-rose-500' : 'border-slate-150 dark:border-slate-800'} bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white`} />
                                    {editValidationErrors.department && <p className="text-rose-500 text-[10px] font-bold ml-1">{editValidationErrors.department}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                                    <input required value={editForm.designation || ""} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} className={`w-full px-5 py-3 rounded-2xl border ${editValidationErrors.designation ? 'border-rose-500' : 'border-slate-150 dark:border-slate-800'} bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white`} />
                                    {editValidationErrors.designation && <p className="text-rose-500 text-[10px] font-bold ml-1">{editValidationErrors.designation}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">System Role</label>
                                    <select value={editForm.role || "employee"} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-905 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white">
                                        {rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Base Location</label>
                                    <input value={editForm.location || ""} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                                <button type="button" onClick={() => setShowEditModal(null)} className="px-6 py-3 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={editSubmitting} className="px-8 py-3 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20">
                                    {editSubmitting ? "Saving Changes..." : "Save Profile Details"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 1: MULTI-STEP CREATION WIZARD */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in slide-in-from-bottom-8 duration-300 my-8">
                        {/* Wizard Header & Progress */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Onboard new employee</h2>
                                    <p className="text-xs text-slate-500">MNC multi-step credential mapping flow.</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                                    <XCircle className="h-6 w-6" />
                                </button>
                            </div>
                            
                            {/* Step indicators */}
                            <div className="flex items-center gap-3 mt-6">
                                {[1, 2, 3, 4].map(step => (
                                    <div key={step} className="flex-1 flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${wizardStep >= step ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            {step}
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:inline ${wizardStep === step ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                                            {step === 1 ? 'Personal' : step === 2 ? 'Employment' : step === 3 ? 'Access' : 'Review'}
                                        </span>
                                        {step < 4 && <div className={`flex-1 h-0.5 ${wizardStep > step ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'}`} />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleCreateEmployee} className="p-8 space-y-6">
                            {/* STEP 1: PERSONAL DETAILS */}
                            {wizardStep === 1 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                            <input id="input-name" required value={form.name || ""} onChange={e => { setForm({ ...form, name: e.target.value }); validateField("name", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.name ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`} placeholder="John Carter" />
                                            {validationErrors.name && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.name}</p>}
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gender <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                            <select id="input-gender" value={form.gender || "prefer-not-to-say"} onChange={e => setForm({ ...form, gender: e.target.value as "male" | "female" | "non-binary" | "prefer-not-to-say" })} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-905">
                                                <option value="prefer-not-to-say">Prefer not to say</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="non-binary">Non-Binary</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email ID <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                            <input id="input-email" required type="email" value={form.email || ""} onChange={e => { setForm({ ...form, email: e.target.value }); validateField("email", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.email ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-155 dark:border-slate-800'}`} placeholder="john.carter@company.com" />
                                            {validationErrors.email && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.email}</p>}
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                            <input id="input-mobile" value={form.mobile || ""} onChange={e => { setForm({ ...form, mobile: e.target.value }); validateField("mobile", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.mobile ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`} placeholder="+91-9988776655" />
                                            {validationErrors.mobile && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.mobile}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Residential Address</label>
                                            <input value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white" placeholder="Sec 45, Gurugram" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profile Avatar URL</label>
                                            <input id="input-profile_photo" value={form.profile_photo || ""} onChange={e => { setForm({ ...form, profile_photo: e.target.value }); validateField("profile_photo", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.profile_photo ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`} placeholder="https://example.com/photo.jpg" />
                                            {validationErrors.profile_photo && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.profile_photo}</p>}
                                        </div>
                                    </div>

                                    {/* Emergency contacts details */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Emergency contact information</span>
                                        <div className="grid grid-cols-3 gap-3">
                                            <input placeholder="Name" value={form.emergency_contact.name || ""} onChange={e => setForm({ ...form, emergency_contact: { ...form.emergency_contact, name: e.target.value } })} className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium" />
                                            <input placeholder="Relationship" value={form.emergency_contact.relationship || ""} onChange={e => setForm({ ...form, emergency_contact: { ...form.emergency_contact, relationship: e.target.value } })} className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium" />
                                            <input placeholder="Mobile" value={form.emergency_contact.mobile || ""} onChange={e => setForm({ ...form, emergency_contact: { ...form.emergency_contact, mobile: e.target.value } })} className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: EMPLOYMENT DOSSIER */}
                            {wizardStep === 2 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Designation / Title <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                            <input id="input-designation" value={form.designation || ""} onChange={e => { setForm({ ...form, designation: e.target.value }); validateField("designation", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.designation ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`} placeholder="Lead Software Engineer" />
                                            {validationErrors.designation && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.designation}</p>}
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Department <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                            <input id="input-department" value={form.department || ""} onChange={e => { setForm({ ...form, department: e.target.value }); validateField("department", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.department ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`} placeholder="Engineering" />
                                            {validationErrors.department && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.department}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employee Type</label>
                                            <select value={form.employee_type || "permanent"} onChange={e => setForm({ ...form, employee_type: e.target.value as "permanent" | "contract" | "intern" })} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900">
                                                <option value="permanent">Permanent Staff</option>
                                                <option value="contract">Contract Consultant</option>
                                                <option value="intern">Intern Student</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Onboarding date <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                            <input id="input-joining_date" type="date" value={form.joining_date || ""} onChange={e => { setForm({ ...form, joining_date: e.target.value }); validateField("joining_date", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.joining_date ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`} />
                                            {validationErrors.joining_date && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.joining_date}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Office Location <span className="text-rose-500 font-extrabold ml-0.5">*</span></label>
                                        <input id="input-location" value={form.location || ""} onChange={e => { setForm({ ...form, location: e.target.value }); validateField("location", e.target.value); }} className={`w-full px-5 py-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white ${validationErrors.location ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`} placeholder="Gurugram HQ, India" />
                                        {validationErrors.location && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.location}</p>}
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: ACCESS CONTROLS */}
                            {wizardStep === 3 && (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Authorization role</label>
                                            <select value={form.role || "employee"} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-950">
                                                {rolesAvailable.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reporting manager</label>
                                            <select value={form.reporting_manager_id || ""} onChange={e => setForm({ ...form, reporting_manager_id: e.target.value })} className="w-full px-5 py-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900">
                                                <option value="">No Direct Manager</option>
                                                {managers.map(m => <option key={m.uid} value={m.uid}>{m.name} ({m.role})</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Manual Employee ID Override */}
                                    <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                                    Custom Employee ID {manualIdOverride && <span className="text-rose-500 font-extrabold ml-0.5">*</span>}
                                                </h4>
                                                <p className="text-[10px] text-slate-400">Override the auto-generated ID sequence.</p>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={manualIdOverride} 
                                                onChange={e => {
                                                    setManualIdOverride(e.target.checked);
                                                    if (!e.target.checked) {
                                                        setValidationErrors(prev => {
                                                            const nextErrors = { ...prev };
                                                            delete nextErrors.customEmployeeId;
                                                            return nextErrors;
                                                        });
                                                    }
                                                }} 
                                                className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                            />
                                        </div>
                                        {manualIdOverride && (
                                            <div className="space-y-1">
                                                <input 
                                                    id="input-customEmployeeId"
                                                    value={customEmployeeId} 
                                                    onChange={e => { setCustomEmployeeId(e.target.value); validateField("customEmployeeId", e.target.value); }} 
                                                    className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none ${validationErrors.customEmployeeId ? 'border-rose-500 focus:ring-rose-500/50' : 'border-slate-150 dark:border-slate-800'}`}
                                                    placeholder="e.g. EMP-9988"
                                                    required
                                                />
                                                {validationErrors.customEmployeeId && <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1">{validationErrors.customEmployeeId}</p>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Active Status</h4>
                                            <p className="text-[10px] text-slate-500 font-semibold">Enable or disable employee logins.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: VERIFY & ONBOARD */}
                            {wizardStep === 4 && (
                                <div className="space-y-4">
                                    <div className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 space-y-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Profile dossier preview</h4>
                                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-755 dark:text-slate-300">
                                            <div>Name: <span className="text-slate-900 dark:text-white font-black">{form.name}</span></div>
                                            <div>Email: <span className="text-slate-900 dark:text-white font-black">{form.email}</span></div>
                                            <div>Phone: <span className="text-slate-900 dark:text-white font-black">{form.mobile || 'N/A'}</span></div>
                                            <div>Gender: <span className="text-slate-900 dark:text-white font-black capitalize">{form.gender}</span></div>
                                            <div>Designation: <span className="text-indigo-600 dark:text-indigo-400 font-black">{form.designation || 'N/A'}</span></div>
                                            <div>Department: <span className="text-slate-900 dark:text-white font-black">{form.department || 'N/A'}</span></div>
                                            <div>Role: <span className="text-slate-900 dark:text-white font-black uppercase">{form.role}</span></div>
                                            <div>Type: <span className="text-slate-900 dark:text-white font-black capitalize">{form.employee_type}</span></div>
                                            <div>Manager: <span className="text-slate-900 dark:text-white font-black">{users.find(m => m.uid === form.reporting_manager_id)?.name || 'None'}</span></div>
                                            <div>Date of Join: <span className="text-slate-900 dark:text-white font-black">{form.joining_date}</span></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold text-center">Confirming will initialize secure auth credentials and register audit trail logs.</p>
                                </div>
                            )}

                            {/* Wizard Footer controls */}
                            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    type="button" 
                                    disabled={wizardStep === 1 || submitting}
                                    onClick={() => setWizardStep(s => s - 1)}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl disabled:opacity-50 transition-all flex items-center gap-2 h-11"
                                >
                                    <ArrowLeft className="h-4 w-4" /> Back
                                </button>
                                
                                {/* Bottom Step Dots */}
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4].map(s => (
                                        <div 
                                            key={s} 
                                            className={`h-1.5 rounded-full transition-all duration-300 ${wizardStep === s ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200 dark:bg-slate-750'}`}
                                        />
                                    ))}
                                </div>

                                {wizardStep < 4 ? (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            if (validateStep(wizardStep)) {
                                                setWizardStep(s => s + 1);
                                            }
                                        }}
                                        className={`px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 h-11 shadow-lg shadow-indigo-500/20 ${!isStepValid(wizardStep) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        Next <ArrowRight className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button 
                                        type="submit" 
                                        disabled={submitting}
                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all flex items-center gap-2 h-11"
                                    >
                                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Onboard Employee
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: OFFBOARDING / ARCHIVE CONFIRMATION DRAWER */}
            {showOffboardModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 transform animate-in slide-in-from-bottom-8 duration-300">
                        <div className="text-center space-y-4 mb-6">
                            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-500 mb-2">
                                <AlertCircle className="h-7 w-7" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Archive employee record</h3>
                            <p className="text-xs text-slate-500">Soft-deleting will disable portal login access for <span className="font-bold text-slate-900 dark:text-white">{showOffboardModal.name}</span> while preserving all histories, attendance, leaves, and logs.</p>
                            
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 text-xs text-left text-slate-650 dark:text-slate-300">
                                <div>Employee ID: <span className="font-extrabold text-slate-900 dark:text-white">{showOffboardModal.employee_id || "N/A"}</span></div>
                                <div>Email: <span className="font-extrabold text-slate-900 dark:text-white">{showOffboardModal.email || "N/A"}</span></div>
                                <div>Designation: <span className="font-extrabold text-slate-900 dark:text-white">{showOffboardModal.designation || "N/A"}</span></div>
                                <div>Department: <span className="font-extrabold text-slate-900 dark:text-white">{showOffboardModal.department || "N/A"}</span></div>
                            </div>
                        </div>

                        <form onSubmit={handleOffboardSubmit} className="space-y-4 text-left">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Exit Classification</label>
                                <select value={exitType} onChange={e => setExitType(e.target.value as "resigned" | "terminated" | "retired" | "contract_ended")} className="w-full px-4 py-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none bg-white dark:bg-slate-955">
                                    <option value="resigned">Resigned</option>
                                    <option value="terminated">Terminated</option>
                                    <option value="retired">Retired</option>
                                    <option value="contract_ended">Contract Ended</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Exit Date</label>
                                <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none text-slate-900 dark:text-white" required />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Offboarding Reason / Notes</label>
                                <textarea placeholder="Reason for resignation or contract termination..." value={exitReason} onChange={e => setExitReason(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none h-20 text-slate-900 dark:text-white" required />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                    Type <span className="font-extrabold text-rose-500">{showOffboardModal.name}</span> to confirm
                                </label>
                                <input 
                                    type="text" 
                                    value={confirmOffboardName} 
                                    onChange={e => setConfirmOffboardName(e.target.value)} 
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none text-slate-900 dark:text-white" 
                                    placeholder="Type employee's full name" 
                                    required 
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowOffboardModal(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all">Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={offboardingSubmitting || confirmOffboardName.trim() !== showOffboardModal.name?.trim()} 
                                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
                                >
                                    {offboardingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Archive Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: RESTORE RECORD CONFIRMATION */}
            {showReactivateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 transform animate-in slide-in-from-bottom-8 duration-300 text-center space-y-5">
                        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 mb-2">
                            <RotateCcw className="h-7 w-7" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Restore archived profile?</h3>
                            <p className="text-xs text-slate-500 mt-2">Restoring will reactivate the profile record for <span className="font-bold text-slate-950 dark:text-white">{showReactivateModal.name}</span>, restore portal access permissions, and update employee metrics.</p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setShowReactivateModal(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all">Cancel</button>
                                                            <button onClick={handleReactivateSubmit} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/25">Restore Profile</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: RESET PASSWORD MODAL */}
            {showResetPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 transform animate-in slide-in-from-bottom-8 duration-300">
                        <div className="text-center space-y-4 mb-5">
                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600">
                                <KeyRound className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Reset Credentials</h3>
                            <p className="text-xs text-slate-500">Set a new temporary password for <span className="font-bold text-slate-900 dark:text-white">{showResetPasswordModal.name}</span>. The user will be forced to change it on their next login.</p>
                        </div>
                        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Temporary Password</label>
                                <input 
                                    type="text" 
                                    value={tempPassword} 
                                    onChange={e => setTempPassword(e.target.value)} 
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none text-slate-900 dark:text-white"
                                    placeholder="e.g. Temp123!@#"
                                    required 
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => { setShowResetPasswordModal(null); setTempPassword(""); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl">Cancel</button>
                                <button type="submit" disabled={resettingPassword} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50">
                                    {resettingPassword ? "Resetting..." : "Reset"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: BULK IMPORT MODAL */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 transform animate-in slide-in-from-bottom-8 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Bulk Onboarding (CSV)</h3>
                                <p className="text-xs text-slate-500">Upload CSV with: name, email, mobile, role, designation, department.</p>
                            </div>
                            <button onClick={() => { setShowImportModal(false); setImportErrors([]); setImportSuccessCount(null); }} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>

                        {importErrors.length > 0 && (
                            <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-2xl space-y-1.5 max-h-48 overflow-y-auto">
                                <div className="flex items-center gap-2 text-rose-500 text-xs font-black uppercase">
                                    <AlertCircle className="h-4 w-4" />
                                    Import Validation Report
                                </div>
                                <ul className="list-disc pl-5 text-[10px] text-rose-600 dark:text-rose-400 font-bold space-y-0.5 leading-relaxed">
                                    {importErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                                </ul>
                            </div>
                        )}

                        {importSuccessCount !== null && importErrors.length === 0 && (
                            <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex items-center gap-3 text-emerald-650 text-xs font-black uppercase">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                Onboarded {importSuccessCount} employees successfully!
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-50 dark:bg-slate-800/10 relative">
                                <Upload className="h-10 w-10 text-indigo-500" />
                                <div className="text-xs font-bold text-slate-650 dark:text-slate-300">
                                    Click to upload CSV spreadsheet
                                </div>
                                <span className="text-[10px] text-slate-400 block font-medium">Accepts Microsoft Excel exported CSV sheets</span>
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    onChange={handleCsvImport}
                                    disabled={importing}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>

                            {importing && (
                                <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing and Onboarding Employees...
                                </div>
                            )}

                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => { setShowImportModal(false); setImportErrors([]); setImportSuccessCount(null); }} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
