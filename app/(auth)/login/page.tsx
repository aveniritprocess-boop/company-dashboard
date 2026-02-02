"use client";

import { useState, useRef } from "react";
import { signInWithEmailAndPassword, signInWithPopup, getMultiFactorResolver, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db, googleProvider } from "@/lib/firebase";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // MFA State
  const [mfaResolver, setMfaResolver] = useState<any>(null);
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  const [showMfa, setShowMfa] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      if (err.code === "auth/multi-factor-auth-required") {
         setShowMfa(true);
         setMfaResolver(getMultiFactorResolver(auth, err));
         initMfa(getMultiFactorResolver(auth, err));
      } else {
         setError(err.message);
      }
    }
  };

  const initMfa = async (resolver: any) => {
      // Find the enrolled phone factor
      const phoneHint = resolver.hints.find((hint: any) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
      if (!phoneHint) {
          setError("No supported second factor found.");
          return;
      }
      
      try {
           if (!window.recaptchaVerifier) {
              window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, {
                  'size': 'invisible', 
                  'callback': () => {}
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
      } catch(err: any) {
          setError("Failed to send MFA code: " + err.message);
      }
  }

  const handleVerifyMfa = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const cred = PhoneAuthProvider.credential(verificationId, code);
          const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
          await mfaResolver.resolveSignIn(multiFactorAssertion);
          router.push("/dashboard");
      } catch (err: any) {
          setError(err.message);
      }
  }

  const handleSocialLogin = async (provider: any) => {
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);
      
      // Check for user existence logic remains same... 
      // Simplified here for brevity as we focus on MFA which might also trigger on Social Login if enabled.
       const user = result.user;
       const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            name: user.displayName || "",
            photoURL: user.photoURL || "",
            role: "employee",
            provider: provider.providerId,
            createdAt: new Date().toISOString(),
            });
        }
      router.push("/dashboard");
    } catch (err: any) {
        if (err.code === "auth/multi-factor-auth-required") {
             setShowMfa(true);
             setMfaResolver(getMultiFactorResolver(auth, err));
             initMfa(getMultiFactorResolver(auth, err));
        } else {
            setError(err.message);
        }
    }
  };

  if (showMfa) {
      return (
          <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12 max-w-md mx-auto mt-10">
              <h2 className="text-2xl font-bold text-center mb-6">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-500 text-center mb-6">Enter the code sent to your phone.</p>
              
               <div ref={recaptchaContainerRef}></div>
               
              <form onSubmit={handleVerifyMfa} className="space-y-6">
                <input
                     type="text"
                     placeholder="Enter verification code"
                     className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border"
                     value={code}
                     onChange={(e) => setCode(e.target.value)}
                />
                <button
                    type="submit"
                    className="flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Verify
                </button>
                 {error && <div className="text-red-500 text-sm">{error}</div>}
              </form>
          </div>
      );
  }

  return (
    <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
      <div id="recaptcha-container" ref={recaptchaContainerRef}></div>
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Log in
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:text-primary-hover"
          >
            Sign up
          </Link>
        </p>
      </div>

      <div className="space-y-6">
        <div>
           <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => handleSocialLogin(googleProvider)}
              className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Google
            </button>
           </div>
           <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">
                Or continue with
              </span>
            </div>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
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
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center">
                <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
                >
                Password
                </label>
                <Link 
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:text-primary-hover"
                >
                    Forgot password?
                </Link>
            </div>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                required
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Log in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
