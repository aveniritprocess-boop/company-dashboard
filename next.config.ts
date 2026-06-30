import type { NextConfig } from "next";

const IS_PROD = process.env.NODE_ENV === "production";
const CSP_REPORT_ONLY = false; // Toggle to true to test without blocking

// Content Security Policy (CSP) Directives
const cspDirectives = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    !IS_PROD ? "'unsafe-eval'" : "", // Required for Next.js Fast Refresh in dev mode
    "https://apis.google.com",
    "https://www.gstatic.com",
    "https://*.firebaseapp.com",
    "https://accounts.google.com",
    "https://www.google.com",
  ].filter(Boolean),
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  "img-src": [
    "'self'",
    "data:",
    "https://lh3.googleusercontent.com",
    "https://res.cloudinary.com",
    "https:", // Allow secure images from any source (Unsplash, transparenttextures, etc.)
  ],
  "font-src": [
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
  ],
  "connect-src": [
    "'self'",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    "https://api.cloudinary.com",
  ],
  "frame-src": [
    "'self'",
    "https://*.firebaseapp.com",
    "https://accounts.google.com",
    "https://docs.google.com", // Required for embedded Google Sheets iframe
  ],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
};

const cspHeader = Object.entries(cspDirectives)
  .map(([key, values]) => `${key} ${values.join(" ")}`)
  .join("; ");

const securityHeaders = [
  {
    key: CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    value: cspHeader,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups", // Necessary to allow Google Auth popups to communicate back
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

if (IS_PROD) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
