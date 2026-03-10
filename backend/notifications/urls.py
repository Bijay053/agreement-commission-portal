from django.urls import path
from . import views

urlpatterns = [
    path('agreement-notifications', views.NotificationListView.as_view()),
    path('agreements/trigger-notification-check', views.TriggerNotificationCheckView.as_view()),
]
