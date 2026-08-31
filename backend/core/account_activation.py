from django.contrib.auth.models import User
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from rest_framework.exceptions import ValidationError

ACTIVATION_MAX_AGE_SECONDS = 7 * 24 * 3600
_SIGNER = TimestampSigner(salt='holidayhub-account-activation')


def make_activation_token(user: User) -> str:
    return _SIGNER.sign(str(user.pk))


def resolve_activation_user(token: str) -> User:
    if not token:
        raise ValidationError({'token': 'Lien d\'activation manquant.'})

    try:
        user_id = _SIGNER.unsign(token, max_age=ACTIVATION_MAX_AGE_SECONDS)
    except SignatureExpired as exc:
        raise ValidationError(
            {'token': 'Ce lien a expiré. Demandez à un administrateur de renvoyer l\'invitation.'}
        ) from exc
    except BadSignature as exc:
        raise ValidationError({'token': 'Lien d\'activation invalide.'}) from exc

    user = User.objects.filter(pk=int(user_id)).select_related('profile').first()
    if not user:
        raise ValidationError({'token': 'Compte introuvable.'})

    profile = getattr(user, 'profile', None)
    if profile and profile.email_verified and user.is_active:
        raise ValidationError({'token': 'Ce compte est déjà activé. Connectez-vous.'})

    return user
