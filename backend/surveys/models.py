import uuid
from django.db import models


class Survey(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
        ('draft', 'Draft'),
    ]

    id = models.AutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='draft')
    created_by = models.IntegerField()
    captcha_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'surveys'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class SurveyQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('rating', 'Rating'),
        ('star_rating', 'Star Rating'),
        ('range', 'Range/Slider'),
        ('single_choice', 'Single Choice'),
        ('multiple_choice', 'Multiple Choice'),
        ('short_text', 'Short Text'),
        ('long_text', 'Long Text'),
        ('dropdown', 'Dropdown'),
    ]

    id = models.AutoField(primary_key=True)
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='questions')
    question_text = models.CharField(max_length=500)
    question_type = models.CharField(max_length=32, choices=QUESTION_TYPE_CHOICES)
    options = models.JSONField(default=list, blank=True)
    is_required = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'survey_questions'
        ordering = ['sort_order']

    def __str__(self):
        return f"{self.survey.title} - {self.question_text}"


class SurveyResponse(models.Model):
    id = models.AutoField(primary_key=True)
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='responses')
    respondent_ip = models.GenericIPAddressField(null=True, blank=True)
    session_id = models.CharField(max_length=64, blank=True, default='')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'survey_responses'
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Response to {self.survey.title} at {self.submitted_at}"


class SurveyAnswer(models.Model):
    id = models.AutoField(primary_key=True)
    response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(SurveyQuestion, on_delete=models.CASCADE, related_name='answers')
    answer_value = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'survey_answers'

    def __str__(self):
        return f"Answer to {self.question.question_text}"
