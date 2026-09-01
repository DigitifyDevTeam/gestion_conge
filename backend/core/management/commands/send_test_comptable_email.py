from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from core.email_notifications import send_monthly_leave_report_email
from core.monthly_leave_report import MonthlyHolidayLine, MonthlyLeaveLine, MonthlyLeaveReport


def build_sample_monthly_report() -> MonthlyLeaveReport:
    return MonthlyLeaveReport(
        year=2026,
        month=8,
        month_label='Août 2026 (test)',
        period_label='01/08/26 → 31/08/26',
        leave_lines=[
            MonthlyLeaveLine(
                employee_name='Jean Dupont',
                leave_type='Annuel',
                days=Decimal('3'),
                dates_label='12/08/26 → 14/08/26',
                is_long=False,
                reason='Vacances été',
                narrative='Jean Dupont a pris 3 jours (12/08/26 → 14/08/26).',
            ),
            MonthlyLeaveLine(
                employee_name='Marie Martin',
                leave_type='Sans solde',
                days=Decimal('6'),
                dates_label='05/08/26 → 12/08/26',
                is_long=False,
                reason='—',
                narrative='Marie Martin a pris 6 jours (05/08/26 → 12/08/26).',
            ),
        ],
        holidays=[
            MonthlyHolidayLine(
                name='Assomption',
                date_label='15/08/26',
                is_religious=True,
            ),
        ],
        total_days=Decimal('9'),
        total_requests=2,
        long_leave_count=0,
        employees_count=2,
    )


class Command(BaseCommand):
    help = 'Envoie un rapport mensuel de test (données fictives).'

    def add_arguments(self, parser):
        parser.add_argument(
            'recipient',
            nargs='?',
            default='a.alouini@digitify.fr',
            help='Destinataire du rapport de test (défaut : a.alouini@digitify.fr).',
        )

    def handle(self, *args, **options):
        recipient = (options['recipient'] or '').strip()
        if not recipient:
            raise CommandError('Indiquez une adresse e-mail destinataire.')

        report = build_sample_monthly_report()
        sent = send_monthly_leave_report_email(report=report, recipients=[recipient])

        if sent:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Rapport de test envoyé à {recipient} '
                    f'(CC : webdev@digitify.fr).'
                )
            )
        else:
            raise CommandError(
                'Échec d\'envoi. Vérifiez EMAIL_HOST_USER, EMAIL_HOST_PASSWORD et EMAIL_BACKEND.'
            )
