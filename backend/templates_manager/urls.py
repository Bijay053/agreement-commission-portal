from django.urls import path
from . import views

urlpatterns = [
    path('templates', views.TemplateListView.as_view()),
    path('templates/<uuid:template_id>', views.TemplateDetailView.as_view()),
    path('templates/<uuid:template_id>/duplicate', views.TemplateDuplicateView.as_view()),
    path('templates/seed-default', views.SeedDefaultTemplateView.as_view()),
]
