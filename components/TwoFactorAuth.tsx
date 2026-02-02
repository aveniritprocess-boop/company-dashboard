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
          setError(err.message || "Failed to send code");
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                     <h3 className="text-lg font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h3>
                     <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Enabled
                     </p>
                </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                Your account is secured with SMS verification.
            </p>
            <button 
                onClick={handleRevoke}
                disabled={loading}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
                {loading ? "Disabling..." : "Disable 2FA"}
            </button>
        </div>
      );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
            <Smartphone className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
             <h3 className="text-lg font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h3>
             <p className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security to your account.</p>
        </div>
      </div>

      {step === "init" && (
         <div className="space-y-4">
             <div ref={recaptchaContainerRef}></div>
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                </label>
                <input 
                    type="tel"
                    placeholder="+1 555 555 5555"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 dark:text-white"
                />
             </div>
             
             {error && <p className="text-sm text-red-600">{error}</p>}
             
             <button
                onClick={handleSendCode}
                disabled={loading || !phone}
                className="flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
             >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Code
             </button>
         </div>
      )}

      {step === "verify" && (
          <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Enter Code
                  </label>
                  <input 
                      type="text"
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 dark:text-white"
                  />
               </div>
               
               {error && <p className="text-sm text-red-600">{error}</p>}
               
               <button
                  onClick={handleVerifyCode}
                  disabled={loading || !code}
                  className="flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
               >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Enable
               </button>
               
               <button 
                  onClick={() => setStep("init")}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
               >
                   Cancel
               </button>
          </div>
      )}
    </div>
  );
}
