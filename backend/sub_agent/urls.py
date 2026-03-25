from django.urls import path
from . import views

urlpatterns = [
    path('sub-agent-commission/dashboard', views.SubAgentDashboardView.as_view()),
    path('sub-agent-commission/master', views.SubAgentMasterListView.as_view()),
    path('sub-agent-commission/master/<int:student_id>', views.SubAgentMasterUpdateView.as_view()),
    path('sub-agent-commission/sync', views.SubAgentSyncView.as_view()),
    path('sub-agent-commission/terms/<str:term_name>', views.SubAgentTermEntriesView.as_view()),
    path('sub-agent-commission/terms/<str:term_name>/entries/<int:entry_id>', views.SubAgentTermEntryUpdateView.as_view()),
    path('sub-agent-commission/prediction/<int:year>', views.SubAgentPredictionView.as_view()),
]
