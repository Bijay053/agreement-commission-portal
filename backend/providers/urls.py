from django.urls import path
from . import views

urlpatterns = [
    path('providers', views.ProviderListView.as_view()),
    path('providers/<int:provider_id>', views.ProviderDetailView.as_view()),
    path('universities', views.UniversityListView.as_view()),
]
