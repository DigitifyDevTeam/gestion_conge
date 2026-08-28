from decimal import Decimal

from django.conf import settings
from django.db import models


class LeaveType(models.TextChoices):
    ANNUAL = 'annual', 'Annual'
    SICK = 'sick', 'Sick'
    PERSONAL = 'personal', 'Personal'
    UNPAID = 'unpaid', 'Unpaid'


DEFAULT_LEAVE_ALLOCATIONS = {
    LeaveType.ANNUAL: 18,
    LeaveType.SICK: 10,
    LeaveType.PERSONAL: 5,
    LeaveType.UNPAID: 0,
}


class HalfDayPeriod(models.TextChoices):
    HALF = 'half', 'Demi-journée'


PRESET_LEAVE_REASONS = (
    'Maladie',
    'Vacances',
    'Raisons familiales',
    'Voyage',
    'Événement personnel',
)
OTHER_LEAVE_REASON_PREFIX = 'Autre :'


class RequestStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class UserRole(models.TextChoices):
    EMPLOYEE = 'employee', 'Employee'
    ADMIN = 'admin', 'Admin'


class NotificationType(models.TextChoices):
    SUCCESS = 'success', 'Success'
    INFO = 'info', 'Info'
    REMINDER = 'reminder', 'Reminder'


class EmployeeProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
    )
    department = models.CharField(max_length=120, blank=True, default='')
    position = models.CharField(max_length=120, blank=True, default='')
    avatar = models.URLField(max_length=500, blank=True, default='')
    email_verified = models.BooleanField(default=False)
    google_sub = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text='Google account subject (sub) claim',
    )

    def __str__(self):
        return f'{self.user.get_full_name() or self.user.username} ({self.role})'


class EmailOTPPurpose(models.TextChoices):
    SIGNUP = 'signup', 'Signup verification'
    RESET = 'reset', 'Password reset'


class EmailOTP(models.Model):
    email = models.EmailField(db_index=True)
    purpose = models.CharField(max_length=20, choices=EmailOTPPurpose.choices)
    code_hash = models.CharField(max_length=128)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'purpose']),
        ]

    def __str__(self):
        return f'{self.email} ({self.purpose})'


class LeaveBalance(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='leave_balances',
    )
    type = models.CharField(max_length=20, choices=LeaveType.choices)
    total = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    used = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    pending = models.DecimalField(max_digits=6, decimal_places=1, default=0)

    class Meta:
        unique_together = ('user', 'type')
        ordering = ['type']

    @property
    def remaining(self):
        remaining = self.total - self.used - self.pending
        return remaining if remaining > 0 else Decimal('0')

    def __str__(self):
        return f'{self.user_id} {self.type}: {self.remaining} remaining'


class LeaveRequest(models.Model):
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='leave_requests',
    )
    type = models.CharField(max_length=20, choices=LeaveType.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.DecimalField(max_digits=6, decimal_places=1)
    half_day_period = models.CharField(
        max_length=20,
        choices=HalfDayPeriod.choices,
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=20,
        choices=RequestStatus.choices,
        default=RequestStatus.PENDING,
    )
    reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_leave_requests',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    @property
    def dates(self):
        return [entry.date for entry in self.day_entries.all()]

    @property
    def day_payload(self):
        return [
            {'date': entry.date, 'half_day_period': entry.half_day_period}
            for entry in self.day_entries.all()
        ]

    def __str__(self):
        return f'{self.employee_id} {self.type} {self.start_date}→{self.end_date} ({self.status})'


class LeaveRequestDay(models.Model):
    """One concrete day of a leave request; days need not be consecutive."""

    request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name='day_entries',
    )
    date = models.DateField(db_index=True)
    half_day_period = models.CharField(
        max_length=20,
        choices=HalfDayPeriod.choices,
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ['date']
        unique_together = ('request', 'date')

    def __str__(self):
        period = self.half_day_period or 'full'
        return f'{self.request_id} @ {self.date} ({period})'


class PublicHoliday(models.Model):
    date = models.DateField(unique=True)
    name = models.CharField(max_length=200)
    is_religious = models.BooleanField(default=False)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f'{self.name} ({self.date})'


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.INFO,
    )
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} → {self.user_id}'
