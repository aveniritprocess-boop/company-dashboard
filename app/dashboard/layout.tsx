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
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decodedClaims.uid;
  } catch (error) {
    console.error("Session verification failed:", error);
    redirect("/login");
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

