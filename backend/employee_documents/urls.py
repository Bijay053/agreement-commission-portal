from django.urls import path
from . import views

urlpatterns = [
    path('employees/<uuid:employee_id>/documents', views.EmployeeDocumentsView.as_view()),
    path('employee-documents/<uuid:document_id>/download', views.DocumentDownloadView.as_view()),
    path('employee-documents/<uuid:document_id>', views.DocumentDeleteView.as_view()),
]
