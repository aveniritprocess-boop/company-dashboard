import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/auth-middleware";
import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limiter";
import { logActivityServer } from "@/lib/audit-server";

// SEC-5 fix: this endpoint is intentionally reachable by any authenticated,
// active employee (task/lead creation notifications go through it — see
// lib/tasks.ts and lib/leads.ts, both callable by regular employees). The
// vulnerability was that it acted as an open relay: any authenticated caller
// could set an arbitrary "to" address and arbitrary subject/html, using the
// company's Gmail credentials to send mail anywhere on the internet. The fix
// restricts recipients to known internal employees (validated against the
// users collection) instead of gating the whole route behind a role check,
// which would have broken legitimate task/lead notification emails.
export async function POST(request: NextRequest) {
  try {
    const userOrError = await verifyFirebaseToken(request);
    if ('error' in userOrError) {
      return NextResponse.json({ error: userOrError.error }, { status: userOrError.status });
    }
    const caller = userOrError;

    const rateLimit = checkRateLimit(caller.uid);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { to, subject, html, text } = await request.json();

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json({ error: "Missing required fields: to, subject, and html or text" }, { status: 400 });
    }

    const recipients = (Array.isArray(to) ? to : [to]).filter((r): r is string => typeof r === "string" && r.length > 0);
    if (recipients.length === 0) {
      return NextResponse.json({ error: "No valid recipients provided" }, { status: 400 });
    }
    if (recipients.length > 30) {
      return NextResponse.json({ error: "Too many recipients in a single request" }, { status: 400 });
    }

    // Only allow sending to addresses that belong to a known, real employee —
    // prevents this endpoint from being used as a relay to arbitrary external addresses.
    const normalizedRecipients = [...new Set(recipients.map((r) => r.toLowerCase()))];
    const knownEmailsSnap = await adminDb.collection("users").where("email", "in", normalizedRecipients.slice(0, 30)).get();
    const knownEmails = new Set(knownEmailsSnap.docs.map((d) => (d.data().email || "").toLowerCase()));
    const unknownRecipients = normalizedRecipients.filter((r) => !knownEmails.has(r));
    if (unknownRecipients.length > 0) {
      return NextResponse.json({ error: `Recipient(s) not found in company directory: ${unknownRecipients.join(", ")}` }, { status: 403 });
    }

    const user = process.env.GMAIL_USER; // avenir.itprocess@gmail.com
    const pass = process.env.GMAIL_APP_PASSWORD; // The 16-character app password

    if (!user || !pass) {
      console.error("GMAIL_USER or GMAIL_APP_PASSWORD is not set");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    // nodemailer is a CommonJS module with native internals that Turbopack cannot bundle
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: user,
        pass: pass,
      },
    });

    const mailOptions = {
      from: `"Avenir Tech" <${user}>`,
      to: recipients.join(", "),
      subject: subject,
      text: text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);

    await logActivityServer({
      action: "settings_changed",
      performedBy: caller.uid,
      performedByName: caller.name || caller.email || 'User',
      targetId: recipients.join(", "),
      targetType: "settings",
      details: `Sent email "${subject}" to ${recipients.join(", ")}.`,
      correlationId: caller.correlationId,
      metadata: { recipients, subject, messageId: info.messageId || null },
      ip: caller.ip,
      browser: caller.browser,
      device: caller.device,
      userAgent: caller.userAgent
    }).catch((e) => console.error("Failed to audit-log send-email:", e));

    return NextResponse.json({ success: true, id: info.messageId });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Send Email Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
