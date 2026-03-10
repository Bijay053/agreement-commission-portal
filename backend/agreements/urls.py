from django.urls import path
from . import views

urlpatterns = [
    path('agreements', views.AgreementListView.as_view()),
    path('agreements/export', views.AgreementExportView.as_view()),
    path('agreements/status-counts', views.AgreementStatusCountsView.as_view()),
    path('agreements/alerts', views.AgreementAlertsView.as_view()),
    path('agreements/<int:agreement_id>', views.AgreementDetailView.as_view()),
]
