from django.db import migrations


def migrate_comptable_users_to_employee(apps, schema_editor):
    EmployeeProfile = apps.get_model('core', 'EmployeeProfile')
    EmployeeProfile.objects.filter(role='comptable').update(role='employee')


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0009_leaverequest_emergency'),
    ]

    operations = [
        migrations.RunPython(migrate_comptable_users_to_employee, migrations.RunPython.noop),
    ]
