import uuid
from django.db import models


class EmploymentAgreement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    template_id = models.UUIDField(null=True, blank=True)
    agreement_date = models.DateField(null=True, blank=True)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    position = models.CharField(max_length=255, null=True, blank=True)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    clauses = models.JSONField(default=list)
    status = models.CharField(max_length=24, default='draft')
    pdf_url = models.TextField(null=True, blank=True)
    signature_data = models.TextField(null=True, blank=True)
    signing_token = models.CharField(max_length=128, unique=True, null=True, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    signed_pdf_url = models.TextField(null=True, blank=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employment_agreements'
        ordering = ['-created_at']
