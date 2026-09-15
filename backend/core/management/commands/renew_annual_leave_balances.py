from datetime import date

from django.core.management.base import BaseCommand

from core.services import renew_annual_leave_balances


class Command(BaseCommand):
    help = (
        'Renouvelle les soldes de congés annuels pour la nouvelle année : '
        'allocation annuelle (18) + jours non utilisés de la période précédente. '
        'Idempotent (ne renouvelle qu\'une fois par année civile).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            help='Année cible du renouvellement (défaut : année civile en cours).',
        )
        parser.add_argument(
            '--scheduled',
            action='store_true',
            help='Mode cron : n\'exécute que le 1er janvier (année en cours).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche le résultat sans modifier la base.',
        )

    def handle(self, *args, **options):
        today = date.today()
        year = options['year'] or today.year

        if options['scheduled']:
            if today.month != 1 or today.day != 1:
                self.stdout.write(
                    self.style.WARNING(
                        f'--scheduled : aujourd\'hui={today.isoformat()}, '
                        'rien à faire (renouvellement le 1er janvier).'
                    )
                )
                return
            year = today.year

        result = renew_annual_leave_balances(
            for_year=year,
            dry_run=options['dry_run'],
        )

        prefix = '[dry-run] ' if options['dry_run'] else ''
        self.stdout.write(
            self.style.SUCCESS(
                f'{prefix}Renouvellement {result["year"]} : '
                f'{result["renewed_count"]} employé(s).'
            )
        )
        for item in result['renewed']:
            self.stdout.write(
                f'  user={item["user_id"]} '
                f'total {item["previous_total"]} → {item["new_total"]} '
                f'(report={item["carried"]}, used était {item["previous_used"]}, '
                f'pending={item["previous_pending"]})'
            )
