from django.urls import path
from . import views

urlpatterns = [
    path('commission-tracker/dashboard', views.DashboardView.as_view()),
    path('commission-tracker/dashboard/<int:year>', views.DashboardYearView.as_view()),
    path('commission-tracker/students', views.StudentsListView.as_view()),
    path('commission-tracker/students/<int:student_id>', views.StudentDetailView.as_view()),
    path('commission-tracker/students/<int:student_id>/recalculate', views.StudentRecalculateView.as_view()),
    path('commission-tracker/students/<int:student_id>/providers', views.StudentProvidersView.as_view()),
    path('commission-tracker/students/<int:student_id>/providers/<int:provider_id>', views.StudentProviderDeleteView.as_view()),
    path('commission-tracker/students/<int:student_id>/entries', views.StudentEntriesView.as_view()),
    path('commission-tracker/all-student-providers', views.AllStudentProvidersView.as_view()),
    path('commission-tracker/student-providers/<int:provider_id>', views.StudentProviderUpdateView.as_view()),
    path('commission-tracker/entries/<int:entry_id>', views.EntryDetailView.as_view()),
    path('commission-tracker/all-entries', views.AllEntriesView.as_view()),
    path('commission-tracker/terms', views.TermsView.as_view()),
    path('commission-tracker/terms/<int:term_id>', views.TermDeleteView.as_view()),
    path('commission-tracker/export', views.CommissionTrackerExportView.as_view()),
    path('commission-tracker/filters', views.FiltersView.as_view()),
    path('commission-tracker/years', views.YearsView.as_view()),
    path('commission-tracker/sample-sheet', views.SampleSheetView.as_view()),
    path('commission-tracker/bulk-upload/preview', views.BulkUploadPreviewView.as_view()),
    path('commission-tracker/bulk-upload/confirm', views.BulkUploadConfirmView.as_view()),
    path('commission-tracker/provider-agreements-map', views.ProviderAgreementsMapView.as_view()),
]
