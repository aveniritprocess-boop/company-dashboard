import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase-admin";
import { DashboardClientLayout } from "@/components/DashboardClientLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  try {
    await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (error) {
    console.error("Session verification failed:", error);
    redirect("/login");
  }

  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
