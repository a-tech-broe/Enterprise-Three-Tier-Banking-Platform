import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const FROM = process.env.SES_FROM_EMAIL || 'noreply@skybroe.com';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const text = [
    'You requested a password reset for your SkyBroe account.',
    '',
    'Click the link below to set a new password (expires in 1 hour):',
    '',
    resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email.",
    'Your password will not change until you click the link above.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:36px;border:1px solid #334155">
    <div style="margin-bottom:28px">
      <span style="font-size:20px">✈</span>
      <span style="font-weight:700;font-size:18px;margin-left:8px">Sky<span style="color:#60a5fa">Broe</span></span>
    </div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 12px">Reset your password</h1>
    <p style="color:#94a3b8;margin:0 0 28px;line-height:1.6">
      Click the button below to set a new password for your SkyBroe account.
      This link expires in <strong style="color:#e2e8f0">1 hour</strong>.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px">
      Reset Password
    </a>
    <p style="color:#475569;font-size:12px;margin:28px 0 0;line-height:1.6">
      If you didn't request this, you can safely ignore this email.
      Your password will not change until you click the link above.
    </p>
  </div>
</body>
</html>`;

  await ses.send(new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: 'SkyBroe — Password Reset', Charset: 'UTF-8' },
      Body: {
        Text: { Data: text, Charset: 'UTF-8' },
        Html: { Data: html, Charset: 'UTF-8' },
      },
    },
  }));
}
