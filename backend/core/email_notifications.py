import logging
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.template.loader import render_to_string
from django.utils import timezone

from .email_delivery import send_branded_email
from .models import UserRole

logger = logging.getLogger(__name__)

ACTION_LABELS = {
    'created': 'Création',
    'updated': 'Modification',
    'deleted': 'Suppression',
    'approved': 'Approbation',
    'rejected': 'Refus',
    'cancelled': 'Annulation',
}

CATEGORY_LABELS = {
    'leave_request': 'Demande de congé',
    'public_holiday': 'Jour férié',
    'user': 'Utilisateur',
    'leave_balance': 'Solde de congés',
}

ACTION_STYLES = {
    'created': ('#ecfdf5', '#059669'),
    'updated': ('#eff6ff', '#2563eb'),
    'deleted': ('#fef2f2', '#dc2626'),
    'approved': ('#ecfdf5', '#059669'),
    'rejected': ('#fef2f2', '#dc2626'),
    'cancelled': ('#fffbeb', '#d97706'),
}


def _format_timestamp() -> str:
    now = timezone.localtime(timezone.now())
    return now.strftime('%d/%m/%Y à %H:%M')


def _admin_recipients(exclude_user=None) -> list[str]:
    qs = User.objects.filter(
        is_active=True,
        profile__role=UserRole.ADMIN,
    ).exclude(email='')
    if exclude_user is not None:
        qs = qs.exclude(pk=exclude_user.pk)
    return list(qs.values_list('email', flat=True))


def _build_badge(action: str, category: str) -> str:
    action_label = ACTION_LABELS.get(action, action)
    category_label = CATEGORY_LABELS.get(category, category)
    return f'{category_label} — {action_label}'


def send_admin_alert_email(
    *,
    subject: str,
    title: str,
    message: str,
    action: str,
    category: str,
    actor_name: str = '',
    details: list[tuple[str, str]] | None = None,
    cta_path: str = '/',
    cta_label: str = 'Ouvrir le tableau de bord',
    exclude_user=None,
) -> int:
    """Send a branded HTML alert to all active admins. Returns emails sent count."""
    if not settings.EMAIL_HOST_USER:
        logger.warning(
            'Admin alert email skipped (%s / %s): EMAIL_HOST_USER is not configured.',
            category,
            action,
        )
        return 0

    recipients = _admin_recipients(exclude_user=exclude_user)
    if not recipients:
        logger.warning(
            'Admin alert email skipped (%s / %s): no active admin recipients found.',
            category,
            action,
        )
        return 0

    badge_bg, badge_color = ACTION_STYLES.get(action, ('#f3f4f6', '#374151'))
    frontend = settings.FRONTEND_URL.rstrip('/')
    cta_url = f'{frontend}{cta_path}' if cta_path else ''

    context = {
        'subject': subject,
        'title': title,
        'message': message,
        'badge_label': _build_badge(action, category),
        'badge_bg': badge_bg,
        'badge_color': badge_color,
        'actor_name': actor_name,
        'details': details or [],
        'cta_url': cta_url,
        'cta_label': cta_label,
        'timestamp': _format_timestamp(),
        'year': datetime.now().year,
    }

    html_body = render_to_string('emails/admin_alert.html', context)
    text_body = render_to_string('emails/admin_alert.txt', context)

    sent = 0
    for recipient in recipients:
        try:
            if send_branded_email(
                subject=subject,
                text_body=text_body,
                html_body=html_body,
                to=[recipient],
            ):
                sent += 1
        except Exception:
            logger.exception('Failed to send admin alert email to %s', recipient)

    if sent:
        logger.info(
            'Admin alert email sent (%s / %s) to %d admin(s): %s',
            category,
            action,
            sent,
            ', '.join(recipients),
        )
    else:
        logger.warning(
            'Admin alert email failed (%s / %s) for recipients: %s',
            category,
            action,
            ', '.join(recipients),
        )
    return sent


def _format_days_display(value) -> str:
    from decimal import Decimal

    number = Decimal(value)
    if number == number.to_integral_value():
        text = str(int(number))
    else:
        text = format(number, 'f').rstrip('0').rstrip('.').replace('.', ',')
    return text


def send_monthly_leave_report_email(*, report, recipients: list[str] | None = None) -> int:
    """Send the monthly leave report to the configured accountant email."""
    if not settings.EMAIL_HOST_USER:
        return 0

    if recipients is None:
        from .monthly_leave_report import monthly_report_recipients

        recipients = monthly_report_recipients()
    if not recipients:
        logger.warning(
            'No monthly report recipient configured (set ACCOUNTANT_EMAIL).'
        )
        return 0

    subject = f'Gestion de congé — Rapport mensuel des congés ({report.month_label})'

    leave_lines = [
        {
            'employee_name': line.employee_name,
            'leave_type': line.leave_type,
            'days_display': _format_days_display(line.days),
            'dates_label': line.dates_label,
        }
        for line in report.leave_lines
    ]
    holidays = [
        {
            'name': holiday.name,
            'date_label': holiday.date_label,
            'is_religious': holiday.is_religious,
        }
        for holiday in report.holidays
    ]

    context = {
        'subject': subject,
        'month_label': report.month_label,
        'period_label': report.period_label,
        'employees_count': report.employees_count,
        'total_requests': report.total_requests,
        'total_days_display': _format_days_display(report.total_days),
        'leave_lines': leave_lines,
        'holidays': holidays,
        'generated_at': _format_timestamp(),
        'year': datetime.now().year,
    }

    html_body = render_to_string('emails/monthly_leave_report.html', context)
    text_body = render_to_string('emails/monthly_leave_report.txt', context)

    sent = 0
    for recipient in recipients:
        try:
            if send_branded_email(
                subject=subject,
                text_body=text_body,
                html_body=html_body,
                to=[recipient],
            ):
                sent += 1
        except Exception:
            logger.exception('Failed to send monthly report to %s', recipient)
    return sent
