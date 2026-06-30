import { AppNotification } from "@/lib/notifications";
import { NotificationSearchParams } from "./search-types";
import { NotificationSearchSchema } from "@/lib/validators/search";

export function filterNotificationsClient(
  notifications: AppNotification[],
  params: NotificationSearchParams
): AppNotification[] {
  const parsedParams = NotificationSearchSchema.parse(params) as NotificationSearchParams;
  
  let filtered = notifications;

  if (parsedParams.readStatus !== "all") {
    const isRead = parsedParams.readStatus === "read";
    filtered = filtered.filter(n => n.read === isRead);
  }

  if (parsedParams.query) {
    const q = parsedParams.query.toLowerCase();
    filtered = filtered.filter(n => 
      (n.title?.toLowerCase() || "").includes(q) ||
      (n.message?.toLowerCase() || "").includes(q) ||
      (n.fromUserName?.toLowerCase() || "").includes(q)
    );
  }

  return filtered;
}
