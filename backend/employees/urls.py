from django.urls import path
from . import views

urlpatterns = [
    path('employees', views.EmployeeListView.as_view()),
    path('employees/<uuid:employee_id>', views.EmployeeDetailView.as_view()),
]
