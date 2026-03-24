from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ProviderCommissionConfig',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('sub_agent_percentage', models.DecimalField(decimal_places=2, default=70.00, max_digits=5)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.IntegerField(blank=True, null=True)),
            ],
            options={
                'db_table': 'provider_commission_config',
            },
        ),
        migrations.CreateModel(
            name='ProviderCommissionEntry',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('provider_id', models.IntegerField()),
                ('degree_level', models.CharField(choices=[('any', 'Any'), ('undergraduate', 'Undergraduate'), ('postgraduate', 'Postgraduate'), ('vet', 'VET'), ('foundation', 'Foundation'), ('diploma', 'Diploma'), ('phd', 'PhD'), ('english', 'English Language')], default='any', max_length=32)),
                ('territory', models.CharField(blank=True, default='', max_length=255)),
                ('commission_value', models.DecimalField(decimal_places=2, max_digits=10)),
                ('commission_type', models.CharField(default='percentage', max_length=16)),
                ('currency', models.CharField(default='AUD', max_length=3)),
                ('commission_basis', models.CharField(choices=[('1_year', '1 Year'), ('2_semesters', '2 Semesters'), ('full_course', 'Full Course'), ('per_semester', 'Per Semester'), ('per_year', 'Per Year'), ('per_trimester', 'Per Trimester'), ('one_time', 'One Time')], default='full_course', max_length=32)),
                ('notes', models.TextField(blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('copied_from_rule_id', models.IntegerField(blank=True, null=True)),
                ('created_by', models.IntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'provider_commission_entries',
                'ordering': ['provider_id', 'degree_level'],
            },
        ),
    ]
