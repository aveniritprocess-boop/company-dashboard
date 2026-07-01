import { auth } from "@/lib/firebase";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
  if (!headers.has("X-Correlation-ID")) {
    headers.set("X-Correlation-ID", generateUUID());
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
    document.cookie = "session=; path=/; max-age=0; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "");
    
    // Redirect to login with expired query
    if (typeof window !== "undefined") {
      window.location.href = "/login?expired=true";
    }
    throw new Error("Your session has expired. Please sign in again.");
  }

  return response;
}
