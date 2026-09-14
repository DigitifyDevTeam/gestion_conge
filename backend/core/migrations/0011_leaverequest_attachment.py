from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_remove_comptable_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='leaverequest',
            name='attachment',
            field=models.FileField(
                blank=True,
                help_text='Pièce jointe obligatoire (justificatif).',
                null=True,
                upload_to='leave_attachments/%Y/%m/',
            ),
        ),
    ]
