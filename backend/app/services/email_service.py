"""
Email delivery service for Aral.ai.
Renders responsive, branded Blue/White HTML & plain-text email templates.
Includes full RFC 5322 compliance (Message-ID, Date, Multipart) to prevent spam blocking.
"""
from __future__ import annotations

import asyncio
import html
import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from typing import Any, Dict, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _escape(text: str) -> str:
    return html.escape(text or "")


def _topic_color(topic: str) -> tuple[str, str]:
    """Returns (background_color, text_color) for category pill badge."""
    t = (topic or "").lower()
    if "support" in t or "bug" in t:
        return ("#fef2f2", "#b91c1c")  # Rose
    if "feature" in t or "suggestion" in t or "feedback" in t:
        return ("#eef2ff", "#4338ca")  # Indigo
    if "general" in t or "question" in t:
        return ("#eff6ff", "#1d4ed8")  # Aral Blue
    return ("#f8fafc", "#475569")       # Slate


# -----------------------------------------------------------------------------
# Team Notification Email (Blue / White Aral.ai Scheme)
# -----------------------------------------------------------------------------

def render_team_notification_html(
    name: str,
    email: str,
    topic: str,
    message: str,
    platform: Optional[str] = None,
) -> str:
    escaped_name = _escape(name)
    escaped_email = _escape(email)
    escaped_topic = _escape(topic)
    escaped_message = _escape(message).replace("\n", "<br/>")
    escaped_platform = _escape(platform or "Web Client")
    now_str = datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")
    bg_pill, text_pill = _topic_color(topic)

    reply_subject = _escape(f"Re: [Aral.ai Support] {topic}")
    mailto_link = f"mailto:{escaped_email}?subject={reply_subject}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Submission</title>
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
                      {escaped_platform}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px;">
              <!-- Student Profile Card (Soft Blue / White) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:0 12px 12px 0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:4px;">Sender Information</div>
                    <div style="font-size:18px;font-weight:700;color:#0f172a;">{escaped_name}</div>
                    <div style="font-size:14px;margin-top:2px;">
                      <a href="mailto:{escaped_email}" style="color:#2563eb;text-decoration:none;font-weight:600;">{escaped_email}</a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Topic / Category Tag & Timestamp -->
              <div style="margin-bottom:20px;">
                <span style="display:inline-block;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;background-color:{bg_pill};color:{text_pill};border:1px solid rgba(0,0,0,0.05);">
                  {escaped_topic}
                </span>
                <span style="display:inline-block;font-size:12px;color:#64748b;margin-left:10px;font-weight:500;">
                  {now_str}
                </span>
              </div>

              <!-- Message Block -->
              <div style="margin-bottom:28px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:8px;">Message</div>
                <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:20px 22px;font-size:15px;line-height:1.6;color:#1e293b;">
                  {escaped_message}
                </div>
              </div>

              <!-- Reply Action CTA -->
              <div style="text-align:center;padding:12px 0 6px 0;">
                <a href="{mailto_link}" style="display:inline-block;background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                  Reply Directly to {escaped_name} &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
              Submitted from the <a href="{settings.frontend_origin}" style="color:#2563eb;text-decoration:none;font-weight:600;">Aral.ai Platform</a> contact form.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_team_notification_plain(
    name: str,
    email: str,
    topic: str,
    message: str,
    platform: Optional[str] = None,
) -> str:
    now_str = datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")
    return f"""Aral.ai Support Portal — New Contact Submission

Sender: {name} ({email})
Topic: {topic}
Platform: {platform or "Web Client"}
Time: {now_str}

Message:
{message}

Reply to: {email}
"""


# -----------------------------------------------------------------------------
# Student Confirmation Auto-Responder (Blue / White Aral.ai Scheme)
# -----------------------------------------------------------------------------

def render_student_auto_reply_html(name: str, topic: str, message: str) -> str:
    escaped_name = _escape(name)
    escaped_topic = _escape(topic)
    escaped_message = _escape(message).replace("\n", "<br/>")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We received your inquiry</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #cbd5e1;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Blue Top Accent Bar -->
          <tr>
            <td style="height:6px;background:linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #6366f1 100%);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 20px 32px;text-align:center;border-bottom:1px solid #f1f5f9;">
              <div style="font-size:26px;font-weight:900;letter-spacing:-0.5px;color:#1d4ed8;margin-bottom:4px;">
                Aral<span style="color:#0f172a;">.ai</span>
              </div>
              <div style="font-size:13px;color:#64748b;font-weight:500;">
                AI Study Companion & Active Recall Platform
              </div>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin-top:0;margin-bottom:12px;letter-spacing:-0.3px;">
                Thanks for reaching out, {escaped_name}! 👋
              </h2>

              <p style="font-size:14px;line-height:1.6;color:#334155;margin-bottom:20px;">
                We have received your message regarding <strong>{escaped_topic}</strong>. A member of the Aral.ai team will review your question and follow up within <strong>24 business hours</strong>.
              </p>

              <!-- Inquired Summary Box -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:0 12px 12px 0;padding:18px 20px;margin-bottom:24px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:6px;">Your Message Summary</div>
                <div style="font-size:14px;line-height:1.6;color:#1e293b;font-style:italic;">
                  &ldquo;{escaped_message}&rdquo;
                </div>
              </div>

              <p style="font-size:13px;line-height:1.6;color:#64748b;margin-bottom:24px;">
                In the meantime, feel free to jump into your study workspace to review notes, generate flashcards, or take active recall quizzes.
              </p>

              <div style="text-align:center;margin-bottom:12px;">
                <a href="{settings.frontend_origin}" style="display:inline-block;background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                  Open Aral.ai Workspace &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;line-height:1.5;">
              If you have urgent questions, reply directly to this email or contact <a href="mailto:{settings.SUPPORT_EMAIL}" style="color:#2563eb;text-decoration:none;font-weight:600;">{settings.SUPPORT_EMAIL}</a>.<br/>
              &copy; Aral.ai Team. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_student_auto_reply_plain(name: str, topic: str, message: str) -> str:
    return f"""Hello {name},

Thank you for reaching out to Aral.ai!

We received your message regarding "{topic}". A member of our team will review your inquiry and follow up within 24 business hours.

Your message:
"{message}"

You can visit Aral.ai anytime at: {settings.frontend_origin}

Best regards,
The Aral.ai Team
"""


# -----------------------------------------------------------------------------
# Email Delivery Service
# -----------------------------------------------------------------------------

class EmailService:
    @property
    def is_configured(self) -> bool:
        return settings.has_smtp_credentials

    def _send_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: str,
        reply_to: Optional[str] = None,
    ) -> bool:
        """
        Synchronous SMTP worker function executed in an async thread.
        Uses multipart/alternative with plain-text + HTML and standard RFC headers
        to ensure 100% Gmail deliverability and prevent anti-spam blocks.
        """
        if not self.is_configured:
            logger.info("SMTP credentials not set; skipping live dispatch for '%s'", subject)
            return False

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="gmail.com")
        msg["MIME-Version"] = "1.0"
        if reply_to:
            msg["Reply-To"] = reply_to

        # Crucial for anti-spam: attach plain text first, then HTML
        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            clean_password = settings.SMTP_PASSWORD.replace(" ", "").strip()
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, clean_password)
                server.send_message(msg)
            logger.info("Successfully sent email '%s' to %s", subject, to_email)
            return True
        except Exception as exc:
            logger.error("Failed to deliver email '%s' to %s: %s", subject, to_email, exc)
            return False

    async def send_contact_inquiry(
        self,
        name: str,
        email: str,
        topic: str,
        message: str,
        platform: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sends:
        1. Team notification email to SUPPORT_EMAIL with Reply-To set to student.
        2. Friendly confirmation auto-reply to the student (unless it's an internal test).
        """
        team_subject = f"[Aral.ai Support] {topic}: from {name}"
        team_html = render_team_notification_html(name, email, topic, message, platform)
        team_plain = render_team_notification_plain(name, email, topic, message, platform)

        student_subject = f"We received your inquiry, {name} — Aral.ai"
        student_html = render_student_auto_reply_html(name, topic, message)
        student_plain = render_student_auto_reply_plain(name, topic, message)

        if not self.is_configured:
            logger.warning(
                "SMTP_PASSWORD is not set. Emails logged in development mode. Team email: %s, Student email: %s",
                settings.SUPPORT_EMAIL,
                email,
            )
            return {
                "sent": False,
                "configured": False,
                "message": "SMTP not configured on backend; logged inquiry in server records.",
            }

        # 1. Dispatch team notification
        team_task = asyncio.to_thread(
            self._send_smtp,
            to_email=settings.SUPPORT_EMAIL,
            subject=team_subject,
            html_content=team_html,
            plain_content=team_plain,
            reply_to=email,
        )

        # 2. Dispatch student auto-reply (skip duplicate if user is testing with the support email itself)
        is_self_test = email.strip().lower() == settings.SUPPORT_EMAIL.strip().lower()
        if not is_self_test:
            student_task = asyncio.to_thread(
                self._send_smtp,
                to_email=email,
                subject=student_subject,
                html_content=student_html,
                plain_content=student_plain,
                reply_to=settings.SUPPORT_EMAIL,
            )
            team_ok, student_ok = await asyncio.gather(team_task, student_task, return_exceptions=True)
        else:
            team_ok = await team_task
            student_ok = True

        return {
            "sent": bool(team_ok is True or student_ok is True),
            "configured": True,
            "team_delivered": team_ok is True,
            "student_delivered": student_ok is True,
        }


email_service = EmailService()
