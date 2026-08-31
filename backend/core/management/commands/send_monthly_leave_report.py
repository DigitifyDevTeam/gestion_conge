from datetime import date

from django.core.management.base import BaseCommand

from core.email_notifications import send_monthly_leave_report_email
from core.monthly_leave_report import build_monthly_leave_report


class Command(BaseCommand):
    help = 'Envoie le rapport mensuel des congés aux comptables.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            help='Année du rapport (défaut : mois précédent).',
        )
        parser.add_argument(
            '--month',
            type=int,
            help='Mois du rapport 1-12 (défaut : mois précédent).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche le résumé sans envoyer les e-mails.',
        )

    def handle(self, *args, **options):
        year = options['year']
        month = options['month']

        if year is None or month is None:
            today = date.today()
            if today.month == 1:
                year = year or today.year - 1
                month = month or 12
            else:
                year = year or today.year
                month = month or today.month - 1

        if month < 1 or month > 12:
            self.stderr.write(self.style.ERROR('Le mois doit être entre 1 et 12.'))
            return

        report = build_monthly_leave_report(year, month)

        self.stdout.write(
            f'Rapport {report.month_label} — '
            f'{report.total_requests} congé(s), '
            f'{report.total_days} jour(s), '
            f'{report.long_leave_count} absence(s) longue(s), '
            f'{len(report.holidays)} jour(s) férié(s).'
        )

        if options['dry_run']:
            for line in report.leave_lines:
                flag = ' [+5j]' if line.is_long else ''
                self.stdout.write(f'  - {line.narrative}{flag}')
            for holiday in report.holidays:
                self.stdout.write(f'  * Férié : {holiday.date_label} {holiday.name}')
            self.stdout.write(self.style.WARNING('Dry-run : aucun e-mail envoyé.'))
            return

        sent = send_monthly_leave_report_email(report=report)
        if sent:
            self.stdout.write(self.style.SUCCESS(f'{sent} e-mail(s) envoyé(s) aux comptables.'))
        else:
            self.stdout.write(
                self.style.WARNING(
                    'Aucun e-mail envoyé. Vérifiez la config SMTP et les utilisateurs comptables.'
                )
            )
