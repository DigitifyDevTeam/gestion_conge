import logging
from datetime import datetime
from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, send_mail
from django.template.loader import render_to_string
from django.utils import timezone

from .account_activation import ACTIVATION_MAX_AGE_SECONDS, make_activation_token

logger = logging.getLogger(__name__)


def _activation_url(user) -> str:
    token = make_activation_token(user)
    frontend = settings.FRONTEND_URL.rstrip('/')
    return f'{frontend}/activate?token={quote(token)}'


def send_activation_email(*, user) -> bool:
    """Send a branded activation link so the user can verify email and set a password."""
    email = user.email
    name = (user.get_full_name() or '').strip() or email
    activation_url = _activation_url(user)
    expiry_days = max(ACTIVATION_MAX_AGE_SECONDS // 86400, 1)
    sent_at = timezone.localtime(timezone.now()).strftime('%d/%m/%Y à %H:%M')

    subject = 'Gestion de congé — activez votre compte'
    context = {
        'subject': subject,
        'name': name,
        'email': email,
        'activation_url': activation_url,
        'expiry_days': expiry_days,
        'sent_at': sent_at,
        'year': datetime.now().year,
    }

    try:
        html_body = render_to_string('emails/account_activation.html', context)
        text_body = render_to_string('emails/account_activation.txt', context)

        email_msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        email_msg.attach_alternative(html_body, 'text/html')
        email_msg.send(fail_silently=False)
        return True
    except Exception:
        logger.exception('Failed to send activation email to %s', email)
        return False


def send_comptable_welcome_email(*, email: str, name: str = '') -> bool:
    """Notify a comptable that they will receive monthly leave reports."""
    display_name = (name or '').strip() or email
    subject = 'Gestion de congé — compte comptable configuré'
    body = (
        f'Bonjour {display_name},\n\n'
        f'Un administrateur vous a ajouté comme comptable sur Gestion de congé.\n\n'
        f'Vous recevrez automatiquement un e-mail récapitulatif chaque mois '
        f'avec la liste des congés approuvés et des jours fériés.\n\n'
        f'Vous n\'avez pas besoin de vous connecter à l\'application.\n\n'
        f'Si vous n\'êtes pas concerné(e), ignorez cet e-mail.\n\n'
        f'— L\'équipe Gestion de congé'
    )
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception('Failed to send comptable welcome email to %s', email)
        return False
