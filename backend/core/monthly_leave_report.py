from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User

from .models import HalfDayPeriod, LeaveRequest, PublicHoliday, RequestStatus

MONTH_NAMES_FR = {
    1: 'janvier',
    2: 'février',
    3: 'mars',
    4: 'avril',
    5: 'mai',
    6: 'juin',
    7: 'juillet',
    8: 'août',
    9: 'septembre',
    10: 'octobre',
    11: 'novembre',
    12: 'décembre',
}

LEAVE_TYPE_FR = {
    'annual': 'Annuel',
    'unpaid': 'Sans solde',
}

LONG_LEAVE_THRESHOLD = Decimal('5')


@dataclass
class MonthlyLeaveLine:
    employee_name: str
    leave_type: str
    days: Decimal
    dates_label: str
    is_long: bool
    reason: str
    narrative: str


@dataclass
class MonthlyHolidayLine:
    name: str
    date_label: str
    is_religious: bool


@dataclass
class MonthlyLeaveReport:
    year: int
    month: int
    month_label: str
    period_label: str
    leave_lines: list[MonthlyLeaveLine]
    holidays: list[MonthlyHolidayLine]
    total_days: Decimal
    total_requests: int
    long_leave_count: int
    employees_count: int

    @property
    def has_activity(self) -> bool:
        return bool(self.leave_lines) or bool(self.holidays)


def _person_name(user) -> str:
    full = (user.get_full_name() or '').strip()
    return full or user.username


def _format_date(value: date) -> str:
    return value.strftime('%d/%m/%y')


def _format_days(value: Decimal) -> str:
    number = Decimal(value)
    if number == number.to_integral_value():
        text = str(int(number))
    else:
        text = format(number, 'f').rstrip('0').rstrip('.').replace('.', ',')
    unit = 'jour' if number == 1 else 'jours'
    return f'{text} {unit}'


def _dates_label(days_in_month: list) -> str:
    if not days_in_month:
        return '—'
    if len(days_in_month) == 1:
        return _format_date(days_in_month[0].date)

    sorted_days = sorted(days_in_month, key=lambda entry: entry.date)
    dates = [entry.date for entry in sorted_days]
    if dates[-1] - dates[0] == timedelta(days=len(dates) - 1):
        if dates[0] == dates[-1]:
            return _format_date(dates[0])
        return f'{_format_date(dates[0])} → {_format_date(dates[-1])}'

    if len(dates) <= 4:
        return ', '.join(_format_date(day) for day in dates)
    return f'{_format_date(dates[0])} → {_format_date(dates[-1])} ({len(dates)} jours)'


def _count_days_in_month(day_entries) -> Decimal:
    total = Decimal('0')
    for entry in day_entries:
        if entry.half_day_period:
            total += Decimal('0.5')
        else:
            total += Decimal('1')
    return total


def _build_narrative(employee_name: str, days: Decimal, dates_label: str, is_long: bool) -> str:
    days_text = _format_days(days)
    if is_long:
        return (
            f'{employee_name} a pris {days_text} ({dates_label}) '
            f'— absence longue (+{int(LONG_LEAVE_THRESHOLD)} jours).'
        )
    if days == Decimal('1') or days == Decimal('0.5'):
        return f'{employee_name} a pris {days_text} le {dates_label}.'
    return f'{employee_name} a pris {days_text} ({dates_label}).'


def build_monthly_leave_report(year: int, month: int) -> MonthlyLeaveReport:
    period_start = date(year, month, 1)
    period_end = date(year, month, monthrange(year, month)[1])

    leave_requests = (
        LeaveRequest.objects.filter(
            status=RequestStatus.APPROVED,
            day_entries__date__gte=period_start,
            day_entries__date__lte=period_end,
        )
        .select_related('employee', 'employee__profile')
        .prefetch_related('day_entries')
        .distinct()
        .order_by('employee__first_name', 'employee__last_name', 'start_date')
    )

    leave_lines: list[MonthlyLeaveLine] = []
    total_days = Decimal('0')
    employee_ids: set[int] = set()

    for request in leave_requests:
        days_in_month = [
            entry
            for entry in request.day_entries.all()
            if period_start <= entry.date <= period_end
        ]
        if not days_in_month:
            continue

        days = _count_days_in_month(days_in_month)
        dates_label = _dates_label(days_in_month)
        is_long = days > LONG_LEAVE_THRESHOLD
        employee_name = _person_name(request.employee)
        leave_type = LEAVE_TYPE_FR.get(request.type, request.type)

        leave_lines.append(
            MonthlyLeaveLine(
                employee_name=employee_name,
                leave_type=leave_type,
                days=days,
                dates_label=dates_label,
                is_long=is_long,
                reason=request.reason or '—',
                narrative=_build_narrative(employee_name, days, dates_label, is_long),
            )
        )
        total_days += days
        employee_ids.add(request.employee_id)

    holidays_qs = PublicHoliday.objects.filter(
        date__gte=period_start,
        date__lte=period_end,
    ).order_by('date')

    holidays = [
        MonthlyHolidayLine(
            name=holiday.name,
            date_label=_format_date(holiday.date),
            is_religious=holiday.is_religious,
        )
        for holiday in holidays_qs
    ]

    month_label = f'{MONTH_NAMES_FR[month]} {year}'.capitalize()
    period_label = f'{_format_date(period_start)} → {_format_date(period_end)}'

    return MonthlyLeaveReport(
        year=year,
        month=month,
        month_label=month_label,
        period_label=period_label,
        leave_lines=leave_lines,
        holidays=holidays,
        total_days=total_days,
        total_requests=len(leave_lines),
        long_leave_count=sum(1 for line in leave_lines if line.is_long),
        employees_count=len(employee_ids),
    )


def monthly_report_recipients() -> list[str]:
    return list(getattr(settings, 'ACCOUNTANT_EMAIL', []))
