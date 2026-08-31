from datetime import timedelta

from django.db import migrations, models

MIN_LEAVE_NOTICE_DAYS = 5


def infer_emergency_from_dates(apps, schema_editor):
    LeaveRequest = apps.get_model('core', 'LeaveRequest')
    LeaveRequestDay = apps.get_model('core', 'LeaveRequestDay')
    for request in LeaveRequest.objects.all().iterator():
        first_day = (
            LeaveRequestDay.objects.filter(request_id=request.pk)
            .order_by('date')
            .first()
        )
        start = first_day.date if first_day else request.start_date
        submitted = request.created_at.date()
        if start < submitted + timedelta(days=MIN_LEAVE_NOTICE_DAYS):
            request.emergency = True
            request.save(update_fields=['emergency'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_half_day_period_only'),
    ]

    operations = [
        migrations.AddField(
            model_name='leaverequest',
            name='emergency',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(infer_emergency_from_dates, migrations.RunPython.noop),
    ]
