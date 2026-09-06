import { NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTopicBadge(topic: string): { bg: string; text: string } {
  const t = (topic || '').toLowerCase();
  if (t.includes('support') || t.includes('bug')) return { bg: '#fef2f2', text: '#b91c1c' };
  if (t.includes('feature') || t.includes('suggestion')) return { bg: '#eef2ff', text: '#4338ca' };
  if (t.includes('general') || t.includes('question')) return { bg: '#eff6ff', text: '#1d4ed8' };
  return { bg: '#f8fafc', text: '#475569' };
}

function renderEmailHtml(name: string, email: string, topic: string, message: string, platform: string): string {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeTopic = escapeHtml(topic);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');
  const safePlatform = escapeHtml(platform || 'Web Platform');
  const badge = getTopicBadge(topic);
  const replySubject = encodeURIComponent(`Re: [Aral.ai Support] ${topic}`);
  const mailtoLink = `mailto:${safeEmail}?subject=${replySubject}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Inquiry</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;border:1px solid #cbd5e1;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header Banner: Aral.ai Blue Gradient -->
          <tr>
            <td style="background:linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #4f46e5 100%);padding:28px 32px;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#dbeafe;margin-bottom:4px;">Aral.ai Support Portal</div>
                    <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">New Contact Inquiry</div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:6px 14px;border-radius:20px;background-color:rgba(255,255,255,0.18);font-size:12px;font-weight:700;color:#ffffff;border:1px solid rgba(255,255,255,0.25);">
                      ${safePlatform}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px;">
              <!-- Student Profile Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:0 12px 12px 0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:4px;">Sender Information</div>
                    <div style="font-size:18px;font-weight:700;color:#0f172a;">${safeName}</div>
                    <div style="font-size:14px;margin-top:2px;">
                      <a href="mailto:${safeEmail}" style="color:#2563eb;text-decoration:none;font-weight:600;">${safeEmail}</a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Topic / Category Tag -->
              <div style="margin-bottom:20px;">
                <span style="display:inline-block;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;background-color:${badge.bg};color:${badge.text};border:1px solid rgba(0,0,0,0.05);">
                  ${safeTopic}
                </span>
              </div>

              <!-- Message Block -->
              <div style="margin-bottom:28px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:8px;">Message</div>
                <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:20px 22px;font-size:15px;line-height:1.6;color:#1e293b;">
                  ${safeMessage}
                </div>
              </div>

              <!-- Reply Action CTA -->
              <div style="text-align:center;padding:12px 0 6px 0;">
                <a href="${mailtoLink}" style="display:inline-block;background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                  Reply Directly to ${safeName} &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
              Submitted from the <a href="https://aral-ai-three.vercel.app" style="color:#2563eb;text-decoration:none;font-weight:600;">Aral.ai Platform</a> contact form.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, topic, message, platform } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { ok: false, error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'RESEND_API_KEY is not configured.' },
        { status: 503 }
      );
    }

    const htmlContent = renderEmailHtml(
      name.trim(),
      email.trim(),
      topic || 'General Inquiry',
      message.trim(),
      platform || 'Web Platform'
    );

    const plainText = `Aral.ai Support — Contact Submission\n\nSender: ${name.trim()} (${email.trim()})\nTopic: ${topic || 'General Inquiry'}\nPlatform: ${platform || 'Web Platform'}\n\nMessage:\n${message.trim()}\n\nReply directly to: ${email.trim()}`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Aral.ai-Vercel/1.0',
      },
      body: JSON.stringify({
        from: 'Aral.ai <onboarding@resend.dev>',
        to: ['aral.ai.app@gmail.com'],
        reply_to: email.trim(),
        subject: `[Aral.ai Support] ${topic || 'General Inquiry'} — from ${name.trim()}`,
        html: htmlContent,
        text: plainText,
      }),
    });

    const resData = await resendRes.json();

    if (!resendRes.ok) {
      return NextResponse.json(
        { ok: false, error: resData.message || 'Failed to dispatch via Resend' },
        { status: resendRes.status }
      );
    }

    return NextResponse.json({ ok: true, id: resData.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Server error processing contact request' },
      { status: 500 }
    );
  }
}
