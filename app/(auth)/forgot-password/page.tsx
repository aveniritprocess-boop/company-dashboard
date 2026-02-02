"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError("");

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus("sent");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      if (err.code === "auth/user-not-found") {
          setError("No account found with this email.");
      } else {
          setError(err.message || "Failed to send reset email.");
      }
    }
  };

  if (status === "sent") {
    return (
        <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12 text-center">
             <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                <Mail className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-600 mb-6">
                We sent a password reset link to <strong>{email}</strong>.
            </p>
            <Link
                href="/login"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
                Return to Login
            </Link>
            <button 
                onClick={() => setStatus("idle")}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-500"
            >
                Click to try another email
            </button>
        </div>
    );
  }

  return (
    <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
      <div className="mb-6">
        <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Login
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Reset Password
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleReset}>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email address
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              required
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {status === "error" && <div className="text-red-500 text-sm">{error}</div>}

        <div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === "sending" ? "Sending..." : "Send Reset Link"}
          </button>
        </div>
      </form>
    </div>
  );
}
