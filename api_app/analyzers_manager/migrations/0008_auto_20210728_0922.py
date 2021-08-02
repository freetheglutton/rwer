# Generated by Django 3.2.4 on 2021-07-28 09:22

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api_app", "0008_remove_job_runtime_configuration"),
        ("analyzers_manager", "0007_analyzerreport_task_id"),
    ]

    operations = [
        migrations.RenameField(
            model_name="analyzerreport", old_name="analyzer_name", new_name="name"
        ),
        migrations.AlterUniqueTogether(
            name="analyzerreport", unique_together={("name", "job")}
        ),
    ]