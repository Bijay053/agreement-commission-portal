import uuid
from django.db import models


DOCUMENT_CATEGORIES = [
    ('cv', 'CV / Resume'),
    ('citizenship', 'Citizenship Certificate'),
    ('tax', 'Tax / PAN Document'),
    ('academic', 'Academic Certificates'),
    ('other', 'Other Documents'),
]


class EmployeeDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    category = models.CharField(max_length=24, choices=DOCUMENT_CATEGORIES)
    file_name = models.CharField(max_length=255)
    original_file_name = models.CharField(max_length=255)
    file_url = models.TextField()
    file_size = models.IntegerField(default=0)
    uploaded_by = models.CharField(max_length=255, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'employee_documents'
        ordering = ['-uploaded_at']
