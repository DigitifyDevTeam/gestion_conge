from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .email_notifications import send_admin_alert_email, send_employee_leave_decision_email
from .permissions import can_have_leave
from .models import (
    DEFAULT_LEAVE_ALLOCATIONS,
    DocumentCategory,
    EmployeeDocument,
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

REQUESTABLE_LEAVE_TYPES = {LeaveType.ANNUAL, LeaveType.UNPAID, LeaveType.SICK}
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


def _employee_leave_decision_details(request: LeaveRequest) -> list[tuple[str, str]]:
    """Leave details for the employee recipient (omit their own name)."""
    return [
        (label, value)
        for label, value in _leave_request_details(request)
        if label != 'Employé'
    ]


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


def _current_leave_year():
    return timezone.localdate().year


def ensure_employee_leave_balances(user):
    if not can_have_leave(user):
        return
    year = _current_leave_year()
    for leave_type, total in DEFAULT_LEAVE_ALLOCATIONS.items():
        defaults = {
            'total': total,
            'used': 0,
            'pending': 0,
        }
        if leave_type == LeaveType.ANNUAL:
            defaults['last_renewed_year'] = year
        LeaveBalance.objects.get_or_create(
            user=user,
            type=leave_type,
            defaults=defaults,
        )


def remove_leave_data_for_user(user):
    LeaveRequest.objects.filter(employee=user).delete()
    LeaveBalance.objects.filter(user=user).delete()
    for document in EmployeeDocument.objects.filter(employee=user):
        delete_employee_document(document)


def get_or_create_balance(user, leave_type):
    if not can_have_leave(user):
        raise ValidationError(
            {'employee': 'Seuls les employés peuvent avoir des congés.'}
        )
    defaults = {
        'total': DEFAULT_LEAVE_ALLOCATIONS.get(leave_type, 0),
        'used': 0,
        'pending': 0,
    }
    if leave_type == LeaveType.ANNUAL:
        defaults['last_renewed_year'] = _current_leave_year()
    balance, _ = LeaveBalance.objects.get_or_create(
        user=user,
        type=leave_type,
        defaults=defaults,
    )
    if leave_type == LeaveType.ANNUAL:
        renew_annual_balance_if_needed(balance)
        balance.refresh_from_db()
    return balance


def renew_annual_balance_if_needed(balance, *, for_year=None, dry_run=False):
    """
    Renew one annual balance for a new calendar year.

    Formula: total = yearly allocation (18) + unused days from previous period.
    Unused days = max(total - used, 0) — only accepted leave counts; pending
    is ignored (refused requests never become used, so they stay in the report).
    used is reset to 0; pending requests stay reserved.
    Idempotent via last_renewed_year.
    """
    if balance.type != LeaveType.ANNUAL:
        return None

    year = for_year or _current_leave_year()
    if balance.last_renewed_year is not None and balance.last_renewed_year >= year:
        return None

    yearly = Decimal(DEFAULT_LEAVE_ALLOCATIONS[LeaveType.ANNUAL])
    unused = balance.total - balance.used
    if unused < 0:
        unused = Decimal('0')

    new_total = yearly + unused
    result = {
        'user_id': balance.user_id,
        'year': year,
        'previous_total': balance.total,
        'previous_used': balance.used,
        'previous_pending': balance.pending,
        'carried': unused,
        'new_total': new_total,
    }

    if dry_run:
        return result

    balance.total = new_total
    balance.used = Decimal('0')
    balance.last_renewed_year = year
    balance.save(update_fields=['total', 'used', 'last_renewed_year'])
    return result


@transaction.atomic
def renew_annual_leave_balances(*, for_year=None, dry_run=False):
    """
    Renew annual leave for all employees who have not yet been renewed for for_year.

    new_total = 18 + unused days (total - used).
    """
    year = for_year or _current_leave_year()
    balances = (
        LeaveBalance.objects.select_for_update()
        .filter(
            type=LeaveType.ANNUAL,
            user__profile__role=UserRole.EMPLOYEE,
        )
        .filter(
            Q(last_renewed_year__isnull=True)
            | Q(last_renewed_year__lt=year)
        )
        .select_related('user')
    )

    renewed = []
    for balance in balances:
        result = renew_annual_balance_if_needed(
            balance,
            for_year=year,
            dry_run=dry_run,
        )
        if result:
            renewed.append(result)
    return {
        'year': year,
        'renewed_count': len(renewed),
        'renewed': renewed,
    }


def ensure_annual_leave_renewals():
    """Best-effort auto renewal when the calendar year has changed."""
    return renew_annual_leave_balances(for_year=_current_leave_year(), dry_run=False)


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


def normalize_leave_reason(reason, *, required=False):
    trimmed = (reason or '').strip()
    if not trimmed:
        if required:
            raise ValidationError(
                {
                    'reason': (
                        'La raison est obligatoire en mode urgence. '
                        'Choisissez Maladie, Vacances, Raisons familiales, '
                        'Voyage, Événement personnel, ou Autre.'
                    )
                }
            )
        return ''
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


def validate_leave_attachment(attachment, *, required=True):
    if attachment in (None, ''):
        if required:
            raise ValidationError(
                {'attachment': 'Une pièce jointe est obligatoire (justificatif).'}
            )
        return None

    name = getattr(attachment, 'name', '') or ''
    extension = Path(name).suffix.lower()
    allowed = getattr(
        settings,
        'LEAVE_ATTACHMENT_ALLOWED_EXTENSIONS',
        {'.pdf', '.png', '.jpg', '.jpeg', '.webp'},
    )
    if extension not in allowed:
        raise ValidationError(
            {
                'attachment': (
                    'Format non autorisé. Formats acceptés : PDF, PNG, JPG, JPEG, WEBP.'
                )
            }
        )

    max_bytes = getattr(settings, 'LEAVE_ATTACHMENT_MAX_BYTES', 5 * 1024 * 1024)
    size = getattr(attachment, 'size', None)
    if size is not None and size > max_bytes:
        raise ValidationError(
            {'attachment': 'La pièce jointe ne doit pas dépasser 5 Mo.'}
        )
    return attachment


def validate_employee_document_file(upload, *, required=True):
    if upload in (None, ''):
        if required:
            raise ValidationError({'file': 'Un fichier est obligatoire.'})
        return None

    name = getattr(upload, 'name', '') or ''
    extension = Path(name).suffix.lower()
    allowed = getattr(
        settings,
        'EMPLOYEE_DOCUMENT_ALLOWED_EXTENSIONS',
        {'.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'},
    )
    if extension not in allowed:
        raise ValidationError(
            {
                'file': (
                    'Format non autorisé. Formats acceptés : '
                    'PDF, PNG, JPG, JPEG, WEBP, DOC, DOCX.'
                )
            }
        )

    max_bytes = getattr(settings, 'EMPLOYEE_DOCUMENT_MAX_BYTES', 10 * 1024 * 1024)
    size = getattr(upload, 'size', None)
    if size is not None and size > max_bytes:
        raise ValidationError({'file': 'Le fichier ne doit pas dépasser 10 Mo.'})
    return upload


def _resolve_document_employee(employee_id):
    try:
        employee = User.objects.select_related('profile').get(pk=employee_id)
    except User.DoesNotExist as exc:
        raise ValidationError({'employee_id': 'Employé introuvable.'}) from exc
    if not can_have_leave(employee):
        raise ValidationError(
            {'employee_id': 'Les documents RH sont réservés aux comptes employés.'}
        )
    return employee


def create_employee_document(
    *,
    employee_id,
    title,
    category,
    description='',
    upload,
    uploaded_by=None,
):
    employee = _resolve_document_employee(employee_id)
    validated = validate_employee_document_file(upload, required=True)
    category_value = category or DocumentCategory.OTHER
    if category_value not in DocumentCategory.values:
        raise ValidationError({'category': 'Catégorie de document invalide.'})

    title_clean = (title or '').strip()
    if not title_clean:
        raise ValidationError({'title': 'Le titre est obligatoire.'})

    original_name = Path(getattr(validated, 'name', '') or '').name
    document = EmployeeDocument.objects.create(
        employee=employee,
        title=title_clean,
        category=category_value,
        description=(description or '').strip(),
        file=validated,
        original_name=original_name,
        uploaded_by=uploaded_by,
    )
    notify_user(
        employee,
        'Nouveau document disponible',
        f'Un document « {document.title} » a été ajouté à votre espace Mes documents.',
        ntype=NotificationType.INFO,
    )
    return document


def update_employee_document(
    document: EmployeeDocument,
    *,
    title=None,
    category=None,
    description=None,
    employee_id=None,
    upload=None,
):
    if employee_id is not None:
        document.employee = _resolve_document_employee(employee_id)

    if title is not None:
        title_clean = title.strip()
        if not title_clean:
            raise ValidationError({'title': 'Le titre est obligatoire.'})
        document.title = title_clean

    if category is not None:
        if category not in DocumentCategory.values:
            raise ValidationError({'category': 'Catégorie de document invalide.'})
        document.category = category

    if description is not None:
        document.description = description.strip()

    if upload not in (None, ''):
        validated = validate_employee_document_file(upload, required=True)
        old_file = document.file
        document.file = validated
        document.original_name = Path(getattr(validated, 'name', '') or '').name
        document.save()
        if old_file and old_file.name:
            old_file.delete(save=False)
        return document

    document.save()
    return document


def delete_employee_document(document: EmployeeDocument):
    file_field = document.file
    document.delete()
    if file_field and file_field.name:
        file_field.delete(save=False)


def _normalize_period(value):
    period = value or None
    if period == '':
        period = None
    if period in ('morning', 'afternoon'):
        period = HalfDayPeriod.HALF
    if period and period not in HalfDayPeriod.values:
        raise ValidationError({'dates': 'Une journée est entière ou en demi-journée.'})
    return period


def _validate_leave_dates(entries, *, emergency=False, allow_past=False):
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
    if not allow_past and normalized[0]['date'] < today:
        raise ValidationError(
            {'dates': 'Les jours sélectionnés doivent être aujourd’hui ou dans le futur.'}
        )

    if not emergency and not allow_past:
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
    allow_past=False,
    auto_approve=False,
    reviewer=None,
    attachment=None,
):
    if not can_have_leave(employee):
        raise ValidationError(
            {'employee': 'Seuls les employés peuvent avoir des congés.'}
        )

    if leave_type not in REQUESTABLE_LEAVE_TYPES:
        raise ValidationError(
            {'type': 'Seuls les congés annuels, maladie et sans solde sont autorisés.'}
        )

    # Admin backdated entries and sick leave skip the employee notice window.
    effective_emergency = emergency or allow_past
    skip_notice = effective_emergency or leave_type == LeaveType.SICK
    is_sick = leave_type == LeaveType.SICK
    trimmed_reason = normalize_leave_reason(
        '' if is_sick else reason,
        required=effective_emergency and not is_sick,
    )
    validated_attachment = (
        validate_leave_attachment(attachment, required=True) if is_sick else None
    )

    selected, resolved_days = _validate_leave_dates(
        dates,
        emergency=skip_notice,
        allow_past=allow_past,
    )
    period = _request_level_period(selected)

    assert_no_overlap(employee, selected)
    balance = assert_sufficient_balance(employee, leave_type, resolved_days)

    type_label = _leave_type_label(leave_type)
    days_label = _days_label(resolved_days)

    if auto_approve:
        if reviewer is None:
            raise ValidationError({'reviewer': 'Un administrateur est requis pour valider.'})
        request = LeaveRequest.objects.create(
            employee=employee,
            type=leave_type,
            start_date=selected[0]['date'],
            end_date=selected[-1]['date'],
            days=resolved_days,
            half_day_period=period,
            status=RequestStatus.APPROVED,
            reason=trimmed_reason,
            emergency=effective_emergency,
            attachment=validated_attachment,
            reviewed_by=reviewer,
            reviewed_at=timezone.now(),
            review_comment='Saisie administrative',
        )
        _sync_request_days(request, selected)
        balance.used += resolved_days
        balance.save(update_fields=['used'])
        notify_user(
            employee,
            'Demande approuvée',
            (
                f'Une demande de {type_label} ({days_label}) a été saisie et approuvée '
                f'par {_person_name(reviewer)}.'
            ),
            NotificationType.SUCCESS,
        )
        send_employee_leave_decision_email(
            recipient_email=employee.email,
            subject='Gestion de congé — Demande approuvée',
            title='Demande approuvée',
            message=(
                f'Une demande de {type_label} ({days_label}) a été saisie et approuvée '
                f'par {_person_name(reviewer)}.'
            ),
            action='approved',
            actor_name=_person_name(reviewer),
            details=_employee_leave_decision_details(request),
        )
        notify_admins(
            'Demande saisie par un admin',
            (
                f'{_person_name(reviewer)} a saisi et approuvé {days_label} de {type_label} '
                f'pour {_person_name(employee)}.'
            ),
            NotificationType.SUCCESS,
            exclude_user=reviewer,
            email_action='approved',
            email_category='leave_request',
            email_actor=reviewer,
            email_details=_leave_request_details(request),
            email_cta_path='/requests',
        )
        return request

    request = LeaveRequest.objects.create(
        employee=employee,
        type=leave_type,
        start_date=selected[0]['date'],
        end_date=selected[-1]['date'],
        days=resolved_days,
        half_day_period=period,
        status=RequestStatus.PENDING,
        reason=trimmed_reason,
        emergency=effective_emergency,
        attachment=validated_attachment,
    )
    _sync_request_days(request, selected)
    balance.pending += resolved_days
    balance.save(update_fields=['pending'])
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
    attachment=None,
):
    if request.status != RequestStatus.PENDING:
        raise ValidationError(
            {'status': 'Seules les demandes en attente peuvent être modifiées.'}
        )
    if leave_type not in REQUESTABLE_LEAVE_TYPES:
        raise ValidationError(
            {'type': 'Seuls les congés annuels, maladie et sans solde sont autorisés.'}
        )

    is_sick = leave_type == LeaveType.SICK
    trimmed_reason = normalize_leave_reason(
        '' if is_sick else reason,
        required=emergency and not is_sick,
    )
    has_existing_attachment = bool(request.attachment)
    if is_sick:
        validated_attachment = validate_leave_attachment(
            attachment,
            required=not has_existing_attachment,
        )
        clear_attachment = False
    else:
        validated_attachment = None
        clear_attachment = has_existing_attachment
    skip_notice = emergency or is_sick
    selected, resolved_days = _validate_leave_dates(dates, emergency=skip_notice)
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
    update_fields = [
        'type',
        'start_date',
        'end_date',
        'days',
        'half_day_period',
        'reason',
        'emergency',
    ]
    if validated_attachment is not None:
        request.attachment = validated_attachment
        update_fields.append('attachment')
    elif clear_attachment:
        request.attachment = None
        update_fields.append('attachment')
    request.save(update_fields=update_fields)
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
    employee_message = (
        f'Votre demande de {type_label} ({days_label}) a été approuvée.'
    )
    notify_user(
        request.employee,
        'Demande approuvée',
        employee_message,
        NotificationType.SUCCESS,
    )
    send_employee_leave_decision_email(
        recipient_email=request.employee.email,
        subject='Gestion de congé — Demande approuvée',
        title='Demande approuvée',
        message=employee_message,
        action='approved',
        actor_name=_person_name(reviewer),
        details=_employee_leave_decision_details(request),
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

    employee_message = (
        f'Votre demande de congé a été refusée. Raison : {trimmed}'
    )
    Notification.objects.create(
        user=request.employee,
        title='Demande refusée',
        message=employee_message,
        type=NotificationType.INFO,
    )
    send_employee_leave_decision_email(
        recipient_email=request.employee.email,
        subject='Gestion de congé — Demande refusée',
        title='Demande refusée',
        message=employee_message,
        action='rejected',
        actor_name=_person_name(reviewer),
        details=[
            *_employee_leave_decision_details(request),
            ('Commentaire', trimmed),
        ],
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
