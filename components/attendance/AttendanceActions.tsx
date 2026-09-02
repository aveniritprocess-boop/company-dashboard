"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CameraCapture } from "./CameraCapture";
import { uploadImage } from "@/lib/cloudinary";
import { startSession, endSession } from "@/lib/attendance";
import { useAttendanceSession } from "@/hooks/useAttendanceSession";
import { AttendanceTimer } from "./AttendanceTimer";
import { Loader2, LogIn, LogOut } from "lucide-react";

export function AttendanceActions() {
  const { user } = useAuth();
  const { activeSession, elapsedSeconds, loading, refreshSession } = useAttendanceSession();
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleCapture = async (file: File) => {
    if (!user) return;
    setProcessing(true);
    setError("");

    // Track which step we are on. Previously every failure collapsed into one
    // generic message, so a camera problem, an upload rejection and a Firestore
    // permission error were indistinguishable — which made this issue very hard
    // to diagnose. The stage name is not sensitive and is safe to show.
    const isClockOut = activeSession?.status === "active";
    let stage = isClockOut ? "preparing clock-out" : "preparing clock-in";

    try {
      stage = "uploading the verification photo";
      const imageUrl = await uploadImage(file);

      stage = isClockOut ? "saving your clock-out" : "saving your clock-in";
      if (activeSession && activeSession.status === "active") {
        await endSession(user.uid, activeSession.id, imageUrl, user.displayName || "User");
      } else {
        await startSession(user.uid, imageUrl, user.displayName || "User");
      }

      stage = "refreshing your attendance status";
      await refreshSession();
      setShowCamera(false);
    } catch (err: unknown) {
      // Full technical detail (stack, Firebase error object) goes to the console
      // only — never rendered into the page.
      console.error(`[attendance] failed while ${stage}:`, err);

      // Shown to the user: the stage plus a short reason code. Firebase/Cloudinary
      // codes such as "permission-denied" or "HTTP 401" are diagnostic but contain
      // no secrets, tokens, or user data.
      const e = err as { code?: string; message?: string };
      const reason = e?.code || e?.message || "unknown error";
      const shortReason = reason.length > 160 ? `${reason.slice(0, 160)}…` : reason;
      setError(`Couldn't complete attendance while ${stage}. Reason: ${shortReason}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-4 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading status...</div>;
  }

  const isClockedIn = activeSession?.status === "active";

  if (showCamera) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {!isClockedIn ? "Clock In Verification" : "Clock Out Verification"}
        </h3>
        {processing ? (
             <div className="flex flex-col items-center justify-center p-12 space-y-4 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-gray-600 dark:text-gray-400">Uploading and syncing...</p>
             </div>
        ) : (
            <CameraCapture 
                onCapture={handleCapture}
                onCancel={() => setShowCamera(false)}
            />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/30">
          {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Attendance</h2>
          <div className="mt-2 flex items-center gap-4">
               <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Current Status: 
                    <span className={`ml-2 font-semibold ${isClockedIn ? "text-green-600" : "text-gray-600"}`}>
                    {isClockedIn ? "Clocked In" : "Clocked Out"}
                    </span>
               </p>
               {isClockedIn && <AttendanceTimer seconds={elapsedSeconds} />}
          </div>
          {activeSession?.status === "active" && (
             <p className="text-xs text-gray-400 mt-2">
                 Session started at {activeSession.clockInAt?.toDate().toLocaleTimeString()}
             </p>
          )}
        </div>

        <button
          onClick={() => setShowCamera(true)}
          disabled={processing}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-md transition-colors
            ${!isClockedIn
                ? "bg-primary hover:bg-primary-hover" 
                : "bg-red-500 hover:bg-red-600"}
          `}
        >
          {!isClockedIn ? (
            <>
              <LogIn className="h-5 w-5" /> Clock In
            </>
          ) : (
            <>
              <LogOut className="h-5 w-5" /> Clock Out
            </>
          )}
        </button>
      </div>
    </div>
  );
}
