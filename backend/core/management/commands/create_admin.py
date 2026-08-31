from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from core.models import DEFAULT_LEAVE_ALLOCATIONS, EmployeeProfile, LeaveBalance, UserRole


class Command(BaseCommand):
    help = 'Create or reset an app admin account (production-safe)'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--password', required=True)
        parser.add_argument('--first-name', default='Admin')
        parser.add_argument('--last-name', default='Digitify')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        password = options['password']

        user, created = User.objects.update_or_create(
            username=email,
            defaults={
                'email': email,
                'first_name': options['first_name'],
                'last_name': options['last_name'],
                'is_active': True,
                'is_staff': True,
                'is_superuser': True,
            },
        )
        user.set_password(password)
        user.save()

        profile, _ = EmployeeProfile.objects.get_or_create(user=user)
        profile.role = UserRole.ADMIN
        profile.email_verified = True
        profile.department = profile.department or 'RH'
        profile.position = profile.position or 'Administrateur'
        profile.save()

        for leave_type, total in DEFAULT_LEAVE_ALLOCATIONS.items():
            LeaveBalance.objects.get_or_create(
                user=user,
                type=leave_type,
                defaults={'total': total, 'used': 0, 'pending': 0},
            )

        ok = user.check_password(password)
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Created' if created else 'Updated'} {email} (password check: {ok})"
            )
        )
