from django.db import models


class DropdownOption(models.Model):
    id = models.AutoField(primary_key=True)
    category = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    label = models.CharField(max_length=255)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'dropdown_options'
        unique_together = ('category', 'value')
        ordering = ['sort_order', 'label']
