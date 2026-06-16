"use client";

import { useState, useRef, useEffect } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // MFA State
  const [mfaResolver, setMfaResolver] = useState<import("firebase/auth").MultiFactorResolver | null>(null);
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  const [showMfa, setShowMfa] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // ── Set cookie and navigate — cookie MUST be set before navigation ──
  const goToDashboard = () => {
    document.cookie = "session=true; path=/; max-age=86400; SameSite=Lax";
    window.location.href = "/dashboard";
  };

  // ── Effect 1: onAuthStateChanged — redirect if already logged in ──
  // This is the key fix for the Google redirect flow: after signInWithRedirect
  // brings the user back, Firebase fires onAuthStateChanged before
  // getRedirectResult resolves. Without this, the user is stuck on login.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Already authenticated — do not redirect here; let validateUserStatusAndLogin handle it
        // (it checks Firestore access flags). We just stop the initializing spinner.
        setInitializing(false);
      } else {
        setInitializing(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Effect 2: Show session-expired message ──
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("expired") === "true") {
        setError("Your session has expired. Please sign in again.");
      }
    }
  }, []);

  // ── Effect 3: Handle Google redirect result on page load ──
  useEffect(() => {
    setLoading(true);
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) {
          setLoading(false);
          return;
        }
        // Redirect result found — validate and login
        await validateUserStatusAndLogin(result.user);
      })
      .catch((err: unknown) => {
        const errorObj = err as Error & { code?: string };
        // Suppress "no pending redirect" — normal on fresh page loads
        if (errorObj?.code !== "auth/no-auth-event") {
          setError(errorObj.message || "An error occurred. Please try again.");
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initMfa = async (resolver: import("firebase/auth").MultiFactorResolver) => {
    const phoneHint = resolver.hints.find((hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
    if (!phoneHint) {
      setError("No supported second factor found.");
      return;
    }

    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, {
          'size': 'invisible',
          'callback': () => { }
        });
      }
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const vId = await phoneAuthProvider.verifyPhoneNumber(
        {
          multiFactorHint: phoneHint,
          session: resolver.session
        },
        window.recaptchaVerifier
      );
      setVerificationId(vId);
    } catch (err: unknown) {
      setError("Failed to send MFA code: " + (err as Error).message);
    }
  }

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, code);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      const result = await mfaResolver!.resolveSignIn(multiFactorAssertion);

      // Log login event
      try {
        const idToken = await result.user.getIdToken();
        await fetch('/api/auth/log-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({ action: 'login' })
        });
      } catch (err) {
        console.error("Failed to log login event:", err);
      }

      goToDashboard();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const validateUserStatusAndLogin = async (user: import("firebase/auth").User) => {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (
        userData.is_active === false ||
        userData.portal_access === false ||
        userData.is_locked === true ||
        userData.is_deleted === true
      ) {
        await auth.signOut();
        throw new Error("Access Denied: Your account is locked or portal access is disabled. Please contact your administrator.");
      }
    } else {
      // If user does not exist in directory, only Avenir IT Process manager email is allowed to auto-seed CEO
      if (user.email === "avenir.itprocess@gmail.com") {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: user.displayName || "Avenir IT Process",
          email: user.email,
          role: "ceo",
          is_active: true,
          portal_access: true,
          is_locked: false,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date()
        });
      } else {
        await auth.signOut();
        throw new Error("Access Denied: Your email is not registered in the company directory. Please contact your administrator.");
      }
    }

    // Set Avenir IT Process email back to CEO role if altered
    if (user.email === "avenir.itprocess@gmail.com" && userDoc.exists() && userDoc.data().role !== "ceo") {
      await updateDoc(doc(db, "users", user.uid), { role: "ceo", is_active: true, portal_access: true });
    }

    // Log login event
    try {
      const idToken = await user.getIdToken();
      await fetch('/api/auth/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ action: 'login' })
      });
    } catch (err) {
      console.error("Failed to log login event:", err);
    }

    goToDashboard();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await validateUserStatusAndLogin(result.user);
    } catch (err: unknown) {
      const errorObj = err as Error & { code?: string };
      if (errorObj.code === "auth/multi-factor-auth-required") {
        setShowMfa(true);
        const resolver = getMultiFactorResolver(auth, err as import("firebase/auth").MultiFactorError);
        setMfaResolver(resolver);
        initMfa(resolver);
      } else {
        setError(errorObj.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: import("firebase/auth").AuthProvider) => {
    setError("");
    setLoading(true);

    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (isLocalhost) {
      // Use popup on localhost for faster developer experience
      try {
        const result = await signInWithPopup(auth, provider);
        await validateUserStatusAndLogin(result.user);
      } catch (err: unknown) {
        const errorObj = err as Error & { code?: string };
        if (errorObj.code === "auth/multi-factor-auth-required") {
          setShowMfa(true);
          const resolver = getMultiFactorResolver(auth, err as import("firebase/auth").MultiFactorError);
          setMfaResolver(resolver);
          initMfa(resolver);
        } else if (errorObj.code === "auth/popup-blocked" || errorObj.code === "auth/unauthorized-domain") {
          // Fall back to redirect if popup is blocked
          await signInWithRedirect(auth, provider);
        } else {
          setError(errorObj.message);
          setLoading(false);
        }
      }
    } else {
      // Always use redirect on production/Vercel — more reliable cross-origin
      try {
        await signInWithRedirect(auth, provider);
        // Page navigates away; result is handled by Effect 3 on return
      } catch (err: unknown) {
        const errorObj = err as Error & { code?: string };
        setError(errorObj.message);
        setLoading(false);
      }
    }
  };

  // Show spinner while checking auth state or handling redirect
  if (initializing || loading) {
    return (
      <div className="bg-white dark:bg-slate-900 px-8 py-10 shadow-2xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl max-w-md mx-auto animate-slide-up flex flex-col items-center justify-center min-h-[300px] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-xs text-slate-400 font-medium">
          {loading ? "Connecting..." : "Loading..."}
        </p>
      </div>
    );
  }

  if (showMfa) {
    return (
      <div className="bg-white dark:bg-slate-900 px-8 py-10 shadow-2xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl max-w-md mx-auto animate-slide-up">
        <div className="text-center space-y-4 mb-6 animate-fade-in">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Two-Factor Authentication</h2>
          <p className="text-xs text-slate-500">Enter the security verification code sent to your phone hint.</p>
        </div>

        <div ref={recaptchaContainerRef}></div>

        <form onSubmit={handleVerifyMfa} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Verification Code</label>
            <input
              type="text"
              placeholder="e.g. 123456"
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-medium text-slate-900 dark:text-white transition-all"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white py-3.5 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/10"
          >
            {loading ? "Verifying..." : "Verify Identity"}
          </button>
          {error && <div className="text-red-500 text-xs font-bold text-center mt-2">{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 px-8 py-10 shadow-2xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl max-w-md mx-auto animate-slide-up">
      <div id="recaptcha-container" ref={recaptchaContainerRef}></div>
      <div className="mb-8 text-center space-y-4 animate-fade-in">
        <div>
          <h1 className="text-sm font-extrabold tracking-[0.18em] text-slate-800 dark:text-slate-100 uppercase">
            Avenir Tech Venture Pvt. Ltd.
          </h1>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
            Empowering People. Simplifying Workforce Management.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-450 rounded-xl text-xs font-bold text-center leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-medium text-slate-900 dark:text-white transition-all"
            placeholder="you@company.com"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <a href="/forgot-password" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 uppercase tracking-widest transition-colors">Forgot Password?</a>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-medium text-slate-900 dark:text-white transition-all"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white py-3.5 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/10"
        >
          {loading ? "Signing In..." : "Log In with Credentials"}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
        </div>
        <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider">
          <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500">Or Continue With</span>
        </div>
      </div>

      <div>
        <button
          onClick={() => handleSocialLogin(googleProvider)}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-[0.99]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
            />
          </svg>
          Google Identity SSO
        </button>
      </div>
    </div>
  );
}
