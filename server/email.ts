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

export async function sendLoginOtpEmail(to: string, code: string, expiresInMinutes: number) {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject: "Login Verification Code - Agreement Portal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6;">
          <h1 style="color: #1e40af; margin: 0;">Agreement Portal</h1>
          <p style="color: #6b7280; margin: 5px 0 0;">Study Info Centre</p>
        </div>
        <div style="padding: 30px 0;">
          <h2 style="color: #111827;">Login Verification Code</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Your verification code for logging into the Agreement Portal is:
          </p>
          <div style="text-align: center; padding: 20px 0;">
            <div style="display: inline-block; background-color: #f3f4f6; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px 40px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #1e40af; font-family: monospace;">
              ${code}
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            This code will expire in <strong>${expiresInMinutes} minutes</strong>. It can only be used once.
          </p>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 20px; padding: 12px; background-color: #fef3c7; border-radius: 6px;">
            ⚠️ If you did not attempt to log in, please ignore this email and consider changing your password.
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

export async function sendExpiryReminderEmail(
  to: string[],
  data: {
    providerName: string;
    country: string;
    startDate: string;
    expiryDate: string;
    daysRemaining: number;
    currentStatus: string;
    agreementLink: string;
  }
) {
  const isUrgent = data.daysRemaining <= 14;
  const subject = isUrgent
    ? `URGENT: Agreement Expiring Soon – ${data.providerName}`
    : `Agreement Expiry Reminder – ${data.providerName} – Expires in ${data.daysRemaining} Days`;

  const urgencyColor = data.daysRemaining <= 7 ? "#dc2626" : data.daysRemaining <= 14 ? "#ea580c" : data.daysRemaining <= 30 ? "#f59e0b" : "#3b82f6";

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: to.join(", "),
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6;">
          <h1 style="color: #1e40af; margin: 0;">Agreement Portal</h1>
          <p style="color: #6b7280; margin: 5px 0 0;">Study Info Centre</p>
        </div>
        <div style="padding: 30px 0;">
          <p style="color: #4b5563; line-height: 1.6;">Hello,</p>
          <p style="color: #4b5563; line-height: 1.6;">This is an automated notification from the Agreement Management System.</p>
          <p style="color: #4b5563; line-height: 1.6;">The agreement with the following provider is approaching its expiry date.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px;">
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Provider Name</td><td style="padding: 10px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${data.providerName}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Country</td><td style="padding: 10px 16px; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${data.country}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Agreement Start Date</td><td style="padding: 10px 16px; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${data.startDate}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Agreement Expiry Date</td><td style="padding: 10px 16px; font-weight: 600; color: ${urgencyColor}; border-bottom: 1px solid #e5e7eb;">${data.expiryDate}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Days Remaining</td><td style="padding: 10px 16px; font-weight: 700; color: ${urgencyColor}; border-bottom: 1px solid #e5e7eb;">${data.daysRemaining} Days</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280;">Agreement Status</td><td style="padding: 10px 16px; font-weight: 500;">${data.currentStatus}</td></tr>
          </table>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <p style="color: #92400e; font-weight: 600; margin: 0 0 8px;">Action Required:</p>
            <p style="color: #92400e; margin: 0 0 8px;">Please review the agreement and initiate the renewal process if continuation of the partnership is required.</p>
            <p style="color: #92400e; margin: 0;">Failure to renew the agreement before expiry may result in:</p>
            <ul style="color: #92400e; margin: 8px 0 0;">
              <li>Commission payment issues</li>
              <li>Student application processing delays</li>
              <li>Partnership suspension</li>
            </ul>
          </div>
          <div style="text-align: center; padding: 20px 0;">
            <a href="${data.agreementLink}" style="background-color: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Agreement in Portal</a>
          </div>
          <p style="color: #9ca3af; font-size: 13px; font-style: italic;">This is an automated reminder.</p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center;">
          <p style="color: #6b7280; font-size: 13px; font-weight: 500; margin: 0;">Study Info Centre</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Agreement Management System</p>
        </div>
      </div>
    `,
  });
}

export async function sendExpiredAgreementEmail(
  to: string[],
  data: {
    providerName: string;
    country: string;
    expiryDate: string;
    agreementLink: string;
  }
) {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: to.join(", "),
    subject: `Agreement Expired – Immediate Action Required – ${data.providerName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #dc2626;">
          <h1 style="color: #1e40af; margin: 0;">Agreement Portal</h1>
          <p style="color: #6b7280; margin: 5px 0 0;">Study Info Centre</p>
        </div>
        <div style="padding: 30px 0;">
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="color: #dc2626; font-weight: 700; margin: 0; font-size: 16px;">⚠ Agreement Expired</p>
          </div>
          <p style="color: #4b5563; line-height: 1.6;">Hello,</p>
          <p style="color: #4b5563; line-height: 1.6;">The agreement with the following provider has expired.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px;">
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Provider Name</td><td style="padding: 10px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${data.providerName}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Country</td><td style="padding: 10px 16px; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${data.country}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Agreement Expiry Date</td><td style="padding: 10px 16px; font-weight: 600; color: #dc2626; border-bottom: 1px solid #e5e7eb;">${data.expiryDate}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280;">Current Status</td><td style="padding: 10px 16px; font-weight: 600; color: #dc2626;">Expired</td></tr>
          </table>
          <p style="color: #4b5563; line-height: 1.6; font-weight: 500;">Immediate action is required.</p>
          <p style="color: #4b5563; line-height: 1.6;">Please initiate renewal or confirm whether the partnership will continue.</p>
          <p style="color: #4b5563; line-height: 1.6;">If renewal is already in progress, please update the status to <strong>Renewal in Progress</strong> in the system.</p>
          <div style="text-align: center; padding: 20px 0;">
            <a href="${data.agreementLink}" style="background-color: #dc2626; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Agreement in Portal</a>
          </div>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center;">
          <p style="color: #6b7280; font-size: 13px; font-weight: 500; margin: 0;">Study Info Centre</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Agreement Management System</p>
        </div>
      </div>
    `,
  });
}

export async function sendRenewalDelayEmail(
  to: string[],
  data: {
    providerName: string;
    expiryDate: string;
    agreementLink: string;
  }
) {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: to.join(", "),
    subject: `Renewal Pending – Agreement Expired but Renewal Not Completed – ${data.providerName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #ea580c;">
          <h1 style="color: #1e40af; margin: 0;">Agreement Portal</h1>
          <p style="color: #6b7280; margin: 5px 0 0;">Study Info Centre</p>
        </div>
        <div style="padding: 30px 0;">
          <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="color: #ea580c; font-weight: 700; margin: 0; font-size: 16px;">⏳ Renewal Pending</p>
          </div>
          <p style="color: #4b5563; line-height: 1.6;">Hello,</p>
          <p style="color: #4b5563; line-height: 1.6;">The following agreement has expired and renewal has not been completed yet.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px;">
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Provider Name</td><td style="padding: 10px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${data.providerName}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Expiry Date</td><td style="padding: 10px 16px; font-weight: 600; color: #ea580c; border-bottom: 1px solid #e5e7eb;">${data.expiryDate}</td></tr>
            <tr><td style="padding: 10px 16px; color: #6b7280;">Current Status</td><td style="padding: 10px 16px; font-weight: 600; color: #ea580c;">Renewal in Progress</td></tr>
          </table>
          <p style="color: #4b5563; line-height: 1.6;">Please follow up with the provider and complete the renewal process.</p>
          <p style="color: #9ca3af; font-size: 13px; font-style: italic;">This notification will continue every 7 days until renewal is completed.</p>
          <div style="text-align: center; padding: 20px 0;">
            <a href="${data.agreementLink}" style="background-color: #ea580c; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Agreement in Portal</a>
          </div>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center;">
          <p style="color: #6b7280; font-size: 13px; font-weight: 500; margin: 0;">Study Info Centre</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Agreement Management System</p>
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
