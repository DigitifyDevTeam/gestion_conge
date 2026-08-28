from django.db import migrations


ANNUAL_ALLOCATION = 18


def set_annual_leave_to_18(apps, schema_editor):
    LeaveBalance = apps.get_model('core', 'LeaveBalance')
    LeaveBalance.objects.filter(type='annual').update(total=ANNUAL_ALLOCATION)


def restore_annual_leave_to_25(apps, schema_editor):
    LeaveBalance = apps.get_model('core', 'LeaveBalance')
    LeaveBalance.objects.filter(type='annual').update(total=25)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_employeeprofile_google_sub_and_more'),
    ]

    operations = [
        migrations.RunPython(set_annual_leave_to_18, restore_annual_leave_to_25),
    ]
