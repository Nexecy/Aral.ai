from pathlib import Path

LOGO_WHITE = "https://eiyqtczxmovmgbodpvzu.supabase.co/storage/v1/object/public/branding/logo-white.png"
LOGO_BLUE = "https://eiyqtczxmovmgbodpvzu.supabase.co/storage/v1/object/public/branding/logo.png"

ROOT = Path(__file__).resolve().parent


def wrap(*, title: str, preheader: str, heading: str, body: str, extra: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>{title}</title>
    <!-- Subject: {title} -->
    <style>
      :root {{ color-scheme: light dark; }}
      @media (prefers-color-scheme: dark) {{
        .page {{ background-color: #070b12 !important; }}
        .card {{ background-color: #0f172a !important; }}
        .copy, .heading {{ color: #f8fafc !important; }}
        .muted {{ color: #94a3b8 !important; }}
        .code {{ background-color: #1e293b !important; color: #f8fafc !important; border-color: #334155 !important; }}
      }}
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
    <table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" class="card" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#0b0f17;padding:28px 32px;text-align:center;">
                <img src="{LOGO_WHITE}" width="48" height="48" alt="Aral.ai" style="display:block;margin:0 auto 10px auto;border:0;outline:none;" />
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  Aral.ai
                </div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#7dd3fc;margin-top:4px;">
                  Study Assistant
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 12px 32px;">
                <h1 class="heading" style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:#0f172a;">
                  {heading}
                </h1>
                <div class="copy" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
                  {body}
                </div>
              </td>
            </tr>
            {extra}
            <tr>
              <td style="padding:8px 32px 28px 32px;">
                <p class="muted" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#64748b;">
                  This email was sent by Aral.ai. If you were not expecting it, you can ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def button(href: str, label: str) -> str:
    return f"""
            <tr>
              <td align="center" style="padding:8px 32px 20px 32px;">
                <a href="{href}" style="display:inline-block;background-color:#0166fc;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;">
                  {label}
                </a>
              </td>
            </tr>
"""


def otp() -> str:
    return """
            <tr>
              <td style="padding:0 32px 20px 32px;">
                <p class="muted" style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;">
                  Or enter this code:
                </p>
                <div class="code" style="font-family:Consolas,Monaco,monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#0f172a;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;text-align:center;">
                  {{ .Token }}
                </div>
              </td>
            </tr>
"""


templates = {
    "confirm-signup.html": wrap(
        title="Confirm your Aral.ai account",
        preheader="Confirm your email to start studying with Aral.ai.",
        heading="Confirm your email",
        body="<p style=\"margin:0 0 12px 0;\">Thanks for joining Aral.ai. Confirm <strong>{{ .Email }}</strong> so we can turn your notes into study sheets, flashcards, and quizzes.</p>",
        extra=button("{{ .ConfirmationURL }}", "Confirm email") + otp(),
    ),
    "invite-user.html": wrap(
        title="You're invited to Aral.ai",
        preheader="Create your Aral.ai study account.",
        heading="You're invited",
        body="<p style=\"margin:0 0 12px 0;\">You've been invited to create an Aral.ai account. Accept below to set up your study workspace.</p>",
        extra=button("{{ .ConfirmationURL }}", "Accept invitation") + otp(),
    ),
    "magic-link.html": wrap(
        title="Your Aral.ai sign-in link",
        preheader="Use this one-time link or code to sign in.",
        heading="Sign in to Aral.ai",
        body="<p style=\"margin:0 0 12px 0;\">Use the button or the one-time code below. This link expires shortly and can only be used once.</p>",
        extra=button("{{ .ConfirmationURL }}", "Sign in") + otp(),
    ),
    "change-email.html": wrap(
        title="Confirm your new Aral.ai email",
        preheader="Verify your new email address for Aral.ai.",
        heading="Confirm your new email",
        body="<p style=\"margin:0 0 12px 0;\">Follow the link below to confirm <strong>{{ .NewEmail }}</strong> as the email for your Aral.ai account.</p><p style=\"margin:0;\">If you didn't request this change, you can ignore this email.</p>",
        extra=button("{{ .ConfirmationURL }}", "Confirm new email") + otp(),
    ),
    "reset-password.html": wrap(
        title="Reset your Aral.ai password",
        preheader="Choose a new password for your Aral.ai account.",
        heading="Reset your password",
        body="<p style=\"margin:0 0 12px 0;\">We received a request to reset the password for <strong>{{ .Email }}</strong>. Choose a new one below. If you didn't ask for this, you can ignore this email.</p>",
        extra=button("{{ .ConfirmationURL }}", "Reset password") + otp(),
    ),
    "reauthentication.html": wrap(
        title="Your Aral.ai verification code",
        preheader="Use this code to verify a sensitive change.",
        heading="Verify it's you",
        body="<p style=\"margin:0 0 12px 0;\">Use this code to confirm a sensitive change on your Aral.ai account. It expires shortly.</p>",
        extra=otp().replace("Or enter this code:", "Your verification code:"),
    ),
    "password-changed.html": wrap(
        title="Your Aral.ai password was changed",
        preheader="Someone changed the password on your Aral.ai account.",
        heading="Your password was changed",
        body="<p style=\"margin:0 0 12px 0;\">The password for <strong>{{ .Email }}</strong> was just changed.</p><p style=\"margin:0;\">If this wasn't you, reset your password and contact support immediately.</p>",
    ),
    "email-changed.html": wrap(
        title="Your Aral.ai email was changed",
        preheader="The email on your Aral.ai account was updated.",
        heading="Your email was changed",
        body="<p style=\"margin:0 0 12px 0;\">The email for your Aral.ai account was changed from <strong>{{ .OldEmail }}</strong> to <strong>{{ .Email }}</strong>.</p><p style=\"margin:0;\">If this wasn't you, contact support immediately.</p>",
    ),
    "phone-changed.html": wrap(
        title="Your Aral.ai phone number was changed",
        preheader="The phone number on your Aral.ai account was updated.",
        heading="Your phone number was changed",
        body="<p style=\"margin:0 0 12px 0;\">The phone number for your Aral.ai account was changed from <strong>{{ .OldPhone }}</strong> to <strong>{{ .Phone }}</strong>.</p><p style=\"margin:0;\">If this wasn't you, contact support immediately.</p>",
    ),
}

for name, html in templates.items():
    (ROOT / name).write_text(html, encoding="utf-8")
    print("wrote", name)
