from django.db import migrations, models


LEGACY_PERIODS = ('morning', 'afternoon')
HALF = 'half'


def collapse_periods(apps, schema_editor):
    LeaveRequest = apps.get_model('core', 'LeaveRequest')
    LeaveRequestDay = apps.get_model('core', 'LeaveRequestDay')
    LeaveRequest.objects.filter(half_day_period__in=LEGACY_PERIODS).update(
        half_day_period=HALF
    )
    LeaveRequestDay.objects.filter(half_day_period__in=LEGACY_PERIODS).update(
        half_day_period=HALF
    )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_leaverequestday_half_day_period'),
    ]

    operations = [
        migrations.RunPython(collapse_periods, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='leaverequest',
            name='half_day_period',
            field=models.CharField(
                blank=True,
                choices=[('half', 'Demi-journée')],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='leaverequestday',
            name='half_day_period',
            field=models.CharField(
                blank=True,
                choices=[('half', 'Demi-journée')],
                max_length=20,
                null=True,
            ),
        ),
    ]
