from datetime import date, timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import (
    DEFAULT_LEAVE_ALLOCATIONS,
    EmployeeProfile,
    LeaveBalance,
    LeaveRequest,
    LeaveRequestDay,
    LeaveType,
    Notification,
    NotificationType,
    PublicHoliday,
    RequestStatus,
    UserRole,
)


def seed_days(request):
    current = request.start_date
    while current <= request.end_date:
        LeaveRequestDay.objects.get_or_create(request=request, date=current)
        current += timedelta(days=1)


DEMO_USERS = [
    {
        'email': 'admin@company.com',
        'first_name': 'Admin',
        'last_name': 'User',
        'role': UserRole.ADMIN,
        'department': 'HR',
        'position': 'HR Manager',
        'avatar': '',
    },
    {
        'email': 'sarah.johnson@company.com',
        'first_name': 'Sarah',
        'last_name': 'Johnson',
        'role': UserRole.EMPLOYEE,
        'department': 'Engineering',
        'position': 'Software Engineer',
        'avatar': '',
    },
    {
        'email': 'michael.chen@company.com',
        'first_name': 'Michael',
        'last_name': 'Chen',
        'role': UserRole.EMPLOYEE,
        'department': 'Engineering',
        'position': 'Tech Lead',
        'avatar': '',
    },
    {
        'email': 'emma.wilson@company.com',
        'first_name': 'Emma',
        'last_name': 'Wilson',
        'role': UserRole.EMPLOYEE,
        'department': 'Design',
        'position': 'Product Designer',
        'avatar': '',
    },
]

DEFAULT_BALANCES = DEFAULT_LEAVE_ALLOCATIONS

TUNISIAN_HOLIDAYS = [
    (date(2026, 1, 1), "Nouvel An", False),
    (date(2026, 3, 20), "Fête de l'Indépendance", False),
    (date(2026, 4, 9), "Journée des Martyrs", False),
    (date(2026, 5, 1), "Fête du Travail", False),
    (date(2026, 7, 25), "Fête de la République", False),
    (date(2026, 8, 13), "Fête de la Femme", False),
    (date(2026, 10, 15), "Fête de l'Évacuation", False),
]


class Command(BaseCommand):
    help = 'Seed demo users, balances, public holidays, and sample leave requests'

    def handle(self, *args, **options):
        users = {}
        for data in DEMO_USERS:
            user, created = User.objects.get_or_create(
                username=data['email'],
                defaults={
                    'email': data['email'],
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                    'is_staff': data['role'] == UserRole.ADMIN,
                    'is_superuser': data['role'] == UserRole.ADMIN,
                },
            )
            if created or True:
                user.email = data['email']
                user.first_name = data['first_name']
                user.last_name = data['last_name']
                user.set_password('password')
                user.is_staff = data['role'] == UserRole.ADMIN
                user.is_superuser = data['role'] == UserRole.ADMIN
                user.save()

            profile, _ = EmployeeProfile.objects.get_or_create(user=user)
            profile.role = data['role']
            profile.department = data['department']
            profile.position = data['position']
            profile.avatar = data['avatar']
            profile.email_verified = True
            profile.save()

            for leave_type, total in DEFAULT_BALANCES.items():
                balance, _ = LeaveBalance.objects.get_or_create(
                    user=user,
                    type=leave_type,
                    defaults={'total': total, 'used': 0, 'pending': 0},
                )
                if balance.total == 0 and total:
                    balance.total = total
                    balance.save(update_fields=['total'])

            users[data['email']] = user
            self.stdout.write(f"User ready: {data['email']}")

        for holiday_date, name, is_religious in TUNISIAN_HOLIDAYS:
            PublicHoliday.objects.update_or_create(
                date=holiday_date,
                defaults={'name': name, 'is_religious': is_religious},
            )
        self.stdout.write(f'Seeded {len(TUNISIAN_HOLIDAYS)} public holidays')

        sarah = users['sarah.johnson@company.com']
        admin = users['admin@company.com']
        today = date.today()

        if not LeaveRequest.objects.filter(employee=sarah).exists():
            pending = LeaveRequest.objects.create(
                employee=sarah,
                type=LeaveType.ANNUAL,
                start_date=today + timedelta(days=14),
                end_date=today + timedelta(days=18),
                days=5,
                status=RequestStatus.PENDING,
                reason='Family vacation',
            )
            seed_days(pending)
            bal = LeaveBalance.objects.get(user=sarah, type=LeaveType.ANNUAL)
            bal.pending += pending.days
            bal.save(update_fields=['pending'])

            approved = LeaveRequest.objects.create(
                employee=sarah,
                type=LeaveType.PERSONAL,
                start_date=today - timedelta(days=30),
                end_date=today - timedelta(days=29),
                days=2,
                status=RequestStatus.APPROVED,
                reason='Personal appointment',
                reviewed_by=admin,
                reviewed_at=timezone.now() - timedelta(days=35),
                review_comment='Approved',
            )
            seed_days(approved)
            bal_p = LeaveBalance.objects.get(user=sarah, type=LeaveType.PERSONAL)
            bal_p.used += approved.days
            bal_p.save(update_fields=['used'])
            self.stdout.write('Seeded sample leave requests for Sarah')

        if not Notification.objects.filter(user=sarah).exists():
            Notification.objects.create(
                user=sarah,
                title='Welcome to HolidayHub',
                message='Your leave balances have been initialized for the year.',
                type=NotificationType.INFO,
            )
            Notification.objects.create(
                user=sarah,
                title='Reminder',
                message='You have a pending leave request awaiting review.',
                type=NotificationType.REMINDER,
            )

        self.stdout.write(self.style.SUCCESS('Demo data seeded successfully.'))
