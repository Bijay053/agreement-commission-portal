from django.db import models
from django.utils import timezone


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    pass


class SoftDeleteMixin(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)


class Country(models.Model):
    id = models.AutoField(primary_key=True)
    iso2 = models.CharField(max_length=2, unique=True)
    name = models.CharField(max_length=128)

    class Meta:
        managed = False
        db_table = 'countries'

    def __str__(self):
        return self.name


class StatusHistory(models.Model):
    id = models.AutoField(primary_key=True)
    entity_type = models.CharField(max_length=64)
    entity_id = models.IntegerField()
    old_status = models.CharField(max_length=64, null=True, blank=True)
    new_status = models.CharField(max_length=64)
    changed_by_user_id = models.IntegerField(null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'status_history'

    def __str__(self):
        return f"{self.entity_type}:{self.entity_id} {self.old_status} -> {self.new_status}"
