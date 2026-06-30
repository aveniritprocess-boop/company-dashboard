"use client";

import { useState, useEffect } from "react";
import { ProfileImageUploader } from "@/components/ProfileImageUploader";
import { useAuth } from "@/components/AuthProvider";
import { TwoFactorAuth } from "@/components/TwoFactorAuth";
import { auth, db } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { UserCircle, LogOut, Save, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { logActivityClient } from "@/lib/audit-client";

export default function SettingsPage() {
  const { user, role: userRole } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateProfile = async () => {
    if (!auth.currentUser) return;
    const oldName = auth.currentUser.displayName || "";
    if (oldName === displayName) {
      showToast("Profile name is unchanged.", "error");
      return;
    }
    setSubmitting(true);
    try {
      // Update Firebase Auth Profile
      await updateProfile(auth.currentUser, { displayName });

      // Update Firestore user document
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: displayName,
        updatedAt: new Date()
      });

      // Write audit log
      try {
        await logActivityClient({
          action: "settings_changed",
          performedBy: auth.currentUser.uid,
          performedByName: displayName,
          targetId: auth.currentUser.uid,
          targetType: "settings",
          details: `Updated personal identity profile settings (display name: "${oldName}" -> "${displayName}").`,
          metadata: {
            before: { name: oldName },
            after: { name: displayName }
          }
        });
      } catch (auditErr) {
        console.error("Failed to log profile update audit:", auditErr);
      }

      showToast("Profile updated successfully!", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to update profile.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.error("SIGNOUT_TRIGGERED");
      console.trace();
      await auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {toast && (
        <div className={`fixed top-8 right-8 z-50 px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white transition-all animate-in slide-in-from-right-4 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Security & Profile
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your identity and account protection.</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-white hover:bg-red-500 border border-red-500/20 rounded-xl transition-all"
        >
          <LogOut className="h-4 w-4" />
          End Session
        </button>
      </div>

      <div className="space-y-8">
        {/* Profile Card */}
        <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
              <UserCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Identity Details</h3>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <ProfileImageUploader />
            </div>

            <div className="flex-1 w-full space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <p className="px-5 py-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl text-sm font-bold text-slate-400 border border-slate-100 dark:border-slate-800/50">{user?.email}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Access Level</label>
                  <div className="flex items-center gap-2 h-[46px]">
                    <span className="text-[10px] px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-black uppercase tracking-widest">
                      {userRole || "Guest"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleUpdateProfile}
                  disabled={submitting}
                  className="flex items-center justify-center gap-3 px-8 py-3.5 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-500/10 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Commit Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        <TwoFactorAuth />

        {/* Danger Zone */}
        <div className="rounded-3xl border border-red-500/10 bg-red-500/5 p-8">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500">Security Override Zone</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">These actions affect your fundamental account security and session persistence.</p>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-500/20"
          >
            Force Global Logout
          </button>
        </div>
      </div>
    </div>
  );
}
