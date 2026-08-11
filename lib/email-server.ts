export interface SendServerEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export async function sendServerEmail(options: SendServerEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error("GMAIL_USER or GMAIL_APP_PASSWORD environment variable is not configured");
    return { success: false, error: "Email service is not configured on the server." };
  }

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
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text.replace(/\n/g, "<br>"),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("Welcome Email sent successfully: " + info.response);
  return { success: true, messageId: info.messageId };
}
