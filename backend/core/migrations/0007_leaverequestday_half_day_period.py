from decimal import Decimal

from django.db import migrations, models


def backfill_periods(apps, schema_editor):
    LeaveRequestDay = apps.get_model('core', 'LeaveRequestDay')
    half = Decimal('0.5')
    for entry in LeaveRequestDay.objects.select_related('request').iterator():
        request = entry.request
        if request.half_day_period and request.days == half:
            entry.half_day_period = request.half_day_period
            entry.save(update_fields=['half_day_period'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_leaverequestday'),
    ]

    operations = [
        migrations.AddField(
            model_name='leaverequestday',
            name='half_day_period',
            field=models.CharField(
                blank=True,
                choices=[('morning', 'Matin'), ('afternoon', 'Après-midi')],
                max_length=20,
                null=True,
            ),
        ),
        migrations.RunPython(backfill_periods, migrations.RunPython.noop),
    ]
