"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToLeads, addLead, updateLead, deleteLead, Lead, LeadStatus } from "@/lib/leads";
import { subscribeToAllUsers, AppUserSummary } from "@/lib/users";
import {
    Headset,
    Plus,
    Pencil,
    Trash2,
    X,
    Clock,
    Loader2,
    User,
    Phone,
    Wrench,
    AlertCircle
} from "lucide-react";

interface FormState {
    title: string;
    clientName: string;
    contact: string;
    email: string;
    status: LeadStatus;
    notes: string;
    assignedTo: string;
}

const emptyForm = (): FormState => ({
    title: "",
    clientName: "",
    contact: "",
    email: "",
    status: "Pending",
    notes: "",
    assignedTo: "",
});

export default function ServiceLeadsPage() {
    const { user, role } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [allUsers, setAllUsers] = useState<AppUserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        
        const unsubLeads = subscribeToLeads("service", (data) => {
            setLeads(data);
            setLoading(false);
        });

        const unsubUsers = subscribeToAllUsers((users) => {
            setAllUsers(users);
        });

        return () => {
            unsubLeads();
            unsubUsers();
        };
    }, [user]);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const openAdd = () => {
        setEditingLead(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEdit = (lead: Lead) => {
        setEditingLead(lead);
        setForm({
            title: lead.title,
            clientName: lead.clientName,
            contact: lead.contact,
            email: lead.email || "",
            status: lead.status,
            notes: lead.notes,
            assignedTo: lead.assignedTo || "",
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!form.title.trim() || !form.clientName.trim()) {
            showToast("Issue Title and Client Name are required.", "error");
            return;
        }
        setSubmitting(true);
        try {
            const assignedToUser = allUsers.find(u => u.uid === form.assignedTo);
            const leadData = {
                ...form,
                assignedToName: assignedToUser?.name || "",
                createdBy: user.uid,
                createdByName: user.displayName || "User",
            };

            if (editingLead) {
                await updateLead("service", editingLead.id, leadData);
                showToast("Service lead updated successfully.", "success");
            } else {
                await addLead("service", leadData);
                showToast("Service lead added successfully.", "success");
            }
            setShowModal(false);
        } catch (error) {
            console.error(error);
            showToast("Something went wrong. Please try again.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteLead("service", id);
            setDeleteConfirm(null);
            showToast("Service lead deleted.", "success");
        } catch {
            showToast("Failed to delete lead.", "error");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Resolved": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
            case "In Progress": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
            case "Pending": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
            default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all duration-300 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Headset className="h-7 w-7 text-indigo-500" />
                        Service Leads
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Track customer service requests and resolution status.
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus className="h-4 w-4" />
                    New Service Lead
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                </div>
            ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <Headset className="h-16 w-16 text-gray-200 dark:text-gray-800 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No service leads found.</p>
                    <button onClick={openAdd} className="mt-4 text-indigo-600 font-bold hover:underline">Add your first request</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {leads.map((lead) => (
                        <div key={lead.id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-xl transition-all group flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${getStatusColor(lead.status)}`}>
                                    {lead.status}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(lead)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors">
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    {(role === 'admin' || role === 'ceo') && (
                                        <button onClick={() => setDeleteConfirm(lead.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors">
                                {lead.title}
                            </h3>
                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" /> {lead.clientName}
                            </p>

                            <div className="space-y-2 mt-auto">
                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
                                    <Phone className="h-3 w-3 text-indigo-500" />
                                    {lead.contact}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl">
                                    <Wrench className="h-3 w-3" />
                                    {lead.assignedToName || "Unassigned"}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-4">
                                    <Clock className="h-3 w-3" />
                                    Updated {lead.updatedAt?.toDate ? lead.updatedAt.toDate().toLocaleDateString() : "Recently"}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                {editingLead ? "Edit Service Lead" : "New Service Lead"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-2xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 gap-5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Issue / Request Title</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="e.g., Server Maintenance"
                                        className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Client Name</label>
                                    <input
                                        type="text"
                                        value={form.clientName}
                                        onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                                        placeholder="Company or Individual Name"
                                        className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Contact No.</label>
                                        <input
                                            type="text"
                                            value={form.contact}
                                            onChange={(e) => setForm({ ...form, contact: e.target.value })}
                                            className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Email (Optional)</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Assign Technician / Member</label>
                                    <select
                                        value={form.assignedTo}
                                        onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                                        className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                                    >
                                        <option value="">Select a team member</option>
                                        {allUsers.map(u => (
                                            <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Service Status</label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                                        className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Issue Details</label>
                                    <textarea
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        rows={4}
                                        placeholder="Detailed description of the service request..."
                                        className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-[2] flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all disabled:opacity-60 shadow-xl shadow-indigo-200 dark:shadow-none"
                                >
                                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editingLead ? "Save Changes" : "Create Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 text-center">
                        <div className="h-20 w-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="h-10 w-10 text-red-500" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Delete Request?</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                            Are you sure you want to delete this service lead? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-6 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
