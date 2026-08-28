from django.conf import settings
from django.contrib.auth.models import User
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import DEFAULT_LEAVE_ALLOCATIONS, EmployeeProfile, LeaveBalance, UserRole
from .serializers import MeSerializer


def verify_google_id_token(token: str) -> dict:
    client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    if not client_id:
        raise ValidationError({'detail': 'Google OAuth n\'est pas configuré sur le serveur.'})

    try:
        payload = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
        )
    except ValueError as exc:
        raise AuthenticationFailed({'detail': 'Jeton Google invalide ou expiré.'}) from exc

    if payload.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
        raise AuthenticationFailed({'detail': 'Émetteur Google invalide.'})

    if not payload.get('email'):
        raise AuthenticationFailed({'detail': 'L\'e-mail Google est requis.'})

    if not payload.get('email_verified'):
        raise AuthenticationFailed({'detail': 'L\'e-mail Google n\'est pas vérifié.'})

    return payload


def _split_name(full_name: str) -> tuple[str, str]:
    parts = (full_name or '').strip().split(None, 1)
    if not parts:
        return '', ''
    if len(parts) == 1:
        return parts[0], ''
    return parts[0], parts[1]


def _ensure_balances(user: User) -> None:
    for leave_type, total in DEFAULT_LEAVE_ALLOCATIONS.items():
        LeaveBalance.objects.get_or_create(
            user=user,
            type=leave_type,
            defaults={'total': total, 'used': 0, 'pending': 0},
        )


def get_authorized_user_from_google(payload: dict) -> User:
    """Sign in via Google only if an admin already created this email."""
    email = payload['email'].lower().strip()
    sub = payload.get('sub') or ''
    full_name = payload.get('name') or ''
    picture = (payload.get('picture') or '')[:500]
    first_name, last_name = _split_name(full_name)

    user = None
    if sub:
        profile = (
            EmployeeProfile.objects.select_related('user')
            .filter(google_sub=sub)
            .first()
        )
        if profile:
            user = profile.user

    if user is None:
        user = User.objects.filter(email__iexact=email).first()

    if user is None:
        raise PermissionDenied(
            'Cet e-mail n\'est pas autorisé. Un administrateur doit d\'abord '
            'créer votre compte avant que vous puissiez vous connecter.'
        )

    if not user.is_active:
        raise PermissionDenied('Ce compte est désactivé. Contactez un administrateur.')

    # Link / refresh existing authorized account (never create new users here)
    changed = False
    if first_name and not user.first_name:
        user.first_name = first_name
        changed = True
    if last_name and not user.last_name:
        user.last_name = last_name
        changed = True
    if changed:
        user.save()

    profile, _ = EmployeeProfile.objects.get_or_create(
        user=user,
        defaults={
            'role': UserRole.EMPLOYEE,
            'email_verified': True,
            'google_sub': sub or None,
            'avatar': picture,
        },
    )
    profile.email_verified = True
    if sub and not profile.google_sub:
        profile.google_sub = sub
    if picture and not profile.avatar:
        profile.avatar = picture
    profile.save()
    _ensure_balances(user)
    return user


def issue_tokens_for_user(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': MeSerializer(user).data,
    }
