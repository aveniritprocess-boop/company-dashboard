import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { DashboardClientLayout } from "@/components/DashboardClientLayout";
import { trace } from "@/lib/trace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  trace("Dashboard Layout renders");
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  let uid = "";
  let sessionInvalid = false;
  try {
    // checkRevoked = true — retained deliberately. This is what detects a cookie
    // invalidated by a password change, and it must not be relaxed.
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decodedClaims.uid;
  } catch (error) {
    console.error("Session verification failed:", error);
    sessionInvalid = true;
  }

  // FIX-2: redirect() throws internally, so it must not be called inside the
  // try/catch above or its control-flow signal would be swallowed by the catch.
  //
  // Send the browser to a Route Handler rather than straight to /login: this
  // Server Component cannot delete the cookie (Next.js forbids cookie mutation
  // during render — attempting it crashed production in commit f71ecda), so
  // redirecting to /login would leave the dead cookie in place and re-enter the
  // loop. /api/auth/clear-session deletes it and then forwards to /login.
  if (sessionInvalid) {
    redirect("/api/auth/clear-session");
  }

  // Server-side check for must_change_password flag (defense-in-depth backing
  // the client-side redirect in DashboardClientLayout.tsx)
  if (uid) {
    const headerList = await headers();
    const pathname = headerList.get("x-invoke-path") || headerList.get("x-pathname") || "";

    // Fetch user status from Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data() || {};
      if (
        userData.must_change_password === true &&
        !pathname.includes("/dashboard/update-password")
      ) {
        redirect("/dashboard/update-password");
      }
    }
  }

  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}

