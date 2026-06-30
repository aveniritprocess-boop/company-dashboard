/**
 * Application-wide configuration settings.
 */

const DEFAULT_APP_URL = "https://company-dashboard-avenirit.web.app";

export const APP_URL =
  (process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "")) ||
  DEFAULT_APP_URL;
