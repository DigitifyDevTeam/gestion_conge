from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from core.email_notifications import send_admin_alert_email
from core.models import UserRole


class Command(BaseCommand):
    help = (
        'Envoie un e-mail de test « demande de congé » à tous les administrateurs actifs '
        '(même format que création / modification / annulation employé).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--action',
            default='created',
            choices=['created', 'updated', 'cancelled', 'approved', 'rejected', 'deleted'],
            help='Type d’alerte congé à simuler (défaut : created).',
        )

    def handle(self, *args, **options):
        action = options['action']
        admins = list(
            User.objects.filter(
                is_active=True,
                profile__role=UserRole.ADMIN,
            )
            .exclude(email='')
            .values_list('email', flat=True)
        )
        if not admins:
            raise CommandError('Aucun administrateur actif avec e-mail trouvé en base.')

        action_messages = {
            'created': (
                'Nouvelle demande',
                'Azza Barhoumi a demandé 3 jours de congés annuels.',
            ),
            'updated': (
                'Demande modifiée',
                'Azza Barhoumi a modifié sa demande de congés annuels (3 jours).',
            ),
            'cancelled': (
                'Demande annulée',
                'Azza Barhoumi a annulé sa demande de congés annuels (3 jours).',
            ),
            'approved': (
                'Demande approuvée',
                'Admin Digitify a approuvé la demande de congés annuels de Azza Barhoumi (3 jours).',
            ),
            'rejected': (
                'Demande refusée',
                'Admin Digitify a refusé la demande de congé de Azza Barhoumi.',
            ),
            'deleted': (
                'Demande supprimée',
                'Admin Digitify a supprimé la demande de congés annuels de Azza Barhoumi (3 jours).',
            ),
        }
        title, message = action_messages[action]

        sent = send_admin_alert_email(
            subject=f'Gestion de congé — {title} (test)',
            title=title,
            message=message,
            action=action,
            category='leave_request',
            actor_name='Azza Barhoumi' if action in {'created', 'updated', 'cancelled'} else 'Admin Digitify',
            details=[
                ('Employé', 'Azza Barhoumi'),
                ('Type', 'congés annuels'),
                ('Durée', '3 jours'),
                ('Dates', '15/04/2026 → 17/04/2026'),
                ('Raison', 'Vacances'),
                ('Statut', 'En attente' if action == 'created' else 'Approuvée'),
            ],
            cta_path='/requests',
            cta_label='Voir les demandes',
        )

        if sent:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Alerte congé de test envoyée à {sent} admin(s) : {", ".join(admins)}'
                )
            )
        else:
            raise CommandError(
                'Échec d\'envoi. Vérifiez EMAIL_HOST_USER, EMAIL_HOST_PASSWORD et les logs serveur.'
            )
