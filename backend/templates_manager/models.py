import uuid
from django.db import models


TEMPLATE_TYPE_CHOICES = [
    ('agreement', 'Employment Agreement'),
    ('offer_letter', 'Job Offer Letter'),
]


class AgreementTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    template_type = models.CharField(max_length=24, default='agreement', choices=TEMPLATE_TYPE_CHOICES)
    clauses = models.JSONField(default=list)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agreement_templates'
        ordering = ['-created_at']
