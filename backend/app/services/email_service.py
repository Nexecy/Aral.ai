"""
Email delivery service for Aral.ai.
Renders responsive, branded HTML email templates and sends them asynchronously via SMTP.
"""
from __future__ import annotations

import asyncio
import html
import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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
        return ("#faf5ff", "#7e22ce")  # Purple
    if "general" in t or "question" in t:
        return ("#ecfdf5", "#047857")  # Emerald
    return ("#f1f5f9", "#334155")       # Slate


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
  <title>New Contact Inquiry</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.04);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #059669 0%, #10b981 100%);padding:28px 32px;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.9;margin-bottom:4px;">Aral.ai Support Portal</div>
                    <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">New Contact Submission</div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:6px 14px;border-radius:20px;background-color:rgba(255,255,255,0.2);font-size:12px;font-weight:700;color:#ffffff;backdrop-filter:blur(4px);">
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
              <!-- Student Profile Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:4px;">Sender Information</div>
                    <div style="font-size:17px;font-weight:700;color:#0f172a;">{escaped_name}</div>
                    <div style="font-size:14px;color:#059669;margin-top:2px;">
                      <a href="mailto:{escaped_email}" style="color:#059669;text-decoration:none;font-weight:600;">{escaped_email}</a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Topic / Category Tag -->
              <div style="margin-bottom:20px;">
                <span style="display:inline-block;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;background-color:{bg_pill};color:{text_pill};">
                  Topic: {escaped_topic}
                </span>
                <span style="display:inline-block;font-size:12px;color:#94a3b8;margin-left:10px;">
                  {now_str}
                </span>
              </div>

              <!-- Message Block -->
              <div style="margin-bottom:28px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:8px;">Message Content</div>
                <div style="background-color:#ffffff;border-left:4px solid #10b981;border-top:1px solid #f1f5f9;border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;border-radius:0 12px 12px 0;padding:18px 20px;font-size:15px;line-height:1.6;color:#334155;">
                  {escaped_message}
                </div>
              </div>

              <!-- Reply Action CTA -->
              <div style="text-align:center;padding:10px 0 6px 0;">
                <a href="{mailto_link}" style="display:inline-block;background-color:#059669;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;box-shadow:0 2px 6px rgba(5,150,105,0.25);">
                  Reply Directly to {escaped_name} &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
              Sent automatically from the <a href="{settings.frontend_origin}" style="color:#64748b;text-decoration:underline;">Aral.ai landing page</a> contact form.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_student_auto_reply_html(name: str, topic: str, message: str) -> str:
    escaped_name = _escape(name)
    escaped_topic = _escape(topic)
    escaped_message = _escape(message).replace("\n", "<br/>")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We received your message</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.04);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px 32px;text-align:center;border-bottom:1px solid #f1f5f9;">
              <div style="display:inline-block;font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#059669;margin-bottom:6px;">
                Aral<span style="color:#0f172a;">.ai</span>
              </div>
              <div style="font-size:13px;color:#64748b;font-weight:500;">
                AI Study Companion & Active Recall
              </div>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin-top:0;margin-bottom:12px;letter-spacing:-0.3px;">
                Thanks for reaching out, {escaped_name}! 👋
              </h2>

              <p style="font-size:14px;line-height:1.6;color:#475569;margin-bottom:20px;">
                We have received your message regarding <strong>{escaped_topic}</strong>. Our team is reviewing your note and will get back to you within <strong>24 business hours</strong>.
              </p>

              <!-- Inquired Summary Box -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;margin-bottom:6px;">Your Message Summary</div>
                <div style="font-size:13px;line-height:1.6;color:#334155;font-style:italic;">
                  &ldquo;{escaped_message}&rdquo;
                </div>
              </div>

              <p style="font-size:13px;line-height:1.6;color:#64748b;margin-bottom:24px;">
                In the meantime, feel free to explore our study tools, document notes, and interactive flashcards.
              </p>

              <div style="text-align:center;margin-bottom:12px;">
                <a href="{settings.frontend_origin}" style="display:inline-block;background-color:#059669;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:11px 24px;border-radius:10px;">
                  Visit Aral.ai Study Workspace &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;line-height:1.5;">
              If you have urgent questions, reply directly to this email or write to <a href="mailto:{settings.SUPPORT_EMAIL}" style="color:#059669;text-decoration:underline;">{settings.SUPPORT_EMAIL}</a>.<br/>
              &copy; Aral.ai Team. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


class EmailService:
    @property
    def is_configured(self) -> bool:
        return settings.has_smtp_credentials

    def _send_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        reply_to: Optional[str] = None,
    ) -> bool:
        """Synchronous SMTP worker function executed in an async thread."""
        if not self.is_configured:
            logger.info(
                "SMTP credentials not set; skipping live email dispatch. "
                "Subject: '%s' to '%s'",
                subject,
                to_email,
            )
            return False

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        # Attach HTML
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                clean_password = settings.SMTP_PASSWORD.replace(" ", "").strip()
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
        2. Friendly confirmation auto-reply to the student.
        """
        team_subject = f"[Aral.ai Support] {topic}: from {name}"
        team_html = render_team_notification_html(name, email, topic, message, platform)

        student_subject = f"We received your inquiry, {name} — Aral.ai"
        student_html = render_student_auto_reply_html(name, topic, message)

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

        # Dispatch both emails concurrently in worker threads
        team_task = asyncio.to_thread(
            self._send_smtp,
            to_email=settings.SUPPORT_EMAIL,
            subject=team_subject,
            html_content=team_html,
            reply_to=email,
        )
        student_task = asyncio.to_thread(
            self._send_smtp,
            to_email=email,
            subject=student_subject,
            html_content=student_html,
            reply_to=settings.SUPPORT_EMAIL,
        )

        team_ok, student_ok = await asyncio.gather(team_task, student_task, return_exceptions=True)

        return {
            "sent": bool(team_ok is True or student_ok is True),
            "configured": True,
            "team_delivered": team_ok is True,
            "student_delivered": student_ok is True,
        }


email_service = EmailService()
