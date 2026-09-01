from datetime import date

from django.core.management.base import BaseCommand

from core.email_notifications import send_monthly_leave_report_email
from core.monthly_leave_report import (
    build_monthly_leave_report,
    is_last_day_of_month,
)


def resolve_report_period(
    *,
    today: date,
    year: int | None,
    month: int | None,
    scheduled: bool,
) -> tuple[int, int] | None:
    if scheduled:
        if not is_last_day_of_month(today):
            return None
        return today.year, today.month

    if year is not None and month is not None:
        return year, month

    if year is not None or month is not None:
        resolved_year = year or today.year
        resolved_month = month or today.month
        return resolved_year, resolved_month

    # Manual run without args: previous calendar month.
    if today.month == 1:
        return today.year - 1, 12
    return today.year, today.month - 1


class Command(BaseCommand):
    help = (
        'Envoie le rapport mensuel des congés (période : 1er → dernier jour du mois) '
        'à l\'adresse comptable configurée.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            help='Année du rapport (défaut : mois précédent, ou mois en cours avec --scheduled).',
        )
        parser.add_argument(
            '--month',
            type=int,
            help='Mois du rapport 1-12 (défaut : mois précédent, ou mois en cours avec --scheduled).',
        )
        parser.add_argument(
            '--scheduled',
            action='store_true',
            help='Envoi automatique : n\'envoie que le dernier jour du mois, pour le mois en cours.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche le résumé sans envoyer les e-mails.',
        )
        parser.add_argument(
            '--to',
            dest='recipient',
            default='',
            help='Destinataire optionnel (défaut : ACCOUNTANT_EMAIL).',
        )

    def handle(self, *args, **options):
        today = date.today()
        period = resolve_report_period(
            today=today,
            year=options['year'],
            month=options['month'],
            scheduled=options['scheduled'],
        )

        if period is None:
            self.stdout.write(
                self.style.WARNING(
                    f'Pas le dernier jour du mois ({today:%d/%m/%Y}) — envoi planifié ignoré.'
                )
            )
            return

        year, month = period

        if month < 1 or month > 12:
            self.stderr.write(self.style.ERROR('Le mois doit être entre 1 et 12.'))
            return

        report = build_monthly_leave_report(year, month)

        self.stdout.write(f'Période : {report.period_label}')
        self.stdout.write(
            f'Rapport {report.month_label} — '
            f'{report.total_requests} congé(s), '
            f'{report.total_days} jour(s), '
            f'{len(report.holidays)} jour(s) férié(s).'
        )

        if options['dry_run']:
            for line in report.leave_lines:
                self.stdout.write(
                    f'  - {line.employee_name} | {line.leave_type} | '
                    f'{line.days} | {line.dates_label}'
                )
            for holiday in report.holidays:
                self.stdout.write(f'  * Férié : {holiday.date_label} {holiday.name}')
            self.stdout.write(self.style.WARNING('Dry-run : aucun e-mail envoyé.'))
            return

        sent = send_monthly_leave_report_email(
            report=report,
            recipients=[options['recipient']] if options['recipient'] else None,
        )
        if sent:
            self.stdout.write(self.style.SUCCESS(f'{sent} e-mail(s) envoyé(s) (comptable + CC).'))
        else:
            self.stdout.write(
                self.style.WARNING(
                    'Aucun e-mail envoyé. Vérifiez la config SMTP et ACCOUNTANT_EMAIL.'
                )
            )
