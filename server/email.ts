import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "email-smtp.ap-south-1.amazonaws.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@studyinfocentre.com";
const FROM_NAME = process.env.FROM_NAME || "Agreement Portal - Study Info Centre";

export async function sendPasswordResetEmail(to: string, resetUrl: string, expiresAt: Date) {
  const expiresIn = Math.round((expiresAt.getTime() - Date.now()) / 60000);

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject: "Password Reset Request - Agreement Portal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6;">
          <h1 style="color: #1e40af; margin: 0;">Agreement Portal</h1>
          <p style="color: #6b7280; margin: 5px 0 0;">Study Info Centre</p>
        </div>
        <div style="padding: 30px 0;">
          <h2 style="color: #111827;">Password Reset Request</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password:
          </p>
          <div style="text-align: center; padding: 20px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            This link will expire in ${expiresIn} minutes. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            If the button doesn't work, copy and paste this URL into your browser:<br/>
            <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px;">
            &copy; ${new Date().getFullYear()} Study Info Centre. All rights reserved.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendAgreementReminderEmail(
  to: string,
  agreementCode: string,
  agreementTitle: string,
  providerName: string,
  expiryDate: string,
  daysUntilExpiry: number,
  portalUrl: string
) {
  const urgency = daysUntilExpiry <= 7 ? "Urgent" : daysUntilExpiry <= 30 ? "Important" : "Reminder";
  const urgencyColor = daysUntilExpiry <= 7 ? "#dc2626" : daysUntilExpiry <= 30 ? "#f59e0b" : "#3b82f6";

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject: `[${urgency}] Agreement ${agreementCode} - Renewal Due in ${daysUntilExpiry} days`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6;">
          <h1 style="color: #1e40af; margin: 0;">Agreement Portal</h1>
          <p style="color: #6b7280; margin: 5px 0 0;">Study Info Centre</p>
        </div>
        <div style="padding: 30px 0;">
          <div style="background-color: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 15px; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
            <p style="color: ${urgencyColor}; font-weight: bold; margin: 0;">${urgency}: Agreement Renewal Required</p>
          </div>
          <h2 style="color: #111827; margin-bottom: 5px;">${agreementCode}</h2>
          <p style="color: #6b7280; margin-top: 0;">${agreementTitle}</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 140px;">Provider:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${providerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Expiry Date:</td>
              <td style="padding: 8px 0; color: ${urgencyColor}; font-weight: 500;">${expiryDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Days Remaining:</td>
              <td style="padding: 8px 0; color: ${urgencyColor}; font-weight: bold;">${daysUntilExpiry} days</td>
            </tr>
          </table>
          <div style="text-align: center; padding: 20px 0;">
            <a href="${portalUrl}" style="background-color: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Agreement
            </a>
          </div>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px;">
            &copy; ${new Date().getFullYear()} Study Info Centre. All rights reserved.
          </p>
        </div>
      </div>
    `,
  });
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("SMTP credentials not configured - email sending disabled");
      return false;
    }
    await transporter.verify();
    console.log("SMTP connection verified - email sending enabled");
    return true;
  } catch (err) {
    console.error("SMTP connection failed:", err);
    return false;
  }
}
