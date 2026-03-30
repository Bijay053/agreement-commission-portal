from django.urls import path
from . import views

urlpatterns = [
    path('surveys', views.SurveyListView.as_view()),
    path('surveys/<int:survey_id>', views.SurveyDetailView.as_view()),
    path('surveys/<int:survey_id>/responses', views.SurveyResponsesView.as_view()),
    path('surveys/<int:survey_id>/report', views.SurveyReportView.as_view()),
    path('surveys/<int:survey_id>/export', views.SurveyExportView.as_view()),
    path('surveys/public/<uuid:survey_uuid>', views.PublicSurveyView.as_view()),
    path('surveys/public/<uuid:survey_uuid>/submit', views.PublicSurveySubmitView.as_view()),
]
