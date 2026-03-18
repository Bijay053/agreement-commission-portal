import uuid
from django.db import models


class Employee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, null=True, blank=True)
    position = models.CharField(max_length=255, null=True, blank=True)
    department = models.CharField(max_length=128, null=True, blank=True)
    citizenship_no = models.CharField(max_length=64, null=True, blank=True)
    pan_no = models.CharField(max_length=64, null=True, blank=True)
    permanent_address = models.TextField(null=True, blank=True)
    join_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employees'
        ordering = ['full_name']

    def __str__(self):
        return self.full_name
