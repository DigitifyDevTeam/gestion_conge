from django.conf import settings
from django.core.mail import send_mail


def send_invite_email(*, email: str, name: str = '') -> None:
    """Notify a newly authorized user that they can sign in with Google."""
    display_name = (name or '').strip() or email
    login_url = settings.FRONTEND_URL.rstrip('/')
    subject = 'Invitation HolidayHub — votre compte est prêt'
    body = (
        f'Bonjour {display_name},\n\n'
        f'Un administrateur a créé votre compte HolidayHub pour l\'adresse {email}.\n\n'
        f'Vous pouvez vous connecter uniquement avec Google, en utilisant cet e-mail :\n'
        f'{login_url}\n\n'
        f'Si vous n\'êtes pas concerné(e), ignorez cet e-mail.\n\n'
        f'— L\'équipe HolidayHub'
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
