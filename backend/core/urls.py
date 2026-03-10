from django.urls import path
from . import views
from .health import HealthCheckView

urlpatterns = [
    path('health', HealthCheckView.as_view()),
    path('countries', views.CountryListView.as_view()),
    path('admin/permissions/schema', views.PermissionSchemaView.as_view()),
]
