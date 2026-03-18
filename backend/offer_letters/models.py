import uuid
from django.db import models


OFFER_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('sent', 'Sent'),
    ('employee_signed', 'Employee Signed'),
    ('accepted', 'Accepted'),
    ('rejected', 'Rejected'),
    ('signed', 'Signed'),
    ('manually_signed', 'Manually Signed'),
    ('completed', 'Completed'),
]


class OfferLetter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    template_id = models.UUIDField(null=True, blank=True)
    title = models.CharField(max_length=255, default='Job Offer Letter')
    position = models.CharField(max_length=255, null=True, blank=True)
    department = models.CharField(max_length=128, null=True, blank=True)
    proposed_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_currency = models.CharField(max_length=3, default='NPR')
    issue_date = models.DateField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    work_location = models.CharField(max_length=255, null=True, blank=True)
    working_hours = models.CharField(max_length=128, null=True, blank=True)
    benefits = models.TextField(null=True, blank=True)
    probation_period = models.CharField(max_length=128, null=True, blank=True)
    clauses = models.JSONField(default=list)
    status = models.CharField(max_length=24, default='draft', choices=OFFER_STATUS_CHOICES)
    pdf_url = models.TextField(null=True, blank=True)
    signed_pdf_url = models.TextField(null=True, blank=True)
    manually_signed_pdf_url = models.TextField(null=True, blank=True)
    company_entity = models.CharField(max_length=24, default='nepal')
    notes = models.TextField(null=True, blank=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    signing_token = models.CharField(max_length=128, unique=True, null=True, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    signature_data = models.TextField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    esignature_metadata = models.JSONField(null=True, blank=True)
    pdf_password = models.CharField(max_length=32, null=True, blank=True)
    company_signature_data = models.TextField(null=True, blank=True)
    company_signer_name = models.CharField(max_length=255, null=True, blank=True)
    company_signer_position = models.CharField(max_length=255, null=True, blank=True)
    company_signed_at = models.DateTimeField(null=True, blank=True)
    company_esignature_metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'offer_letters'
        ordering = ['-created_at']
