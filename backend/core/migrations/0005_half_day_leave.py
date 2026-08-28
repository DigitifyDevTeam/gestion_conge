from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_set_annual_leave_allocation_to_18'),
    ]

    operations = [
        migrations.AddField(
            model_name='leaverequest',
            name='half_day_period',
            field=models.CharField(
                blank=True,
                choices=[('morning', 'Matin'), ('afternoon', 'Après-midi')],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='leaverequest',
            name='days',
            field=models.DecimalField(decimal_places=1, max_digits=6),
        ),
        migrations.AlterField(
            model_name='leavebalance',
            name='total',
            field=models.DecimalField(decimal_places=1, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='leavebalance',
            name='used',
            field=models.DecimalField(decimal_places=1, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='leavebalance',
            name='pending',
            field=models.DecimalField(decimal_places=1, default=0, max_digits=6),
        ),
    ]
