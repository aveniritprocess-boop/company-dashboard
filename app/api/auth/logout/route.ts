import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("session")?.value;
    
    if (sessionCookie) {
      try {
        // Verify the session cookie to extract the user UID
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
        
        // Revoke all refresh tokens for this user to globally invalidate the session
        await adminAuth.revokeRefreshTokens(decodedClaims.sub);
      } catch (err) {
        // Session might be already expired or invalid, continue to clear cookie
        console.warn("Session revocation warning:", err);
      }
    }

    const response = NextResponse.json({ success: true });
    
    // Clear the session cookie
    response.cookies.set("session", "", {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
