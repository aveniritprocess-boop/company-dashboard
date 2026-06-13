import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="w-full max-w-lg text-center space-y-8 animate-slide-up">
        {/* Branding & Text */}
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-[0.18em] text-slate-800 dark:text-slate-100 uppercase">
            Avenir Tech Company Portal
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
            Enterprise HRMS & Employee Management System
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex justify-center items-center w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/10"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

