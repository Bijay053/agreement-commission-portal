from django.db import models
from core.models import SoftDeleteMixin


class AgreementDocument(SoftDeleteMixin):
    id = models.AutoField(primary_key=True)
    agreement_id = models.IntegerField()
    version_no = models.IntegerField()
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=64)
    size_bytes = models.IntegerField()
    storage_path = models.TextField()
    status = models.CharField(max_length=16, default='active')
    uploaded_by_user_id = models.IntegerField(null=True, blank=True)
    upload_note = models.TextField(null=True, blank=True)
    updated_by_user_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'agreement_documents'
