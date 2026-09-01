from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from core.models import UserRole
from core.services import remove_leave_data_for_user


class Command(BaseCommand):
    help = 'Supprime les soldes et demandes de congé des comptes non employés (admin).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les comptes concernés sans supprimer les données.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        users = (
            User.objects.filter(
                is_active=True,
                profile__role=UserRole.ADMIN,
            )
            .select_related('profile')
            .order_by('first_name', 'last_name')
        )

        if not users.exists():
            self.stdout.write(self.style.SUCCESS('Aucun compte non employé à nettoyer.'))
            return

        for user in users:
            role = user.profile.role
            name = user.get_full_name() or user.username
            if dry_run:
                self.stdout.write(f'[dry-run] {name} <{user.email}> ({role})')
                continue
            remove_leave_data_for_user(user)
            self.stdout.write(self.style.SUCCESS(f'Nettoyé : {name} <{user.email}> ({role})'))

        if dry_run:
            self.stdout.write(self.style.WARNING('Aucune donnée supprimée (dry-run).'))
        else:
            self.stdout.write(self.style.SUCCESS('Nettoyage terminé.'))
