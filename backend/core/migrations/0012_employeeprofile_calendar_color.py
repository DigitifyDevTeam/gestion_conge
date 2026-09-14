from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_leaverequest_attachment'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeprofile',
            name='calendar_color',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Couleur calendrier (hex), ex. #3B82F6. Vide = couleur auto.',
                max_length=7,
            ),
        ),
    ]
