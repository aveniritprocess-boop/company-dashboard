"use client";

import { useState } from "react";
import { User, sendEmailVerification } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
import { AlertTriangle, Send } from "lucide-react";

export function VerifyEmailNotice() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setSending(true);
    setMessage(null);
    try {
      await sendEmailVerification(user);
      setMessage({ type: 'success', text: "Verification email sent! Check your inbox." });
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      if (error.code === 'auth/too-many-requests') {
          setMessage({ type: 'error', text: "Too many requests. Please wait a moment." });
      } else {
          setMessage({ type: 'error', text: "Failed to send email. Try again later." });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] space-y-6 text-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg max-w-md w-full border border-gray-100 dark:border-gray-700">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-6">
                <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Verify your email
            </h2>
            
            <p className="text-gray-500 dark:text-gray-400 mb-6">
                Please verify your email address <strong>{user.email}</strong> to access the dashboard.
                Check your inbox for the verification link.
            </p>

            <div className="space-y-4">
                <button
                    onClick={handleResend}
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <Send className="h-4 w-4" />
                    {sending ? "Sending..." : "Resend Verification Email"}
                </button>
                
                 <button
                    onClick={() => window.location.reload()}
                    className="w-full rounded-lg bg-white dark:bg-gray-700 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                >
                    I've Verified, Refresh Page
                </button>
            </div>
            
             {message && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {message.text}
                </div>
              )}
        </div>
    </div>
  );
}
