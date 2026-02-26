"use client";

import { useState, useRef, useEffect } from "react";
import {
    multiFactor,
    PhoneAuthProvider,
    PhoneMultiFactorGenerator,
    RecaptchaVerifier,
    User
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { Shield, Smartphone, Loader2, CheckCircle } from "lucide-react";

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier;
    }
}

export function TwoFactorAuth() {
    const { user } = useAuth();
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"init" | "verify" | "enrolled">("init");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [verificationId, setVerificationId] = useState("");

    const recaptchaContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Check if already enrolled
        if (user && multiFactor(user).enrolledFactors.length > 0) {
            setStep("enrolled");
        }
    }, [user]);

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier && recaptchaContainerRef.current) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
                'size': 'normal',
                'callback': (response: any) => {
                    // reCAPTCHA solved
                }
            });
        }
    };

    const handleSendCode = async () => {
        setError("");
        setLoading(true);

        try {
            setupRecaptcha();
            const appVerifier = window.recaptchaVerifier;

            if (!user) throw new Error("No user found");

            const session = await multiFactor(user).getSession();
            const phoneOptions = {
                phoneNumber: phone,
                session
            };

            const phoneAuthProvider = new PhoneAuthProvider(auth);
            const vId = await phoneAuthProvider.verifyPhoneNumber(phoneOptions, appVerifier);
            setVerificationId(vId);
            setStep("verify");
        } catch (err: any) {
            console.error(err);
            if (err.code === "auth/operation-not-allowed") {
                setError("SMS-based Multi-Factor Authentication is not enabled in your Firebase console. Please go to Authentication > Sign-in method and enable Phone as an MFA factor.");
            } else {
                setError(err.message || "Failed to send code");
            }
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                // @ts-ignore
                window.recaptchaVerifier = null;
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        setError("");
        setLoading(true);
        try {
            const cred = PhoneAuthProvider.credential(verificationId, code);
            const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

            if (!user) throw new Error("No user found");

            await multiFactor(user).enroll(multiFactorAssertion, "Phone Number");
            setStep("enrolled");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to verify code");
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!confirm("Are you sure you want to disable 2FA?")) return;
        setLoading(true);
        try {
            if (!user) return;
            const enrolledFactors = multiFactor(user).enrolledFactors;
            if (enrolledFactors.length > 0) {
                await multiFactor(user).unenroll(enrolledFactors[0]);
                setStep("init");
                setPhone("");
                setCode("");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (step === "enrolled") {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-5 mb-6">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                        <Shield className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">Security Shield Active</h3>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                            <CheckCircle className="h-4 w-4" /> Two-Factor Authentication Verified
                        </p>
                    </div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed max-w-sm">
                    Your account is currently protected with SMS-based verification. We'll ask for a code whenever you log in from a new device.
                </p>
                <button
                    onClick={handleRevoke}
                    disabled={loading}
                    className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-white hover:bg-red-500 border border-red-500/20 rounded-xl transition-all disabled:opacity-50"
                >
                    {loading ? "Processing..." : "Deactivate Protection"}
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm group">
            <div className="flex items-center gap-5 mb-8">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <Smartphone className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Two-Factor Security</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Add an extra layer of biometric-grade protection.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/20 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <p className="text-sm font-medium text-red-800 dark:text-red-300 leading-tight">
                            {error}
                        </p>
                    </div>
                </div>
            )}

            {step === "init" && (
                <div className="space-y-6">
                    <div ref={recaptchaContainerRef} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"></div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                        />
                    </div>

                    <button
                        onClick={handleSendCode}
                        disabled={loading || !phone}
                        className="flex w-full items-center justify-center rounded-2xl bg-slate-900 dark:bg-indigo-600 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40"
                    >
                        {loading ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Shield className="mr-3 h-5 w-5" />}
                        Generate Security Code
                    </button>
                </div>
            )}

            {step === "verify" && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                            6-Digit Security Code
                        </label>
                        <input
                            type="text"
                            placeholder="0 0 0 0 0 0"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-center text-2xl tracking-[0.5em] font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                        />
                    </div>

                    <button
                        onClick={handleVerifyCode}
                        disabled={loading || !code}
                        className="flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-bold text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40"
                    >
                        {loading ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-3 h-5 w-5" />}
                        Finalize Verification
                    </button>

                    <button
                        onClick={() => setStep("init")}
                        className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            )}
        </div>
    );
}
