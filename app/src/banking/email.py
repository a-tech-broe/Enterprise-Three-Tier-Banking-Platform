"""Transactional email via Amazon SES (best-effort; never raises to callers)."""
from __future__ import annotations

import logging

from .config import get_settings

log = logging.getLogger("banking")


def send_reset_email(to_email: str, reset_link: str) -> bool:
    """Send a password-reset email. Returns True on success, False otherwise.

    Disabled (returns False) when EMAIL_FROM is unset. Any SES/network error is
    logged and swallowed so the forgot-password endpoint stays non-enumerating
    and never fails because of email trouble.
    """
    settings = get_settings()
    if not settings.email_from:
        return False

    subject = "Reset your Atechbroe Bank password"
    text = (
        "We received a request to reset your Atechbroe Bank password.\n\n"
        f"Reset it here: {reset_link}\n\n"
        "If you didn't request this, you can ignore this email. "
        "The link expires shortly."
    )
    html = (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1e293b">'
        "<h2>Reset your password</h2>"
        "<p>We received a request to reset your Atechbroe Bank password.</p>"
        f'<p><a href="{reset_link}" '
        'style="display:inline-block;background:#659311;color:#fff;padding:10px 18px;'
        'border-radius:10px;text-decoration:none;font-weight:600">Reset password</a></p>'
        f'<p style="color:#64748b;font-size:13px">Or paste this link: {reset_link}</p>'
        '<p style="color:#94a3b8;font-size:12px">If you didn\'t request this, ignore '
        "this email. The link expires shortly.</p></div>"
    )

    try:
        import boto3  # imported lazily so tests/local runs need no AWS

        client = boto3.client("sesv2", region_name=settings.aws_region)
        client.send_email(
            FromEmailAddress=settings.email_from,
            Destination={"ToAddresses": [to_email]},
            Content={
                "Simple": {
                    "Subject": {"Data": subject},
                    "Body": {"Text": {"Data": text}, "Html": {"Data": html}},
                }
            },
        )
        return True
    except Exception:  # noqa: BLE001 - email failure must not break the flow
        log.exception("failed to send password-reset email to %s", to_email)
        return False
