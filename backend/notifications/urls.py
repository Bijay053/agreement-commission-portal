from django.urls import path
from . import views
from . import template_views

urlpatterns = [
    path('agreement-notifications', views.NotificationListView.as_view()),
    path('agreements/trigger-notification-check', views.TriggerNotificationCheckView.as_view()),
    path('email-templates', template_views.EmailTemplateListView.as_view()),
    path('email-templates/<int:template_id>', template_views.EmailTemplateDetailView.as_view()),
    path('email-templates/<int:template_id>/preview', template_views.EmailTemplatePreviewView.as_view()),
]
