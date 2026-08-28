from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

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
)

REQUESTABLE_LEAVE_TYPES = {LeaveType.ANNUAL, LeaveType.UNPAID}
MIN_LEAVE_DAYS = Decimal('0.5')
HALF_DAY = Decimal('0.5')


def get_or_create_balance(user, leave_type):
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


def _validate_leave_dates(entries):
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
):
    if leave_type not in REQUESTABLE_LEAVE_TYPES:
        raise ValidationError(
            {'type': 'Seuls les congés annuels et sans solde sont autorisés.'}
        )

    trimmed_reason = normalize_leave_reason(reason)

    selected, resolved_days = _validate_leave_dates(dates)
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
    )
    _sync_request_days(request, selected)
    balance.pending += resolved_days
    balance.save(update_fields=['pending'])
    return request


@transaction.atomic
def update_leave_request(
    request: LeaveRequest,
    *,
    leave_type,
    dates,
    reason='',
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
    selected, resolved_days = _validate_leave_dates(dates)
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
    request.save(
        update_fields=[
            'type',
            'start_date',
            'end_date',
            'days',
            'half_day_period',
            'reason',
        ]
    )
    _sync_request_days(request, selected)

    balance.pending += resolved_days
    balance.save(update_fields=['pending'])
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

    Notification.objects.create(
        user=request.employee,
        title='Leave request approved',
        message=f'Your {request.type} leave {describe_leave(request)} was approved.',
        type=NotificationType.SUCCESS,
    )
    return request


def reject_leave_request(request: LeaveRequest, reviewer, comment=''):
    if request.status != RequestStatus.PENDING:
        raise ValidationError({'status': 'Only pending requests can be rejected.'})

    release_pending(request)

    request.status = RequestStatus.REJECTED
    request.reviewed_by = reviewer
    request.reviewed_at = timezone.now()
    request.review_comment = comment or ''
    request.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_comment']
    )

    Notification.objects.create(
        user=request.employee,
        title='Leave request rejected',
        message=f'Your {request.type} leave {describe_leave(request)} was rejected.',
        type=NotificationType.INFO,
    )
    return request


def delete_leave_request(request: LeaveRequest):
    if request.status == RequestStatus.PENDING:
        release_pending(request)
    elif request.status == RequestStatus.APPROVED:
        balance = get_or_create_balance(request.employee, request.type)
        balance.used = max(balance.used - request.days, Decimal('0'))
        balance.save(update_fields=['used'])
    request.delete()
