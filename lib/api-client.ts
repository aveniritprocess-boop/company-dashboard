import { auth } from "@/lib/firebase";

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let idToken: string | undefined;

  try {
    if (auth.currentUser) {
      // getIdToken() retrieves token and automatically performs silent refresh if expired
      idToken = await auth.currentUser.getIdToken();
    }
  } catch (error) {
    console.error("Failed to retrieve authentication token:", error);
  }

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.warn("Session expired or unauthorized. Performing clean sign-out...");
    try {
      await auth.signOut();
    } catch (err) {
      console.error("Error signing out from auth:", err);
    }
    // Clear cookie
    document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
    
    // Redirect to login with expired query
    if (typeof window !== "undefined") {
      window.location.href = "/login?expired=true";
    }
    throw new Error("Your session has expired. Please sign in again.");
  }

  return response;
}
