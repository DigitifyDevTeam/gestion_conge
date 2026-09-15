from django.db import migrations, models
from django.utils import timezone


def seed_last_renewed_year(apps, schema_editor):
    """Mark existing annual balances as already renewed for the current year.

    Avoids an immediate mid-year re-allocation on deploy. The next automatic
    renewal runs on 1 January of the following year.
    """
    LeaveBalance = apps.get_model('core', 'LeaveBalance')
    year = timezone.localdate().year
    LeaveBalance.objects.filter(type='annual').update(last_renewed_year=year)


def unseed_last_renewed_year(apps, schema_editor):
    LeaveBalance = apps.get_model('core', 'LeaveBalance')
    LeaveBalance.objects.filter(type='annual').update(last_renewed_year=None)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_employeeprofile_calendar_color'),
    ]

    operations = [
        migrations.AddField(
            model_name='leavebalance',
            name='last_renewed_year',
            field=models.PositiveIntegerField(
                blank=True,
                help_text=(
                    'Année civile pour laquelle le solde annuel a déjà été renouvelé '
                    '(allocation + report des jours non utilisés).'
                ),
                null=True,
            ),
        ),
        migrations.RunPython(seed_last_renewed_year, unseed_last_renewed_year),
    ]
