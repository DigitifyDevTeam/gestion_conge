from datetime import timedelta

from django.db import migrations, models
import django.db.models.deletion


def expand_days(request, holidays):
    if request.half_day_period:
        return [request.start_date]

    days = []
    current = request.start_date
    while current <= request.end_date:
        if current.weekday() < 5 and current not in holidays:
            days.append(current)
        current += timedelta(days=1)
    if days:
        return days

    # Legacy rows whose whole range fell on weekends/holidays keep their raw span.
    current = request.start_date
    while current <= request.end_date:
        days.append(current)
        current += timedelta(days=1)
    return days


def backfill_days(apps, schema_editor):
    LeaveRequest = apps.get_model('core', 'LeaveRequest')
    LeaveRequestDay = apps.get_model('core', 'LeaveRequestDay')
    PublicHoliday = apps.get_model('core', 'PublicHoliday')

    holidays = set(PublicHoliday.objects.values_list('date', flat=True))
    entries = []
    for request in LeaveRequest.objects.all().iterator():
        entries.extend(
            LeaveRequestDay(request=request, date=day)
            for day in expand_days(request, holidays)
        )
    LeaveRequestDay.objects.bulk_create(entries, batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_half_day_leave'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeaveRequestDay',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('date', models.DateField(db_index=True)),
                (
                    'request',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='day_entries',
                        to='core.leaverequest',
                    ),
                ),
            ],
            options={
                'ordering': ['date'],
                'unique_together': {('request', 'date')},
            },
        ),
        migrations.RunPython(backfill_days, migrations.RunPython.noop),
    ]
