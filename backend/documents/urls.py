from django.urls import path
from . import views

urlpatterns = [
    path('agreements/<int:agreement_id>/documents', views.AgreementDocumentsView.as_view()),
    path('documents/<int:document_id>/view', views.DocumentViewView.as_view()),
    path('documents/<int:document_id>/download', views.DocumentDownloadView.as_view()),
    path('documents/<int:document_id>', views.DocumentDeleteView.as_view()),
]
