from django.urls import path
from . import views

urlpatterns = [
    path('provider-commission', views.ProviderCommissionListView.as_view()),
    path('provider-commission/config', views.ProviderCommissionConfigView.as_view()),
    path('provider-commission/sample', views.SampleDownloadView.as_view()),
    path('provider-commission/bulk-upload', views.BulkUploadView.as_view()),
    path('provider-commission/copy-rules', views.CopyFromCommissionRulesView.as_view()),
    path('provider-commission/<int:entry_id>', views.ProviderCommissionDetailView.as_view()),
]
