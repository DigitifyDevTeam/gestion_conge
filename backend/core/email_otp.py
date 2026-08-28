import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import EmailOTP, EmailOTPPurpose


OTP_LENGTH = 6
OTP_TTL_MINUTES = 15
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60


def _hash_code(code: str) -> str:
    pepper = settings.SECRET_KEY
    return hashlib.sha256(f'{pepper}:{code}'.encode()).hexdigest()


def generate_otp_code() -> str:
    return f'{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}'


def create_otp(email: str, purpose: str) -> tuple[EmailOTP, str]:
    email = email.lower().strip()
    latest = (
        EmailOTP.objects.filter(email=email, purpose=purpose, consumed_at__isnull=True)
        .order_by('-created_at')
        .first()
    )
    if latest and (timezone.now() - latest.created_at).total_seconds() < RESEND_COOLDOWN_SECONDS:
        wait = RESEND_COOLDOWN_SECONDS - int((timezone.now() - latest.created_at).total_seconds())
        raise ValidationError(
            {'detail': f'Veuillez patienter {wait}s avant de renvoyer un code.'}
        )

    # Invalidate previous unused codes for this email/purpose
    EmailOTP.objects.filter(
        email=email,
        purpose=purpose,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())

    code = generate_otp_code()
    otp = EmailOTP.objects.create(
        email=email,
        purpose=purpose,
        code_hash=_hash_code(code),
        expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    return otp, code


def verify_otp(email: str, purpose: str, code: str, *, consume: bool = True) -> EmailOTP:
    email = email.lower().strip()
    code = (code or '').strip()
    otp = (
        EmailOTP.objects.filter(email=email, purpose=purpose, consumed_at__isnull=True)
        .order_by('-created_at')
        .first()
    )
    if not otp:
        raise ValidationError({'code': 'Code invalide ou expiré.'})

    if otp.expires_at < timezone.now():
        otp.consumed_at = timezone.now()
        otp.save(update_fields=['consumed_at'])
        raise ValidationError({'code': 'Ce code a expiré. Demandez-en un nouveau.'})

    if otp.attempts >= MAX_ATTEMPTS:
        raise ValidationError({'code': 'Trop de tentatives. Demandez un nouveau code.'})

    if not secrets.compare_digest(otp.code_hash, _hash_code(code)):
        otp.attempts += 1
        otp.save(update_fields=['attempts'])
        remaining = MAX_ATTEMPTS - otp.attempts
        raise ValidationError(
            {'code': f'Code incorrect. {remaining} tentative(s) restante(s).'}
        )

    if consume:
        otp.consumed_at = timezone.now()
        otp.save(update_fields=['consumed_at'])
    return otp


def send_otp_email(*, email: str, code: str, purpose: str, name: str = '') -> None:
    display_name = name or email
    if purpose == EmailOTPPurpose.SIGNUP:
        subject = 'Confirmez votre compte HolidayHub'
        body = (
            f'Bonjour {display_name},\n\n'
            f'Merci de vous être inscrit sur HolidayHub.\n'
            f'Votre code de confirmation est : {code}\n\n'
            f'Ce code expire dans {OTP_TTL_MINUTES} minutes.\n'
            f'Si vous n\'avez pas créé de compte, ignorez cet e-mail.\n\n'
            f'— L\'équipe HolidayHub'
        )
    else:
        subject = 'Réinitialisation de votre mot de passe HolidayHub'
        body = (
            f'Bonjour {display_name},\n\n'
            f'Vous avez demandé à réinitialiser votre mot de passe.\n'
            f'Votre code de réinitialisation est : {code}\n\n'
            f'Ce code expire dans {OTP_TTL_MINUTES} minutes.\n'
            f'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet e-mail.\n\n'
            f'— L\'équipe HolidayHub'
        )

    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


def issue_and_send_otp(*, email: str, purpose: str, name: str = '') -> None:
    _, code = create_otp(email, purpose)
    send_otp_email(email=email, code=code, purpose=purpose, name=name)
