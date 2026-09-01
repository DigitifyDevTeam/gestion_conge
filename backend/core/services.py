from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .email_notifications import send_admin_alert_email
from .permissions import can_have_leave
from .models import (
    DEFAULT_LEAVE_ALLOCATIONS,
    HalfDayPeriod,
    LeaveBalance,
    LeaveRequest,
    LeaveRequestDay,
    LeaveType,
    Notification,
    NotificationType,
    OTHER_LEAVE_REASON_PREFIX,
    PRESET_LEAVE_REASONS,
    PublicHoliday,
    RequestStatus,
    UserRole,
)

REQUESTABLE_LEAVE_TYPES = {LeaveType.ANNUAL, LeaveType.UNPAID}
MIN_LEAVE_DAYS = Decimal('0.5')
HALF_DAY = Decimal('0.5')
MIN_LEAVE_NOTICE_DAYS = 5

STATUS_FR = {
    RequestStatus.PENDING: 'En attente',
    RequestStatus.APPROVED: 'Approuvée',
    RequestStatus.REJECTED: 'Refusée',
}

ROLE_FR = {
    UserRole.EMPLOYEE: 'Employé',
    UserRole.ADMIN: 'Administrateur',
}

LEAVE_TYPE_FR = {
    LeaveType.ANNUAL: 'congés annuels',
    LeaveType.UNPAID: 'congés sans solde',
    LeaveType.SICK: 'congés maladie',
    LeaveType.PERSONAL: 'jour personnel',
}


def _person_name(user):
    full = (user.get_full_name() or '').strip()
    return full or user.username


def _leave_type_label(leave_type):
    return LEAVE_TYPE_FR.get(leave_type, leave_type)


def _days_label(value):
    number = Decimal(value)
    if number == number.to_integral_value():
        text = str(int(number))
    else:
        text = format(number, 'f').rstrip('0').rstrip('.').replace('.', ',')
    unit = 'jour' if number == 1 else 'jours'
    return f'{text} {unit}'


def notify_user(user, title, message, ntype=NotificationType.INFO):
    Notification.objects.create(
        user=user,
        title=title,
        message=message,
        type=ntype,
    )


def _format_date(value):
    return value.strftime('%d/%m/%Y')


def _leave_request_details(request: LeaveRequest) -> list[tuple[str, str]]:
    dates = request.dates
    if dates:
        if len(dates) == 1:
            dates_label = _format_date(dates[0])
        elif len(dates) <= 4:
            dates_label = ', '.join(_format_date(day) for day in dates)
        else:
            dates_label = (
                f'{_format_date(dates[0])} → {_format_date(dates[-1])} '
                f'({len(dates)} jours)'
            )
    else:
        dates_label = f'{_format_date(request.start_date)} → {_format_date(request.end_date)}'

    details = [
        ('Employé', _person_name(request.employee)),
        ('Type', _leave_type_label(request.type)),
        ('Durée', _days_label(request.days)),
        ('Dates', dates_label),
        ('Raison', request.reason or '—'),
        ('Statut', STATUS_FR.get(request.status, request.status)),
    ]
    if request.emergency:
        details.append(('Mode urgence', 'Oui'))
    return details


def notify_admins(
    title,
    message,
    ntype=NotificationType.INFO,
    exclude_user=None,
    *,
    email_action=None,
    email_category=None,
    email_actor=None,
    email_details=None,
    email_cta_path='/requests',
    email_subject=None,
):
    admins = User.objects.filter(
        is_active=True,
        profile__role=UserRole.ADMIN,
    )
    if exclude_user is not None:
        admins = admins.exclude(pk=exclude_user.pk)
    Notification.objects.bulk_create(
        [
            Notification(user=admin, title=title, message=message, type=ntype)
            for admin in admins
        ]
    )
    if email_action and email_category:
        actor_name = _person_name(email_actor) if email_actor else ''
        cta_label = 'Voir les demandes' if email_category == 'leave_request' else 'Ouvrir le tableau de bord'
        send_admin_alert_email(
            subject=email_subject or f'Gestion de congé — {title}',
            title=title,
            message=message,
            action=email_action,
            category=email_category,
            actor_name=actor_name,
            details=email_details,
            cta_path=email_cta_path,
            cta_label=cta_label,
            exclude_user=exclude_user,
        )


def ensure_employee_leave_balances(user):
    if not can_have_leave(user):
        return
    for leave_type, total in DEFAULT_LEAVE_ALLOCATIONS.items():
        LeaveBalance.objects.get_or_create(
            user=user,
            type=leave_type,
            defaults={
                'total': total,
                'used': 0,
                'pending': 0,
            },
        )


def remove_leave_data_for_user(user):
    LeaveRequest.objects.filter(employee=user).delete()
    LeaveBalance.objects.filter(user=user).delete()


def get_or_create_balance(user, leave_type):
    if not can_have_leave(user):
        raise ValidationError(
            {'employee': 'Seuls les employés peuvent avoir des congés.'}
        )
    balance, _ = LeaveBalance.objects.get_or_create(
        user=user,
        type=leave_type,
        defaults={
            'total': DEFAULT_LEAVE_ALLOCATIONS.get(leave_type, 0),
            'used': 0,
            'pending': 0,
        },
    )
    return balance


def assert_sufficient_balance(user, leave_type, days, extra_credit=None):
    balance = get_or_create_balance(user, leave_type)
    credit = extra_credit if extra_credit is not None else Decimal('0')
    available = balance.remaining + credit
    if available < days:
        raise ValidationError(
            {
                'days': (
                    f'Solde insuffisant ({leave_type}). '
                    f'Restant: {available}, demandé: {days}.'
                )
            }
        )
    return balance


def periods_conflict(existing_period, new_period):
    if not existing_period or not new_period:
        return True
    return existing_period == new_period


def assert_no_overlap(employee, entries, exclude_id=None):
    dates = [item['date'] for item in entries]
    wanted = {item['date']: item['half_day_period'] for item in entries}
    qs = LeaveRequestDay.objects.filter(
        request__employee=employee,
        date__in=dates,
    ).exclude(request__status=RequestStatus.REJECTED)
    if exclude_id:
        qs = qs.exclude(request_id=exclude_id)
    for entry in qs:
        if periods_conflict(entry.half_day_period, wanted[entry.date]):
            raise ValidationError(
                {
                    'dates': (
                        f'Le {entry.date.isoformat()} est déjà couvert par une autre '
                        'demande de congé (en attente ou approuvée).'
                    )
                }
            )


def _is_weekend(day: date) -> bool:
    return day.weekday() >= 5


def _holiday_dates(start_date, end_date):
    return set(
        PublicHoliday.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
        ).values_list('date', flat=True)
    )


def _is_working_day(day: date, holidays: set) -> bool:
    return (not _is_weekend(day)) and day not in holidays


def count_working_days(start_date, end_date) -> int:
    holidays = _holiday_dates(start_date, end_date)
    total = 0
    current = start_date
    while current <= end_date:
        if _is_working_day(current, holidays):
            total += 1
        current += timedelta(days=1)
    return total


def normalize_leave_reason(reason):
    trimmed = (reason or '').strip()
    if trimmed in PRESET_LEAVE_REASONS:
        return trimmed
    if trimmed.startswith(OTHER_LEAVE_REASON_PREFIX):
        detail = trimmed[len(OTHER_LEAVE_REASON_PREFIX):].strip()
        if not detail:
            raise ValidationError({'reason': 'Précisez la raison pour « Autre ».'})
        return f'{OTHER_LEAVE_REASON_PREFIX} {detail}'
    raise ValidationError(
        {
            'reason': (
                'Veuillez choisir une raison : Maladie, Vacances, Raisons familiales, '
                'Voyage, Événement personnel, ou Autre.'
            )
        }
    )


def _normalize_period(value):
    period = value or None
    if period == '':
        period = None
    if period in ('morning', 'afternoon'):
        period = HalfDayPeriod.HALF
    if period and period not in HalfDayPeriod.values:
        raise ValidationError({'dates': 'Une journée est entière ou en demi-journée.'})
    return period


def _validate_leave_dates(entries, *, emergency=False):
    if not entries:
        raise ValidationError({'dates': 'Sélectionnez au moins une journée.'})

    normalized = []
    seen = set()
    for item in entries:
        day = item['date']
        period = _normalize_period(item.get('half_day_period'))
        if day in seen:
            raise ValidationError({'dates': f'Le {day} est sélectionné deux fois.'})
        seen.add(day)
        normalized.append({'date': day, 'half_day_period': period})

    normalized.sort(key=lambda item: item['date'])
    today = date.today()
    if normalized[0]['date'] < today:
        raise ValidationError(
            {'dates': 'Les jours sélectionnés doivent être aujourd’hui ou dans le futur.'}
        )

    if not emergency:
        min_date = today + timedelta(days=MIN_LEAVE_NOTICE_DAYS)
        too_soon = [item['date'] for item in normalized if item['date'] < min_date]
        if too_soon:
            raise ValidationError(
                {
                    'dates': (
                        f'Un préavis de {MIN_LEAVE_NOTICE_DAYS} jours est requis '
                        f'(à partir du {min_date}). '
                        'Activez le mode urgence pour demander un congé immédiat.'
                    )
                }
            )

    holidays = _holiday_dates(normalized[0]['date'], normalized[-1]['date'])
    invalid = [
        item['date']
        for item in normalized
        if not _is_working_day(item['date'], holidays)
    ]
    if invalid:
        raise ValidationError(
            {
                'dates': (
                    'Les week-ends et jours fériés ne peuvent pas être sélectionnés '
                    f'({invalid[0]}).'
                )
            }
        )

    resolved_days = sum(
        (HALF_DAY if item['half_day_period'] else Decimal('1'))
        for item in normalized
    )
    resolved_days = resolved_days.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    if resolved_days < MIN_LEAVE_DAYS:
        raise ValidationError({'days': 'La durée minimale est de 0,5 jour.'})
    return normalized, resolved_days


def _request_level_period(entries):
    periods = {item['half_day_period'] for item in entries}
    if len(periods) == 1:
        return next(iter(periods))
    return None


def _sync_request_days(request, entries):
    request.day_entries.all().delete()
    LeaveRequestDay.objects.bulk_create(
        [
            LeaveRequestDay(
                request=request,
                date=item['date'],
                half_day_period=item['half_day_period'],
            )
            for item in entries
        ]
    )


@transaction.atomic
def create_leave_request(
    *,
    employee,
    leave_type,
    dates,
    reason='',
    emergency=False,
):
    if not can_have_leave(employee):
        raise ValidationError(
            {'employee': 'Seuls les employés peuvent avoir des congés.'}
        )

    if leave_type not in REQUESTABLE_LEAVE_TYPES:
        raise ValidationError(
            {'type': 'Seuls les congés annuels et sans solde sont autorisés.'}
        )

    trimmed_reason = normalize_leave_reason(reason)

    selected, resolved_days = _validate_leave_dates(dates, emergency=emergency)
    period = _request_level_period(selected)

    assert_no_overlap(employee, selected)
    balance = assert_sufficient_balance(employee, leave_type, resolved_days)

    request = LeaveRequest.objects.create(
        employee=employee,
        type=leave_type,
        start_date=selected[0]['date'],
        end_date=selected[-1]['date'],
        days=resolved_days,
        half_day_period=period,
        status=RequestStatus.PENDING,
        reason=trimmed_reason,
        emergency=emergency,
    )
    _sync_request_days(request, selected)
    balance.pending += resolved_days
    balance.save(update_fields=['pending'])
    type_label = _leave_type_label(leave_type)
    days_label = _days_label(resolved_days)
    notify_user(
        employee,
        'Demande soumise',
        f'Votre demande de {type_label} ({days_label}) a été envoyée pour approbation.',
        NotificationType.INFO,
    )
    notify_admins(
        'Nouvelle demande',
        f'{_person_name(employee)} a demandé {days_label} de {type_label}.',
        NotificationType.REMINDER,
        exclude_user=employee,
        email_action='created',
        email_category='leave_request',
        email_actor=employee,
        email_details=_leave_request_details(request),
        email_cta_path='/requests',
    )
    return request


@transaction.atomic
def update_leave_request(
    request: LeaveRequest,
    *,
    leave_type,
    dates,
    reason='',
    emergency=False,
):
    if request.status != RequestStatus.PENDING:
        raise ValidationError(
            {'status': 'Seules les demandes en attente peuvent être modifiées.'}
        )
    if leave_type not in REQUESTABLE_LEAVE_TYPES:
        raise ValidationError(
            {'type': 'Seuls les congés annuels et sans solde sont autorisés.'}
        )

    trimmed_reason = normalize_leave_reason(reason)
    selected, resolved_days = _validate_leave_dates(dates, emergency=emergency)
    period = _request_level_period(selected)
    assert_no_overlap(
        request.employee,
        selected,
        exclude_id=request.pk,
    )

    credit = request.days if request.type == leave_type else Decimal('0')
    balance = assert_sufficient_balance(
        request.employee,
        leave_type,
        resolved_days,
        extra_credit=credit,
    )
    release_pending(request)

    request.type = leave_type
    request.start_date = selected[0]['date']
    request.end_date = selected[-1]['date']
    request.days = resolved_days
    request.half_day_period = period
    request.reason = trimmed_reason
    request.emergency = emergency
    request.save(
        update_fields=[
            'type',
            'start_date',
            'end_date',
            'days',
            'half_day_period',
            'reason',
            'emergency',
        ]
    )
    _sync_request_days(request, selected)

    balance.pending += resolved_days
    balance.save(update_fields=['pending'])
    type_label = _leave_type_label(leave_type)
    days_label = _days_label(resolved_days)
    notify_admins(
        'Demande modifiée',
        f'{_person_name(request.employee)} a modifié sa demande de {type_label} ({days_label}).',
        NotificationType.REMINDER,
        exclude_user=request.employee,
        email_action='updated',
        email_category='leave_request',
        email_actor=request.employee,
        email_details=_leave_request_details(request),
        email_cta_path='/requests',
    )
    return request


def describe_leave(request: LeaveRequest) -> str:
    days = request.dates or [request.start_date]
    if len(days) == 1:
        return f'on {days[0]}'
    if days[-1] - days[0] == timedelta(days=len(days) - 1):
        return f'from {days[0]} to {days[-1]}'
    if len(days) <= 5:
        return 'on ' + ', '.join(str(day) for day in days)
    return f'{len(days)} days between {days[0]} and {days[-1]}'


def release_pending(request: LeaveRequest):
    balance = get_or_create_balance(request.employee, request.type)
    balance.pending = max(balance.pending - request.days, Decimal('0'))
    balance.save(update_fields=['pending'])


def approve_leave_request(request: LeaveRequest, reviewer, comment=''):
    if request.status != RequestStatus.PENDING:
        raise ValidationError({'status': 'Only pending requests can be approved.'})

    balance = get_or_create_balance(request.employee, request.type)
    balance.pending = max(balance.pending - request.days, Decimal('0'))
    balance.used += request.days
    balance.save(update_fields=['pending', 'used'])

    request.status = RequestStatus.APPROVED
    request.reviewed_by = reviewer
    request.reviewed_at = timezone.now()
    request.review_comment = comment or ''
    request.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_comment']
    )

    type_label = _leave_type_label(request.type)
    days_label = _days_label(request.days)
    notify_user(
        request.employee,
        'Demande approuvée',
        f'Votre demande de {type_label} ({days_label}) a été approuvée.',
        NotificationType.SUCCESS,
    )
    notify_admins(
        'Demande approuvée',
        f'{_person_name(reviewer)} a approuvé la demande de {type_label} de {_person_name(request.employee)} ({days_label}).',
        NotificationType.SUCCESS,
        exclude_user=reviewer,
        email_action='approved',
        email_category='leave_request',
        email_actor=reviewer,
        email_details=_leave_request_details(request),
        email_cta_path='/requests',
    )
    return request


def reject_leave_request(request: LeaveRequest, reviewer, comment=''):
    if request.status != RequestStatus.PENDING:
        raise ValidationError({'status': 'Only pending requests can be rejected.'})

    trimmed = (comment or '').strip()
    if not trimmed:
        raise ValidationError(
            {'review_comment': 'Indiquez la raison du refus pour que l’employé puisse la voir.'}
        )

    release_pending(request)

    request.status = RequestStatus.REJECTED
    request.reviewed_by = reviewer
    request.reviewed_at = timezone.now()
    request.review_comment = trimmed
    request.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_comment']
    )

    Notification.objects.create(
        user=request.employee,
        title='Demande refusée',
        message=f'Votre demande de congé a été refusée. Raison : {trimmed}',
        type=NotificationType.INFO,
    )
    notify_admins(
        'Demande refusée',
        f'{_person_name(reviewer)} a refusé la demande de congé de {_person_name(request.employee)}. Raison : {trimmed}',
        NotificationType.INFO,
        exclude_user=reviewer,
        email_action='rejected',
        email_category='leave_request',
        email_actor=reviewer,
        email_details=[
            *_leave_request_details(request),
            ('Commentaire', trimmed),
        ],
        email_cta_path='/requests',
    )
    return request


def delete_leave_request(request: LeaveRequest, *, actor=None):
    employee = request.employee
    leave_type = request.type
    days = request.days
    status = request.status
    type_label = _leave_type_label(leave_type)
    days_label = _days_label(days)
    actor_is_admin = (
        actor is not None
        and getattr(getattr(actor, 'profile', None), 'role', None) == UserRole.ADMIN
        and actor.pk != employee.pk
    )

    if status == RequestStatus.PENDING:
        release_pending(request)
    elif status == RequestStatus.APPROVED:
        balance = get_or_create_balance(employee, leave_type)
        balance.used = max(balance.used - request.days, Decimal('0'))
        balance.save(update_fields=['used'])
    request.delete()

    if actor_is_admin:
        notify_user(
            employee,
            'Demande supprimée',
            f'Votre demande de {type_label} ({days_label}) a été supprimée par un administrateur.',
            NotificationType.INFO,
        )
        notify_admins(
            'Demande supprimée',
            f'{_person_name(actor)} a supprimé la demande de {type_label} de {_person_name(employee)} ({days_label}).',
            NotificationType.INFO,
            exclude_user=actor,
            email_action='deleted',
            email_category='leave_request',
            email_actor=actor,
            email_details=[
                ('Employé', _person_name(employee)),
                ('Type', type_label),
                ('Durée', days_label),
                ('Statut précédent', status),
            ],
            email_cta_path='/requests',
        )
    elif status == RequestStatus.PENDING:
        notify_admins(
            'Demande annulée',
            f'{_person_name(employee)} a annulé sa demande de {type_label} ({days_label}).',
            NotificationType.INFO,
            exclude_user=employee,
            email_action='cancelled',
            email_category='leave_request',
            email_actor=employee,
            email_details=[
                ('Employé', _person_name(employee)),
                ('Type', type_label),
                ('Durée', days_label),
            ],
            email_cta_path='/requests',
        )
