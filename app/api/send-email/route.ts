import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  try {
    const userOrError = await verifyFirebaseToken(request);
    if ('error' in userOrError) {
      return NextResponse.json({ error: userOrError.error }, { status: userOrError.status });
    }

    const { to, subject, html, text } = await request.json();

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
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: subject,
      text: text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);

    return NextResponse.json({ success: true, id: info.messageId });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Send Email Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
