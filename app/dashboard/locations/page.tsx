"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Location, createLocation, updateLocation, deleteLocation, subscribeToLocations } from "@/lib/locations";
import { MapPin, Plus, Edit2, Trash2, ShieldAlert, Loader2, X } from "lucide-react";

export default function LocationsPage() {
    const { role, loading: authLoading } = useAuth();
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [state, setState] = useState("");
    const [status, setStatus] = useState<"active" | "inactive">("active");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (role !== "admin" && role !== "ceo") return;

        const unsubscribe = subscribeToLocations((data) => {
            setLocations(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [role]);

    const handleOpenModal = (loc?: Location) => {
        if (loc) {
            setEditingId(loc.id);
            setName(loc.name);
            setCode(loc.code);
            setState(loc.state);
            setStatus(loc.status);
        } else {
            setEditingId(null);
            setName("");
            setCode("");
            setState("");
            setStatus("active");
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");
        try {
            if (editingId) {
                await updateLocation(editingId, { name: name.trim(), code: code.trim(), state: state.trim(), status });
            } else {
                await createLocation(name.trim(), code.trim(), state.trim(), status);
            }
            setShowModal(false);
        } catch (err: unknown) {
            console.error("Error saving location:", err);
            setError("Failed to save location.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this location? It might affect assigned employees.")) return;
        setError("");
        try {
            await deleteLocation(id);
        } catch (err: unknown) {
            console.error("Error deleting location:", err);
            setError("Failed to delete location.");
        }
    };

    const handleToggleStatus = async (loc: Location) => {
        setError("");
        try {
            await updateLocation(loc.id, { status: loc.status === "active" ? "inactive" : "active" });
        } catch (err: unknown) {
            console.error("Error updating status:", err);
            setError("Failed to update status.");
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (role !== "admin" && role !== "ceo") {
        return (
            <div className="flex h-[80vh] flex-col items-center justify-center text-center space-y-4">
                <ShieldAlert className="h-16 w-16 text-slate-300 dark:text-slate-700" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Access Restricted</h2>
                <p className="text-slate-500 max-w-sm">You do not have permission to view or manage company locations.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Location Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage all company branches and offices.</p>
                </div>

                {(role === "admin" || role === "ceo") && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-md shadow-indigo-500/20"
                    >
                        <Plus className="h-4 w-4" />
                        Add Location
                    </button>
                )}
            </div>
 
            {error && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-900/30">
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Location</th>
                                <th className="px-6 py-4 font-semibold">Code</th>
                                <th className="px-6 py-4 font-semibold">State</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                {(role === "admin" || role === "ceo") && <th className="px-6 py-4 font-semibold text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {locations.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center mb-4"><MapPin className="h-8 w-8 opacity-20" /></div>
                                        <p>No locations found.</p>
                                    </td>
                                </tr>
                            ) : (
                                locations.map((loc) => (
                                    <tr key={loc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            {loc.name}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-mono text-xs border border-slate-200 dark:border-slate-700">
                                                {loc.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {loc.state}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => (role === "admin" || role === "ceo") && handleToggleStatus(loc)}
                                                disabled={role !== "admin" && role !== "ceo"}
                                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border transition-colors ${loc.status === 'active'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                    } ${role === "admin" || role === "ceo" ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                                            >
                                                {loc.status}
                                            </button>
                                        </td>
                                        {(role === "admin" || role === "ceo") && (
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(loc)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-500/10 rounded-md"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(loc.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-500/10 rounded-md"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Creation/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-indigo-500" />
                                {editingId ? "Edit Location" : "Add Location"}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Location Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                                    placeholder="e.g. Headquarters"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Location Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={code}
                                        onChange={e => setCode(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none uppercase"
                                        placeholder="e.g. HQ-01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">State/Region</label>
                                    <input
                                        type="text"
                                        required
                                        value={state}
                                        onChange={e => setState(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                                        placeholder="e.g. California"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</label>
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value as "active" | "inactive")}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editingId ? "Update Location" : "Create Location"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
