from django.urls import path
from . import views
from .health import HealthCheckView
from .dropdown_views import DropdownOptionsView, DropdownOptionsAdminView

urlpatterns = [
    path('health', HealthCheckView.as_view()),
    path('countries', views.CountryListView.as_view()),
    path('admin/permissions/schema', views.PermissionSchemaView.as_view()),
    path('dropdown-options', DropdownOptionsView.as_view()),
    path('admin/dropdown-options', DropdownOptionsAdminView.as_view()),
]
