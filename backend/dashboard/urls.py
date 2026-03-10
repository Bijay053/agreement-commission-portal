from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/stats', views.DashboardStatsView.as_view()),
    path('dashboard/expiring', views.DashboardExpiringView.as_view()),
    path('dashboard/recent', views.DashboardRecentView.as_view()),
]
