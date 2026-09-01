from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.email_delivery import send_branded_email


class Command(BaseCommand):
    help = 'Send a test email using the current SMTP configuration.'

    def add_arguments(self, parser):
        parser.add_argument(
            'recipient',
            nargs='?',
            default='',
            help='Recipient email address (defaults to EMAIL_HOST_USER)',
        )

    def handle(self, *args, **options):
        recipient = (options['recipient'] or settings.EMAIL_HOST_USER or '').strip()
        if not recipient:
            raise CommandError('Provide a recipient or set EMAIL_HOST_USER in the environment.')

        self.stdout.write(f'Backend: {settings.EMAIL_BACKEND}')
        self.stdout.write(f'Host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}')
        self.stdout.write(f'From: {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'To: {recipient}')

        try:
            sent = send_branded_email(
                subject='Gestion de congé — test SMTP',
                text_body='Si vous recevez cet e-mail, la configuration SMTP fonctionne.',
                to=[recipient],
            )
        except Exception as exc:
            raise CommandError(f'SMTP failed: {exc}') from exc

        if sent:
            self.stdout.write(self.style.SUCCESS('Test email sent successfully.'))
        else:
            raise CommandError('SMTP backend returned 0 (email not sent).')
