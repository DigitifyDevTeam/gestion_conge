from django.conf import settings
from django.core.mail import EmailMultiAlternatives


def email_cc_recipients() -> list[str]:
    cc = getattr(settings, 'EMAIL_CC', [])
    if isinstance(cc, str):
        return [address.strip() for address in cc.split(',') if address.strip()]
    return [address.strip() for address in cc if address.strip()]


def send_branded_email(
    *,
    subject: str,
    text_body: str,
    to: list[str],
    html_body: str | None = None,
    fail_silently: bool = False,
) -> bool:
    """Send an email with optional HTML alternative and configured CC recipients."""
    recipients = [address.strip() for address in to if address.strip()]
    if not recipients:
        return False

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipients,
    )
    cc = email_cc_recipients()
    if cc:
        message.cc = cc
    if html_body:
        message.attach_alternative(html_body, 'text/html')

    if fail_silently:
        try:
            message.send(fail_silently=False)
            return True
        except Exception:
            return False

    message.send(fail_silently=False)
    return True
