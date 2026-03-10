from django.db import models


class Provider(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    provider_type = models.CharField(max_length=32, default='university')
    country_id = models.IntegerField(null=True, blank=True)
    website = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=16, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'universities'
