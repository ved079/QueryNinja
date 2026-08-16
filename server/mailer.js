import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

function otpHtml(code) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%">
        <!-- Logo + Brand -->
        <tr>
          <td align="center" style="padding-bottom:32px">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="font-size:0">
                  <!-- ASCII-style shuriken logo using Unicode -->
                  <span style="display:inline-block;font-size:20px;line-height:1;margin-bottom:8px">⚡</span>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:36px;font-weight:900;letter-spacing:1px">
                  <span style="color:#f8fafc">Query</span><span style="color:#0ea5e9">Ninja</span>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:11px;font-weight:600;letter-spacing:6px;color:#64748b;padding-top:4px">MASTER YOUR DATA</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background-color:#1e293b;border-radius:12px;padding:40px 32px;text-align:center">
            <!-- Heading -->
            <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#f8fafc;letter-spacing:-0.3px">
              Your login code
            </h1>
            <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.5">
              Use this code to sign in to your account. It expires in 10 minutes.
            </p>

            <!-- Code Box -->
            <div style="background:#0f172a;border:2px dashed #0ea5e9;border-radius:10px;padding:20px 16px;margin-bottom:28px;display:inline-block">
              <span style="font-family:'SF Mono','Fira Code','Cascadia Code',monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#38bdf8">
                ${code}
              </span>
            </div>

            <!-- Security note -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">
              <tr>
                <td style="padding-right:8px;vertical-align:middle">
                  <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#0ea5e9;color:#0f172a;font-size:10px;font-weight:700;line-height:14px;text-align:center">i</span>
                </td>
                <td style="vertical-align:middle">
                  <span style="font-size:13px;color:#94a3b8;line-height:1.4">
                    Never share this code with anyone. We will never ask for it outside of this login page.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:24px">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.5">
              If you didn't request this email, you can safely ignore it — someone else may have typed your email by mistake.
            </p>
            <p style="margin:0;font-size:12px;color:#64748b">
              QueryNinja &bull; master your data
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(to, code) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('Email login is not configured on this server (missing GMAIL_USER/GMAIL_APP_PASSWORD).');
  }
  await getTransporter().sendMail({
    from: `QueryNinja <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your QueryNinja login code: ${code}`,
    text: `Your QueryNinja login code is: ${code}\n\nThis code expires in 10 minutes. Never share it with anyone.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: otpHtml(code),
  });
}
