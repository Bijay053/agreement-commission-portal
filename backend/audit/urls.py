from django.urls import path
from . import views

urlpatterns = [
    path('audit-logs', views.AuditLogListView.as_view()),
    path('audit/export', views.AuditLogExportView.as_view()),
]
