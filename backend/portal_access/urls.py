from django.urls import path
from . import views

urlpatterns = [
    path('portal-access', views.PortalListView.as_view()),
    path('portal-access/categories', views.PortalCategoriesView.as_view()),
    path('portal-access/<int:portal_id>', views.PortalDetailView.as_view()),
    path('portal-access/<int:portal_id>/reveal', views.PortalRevealPasswordView.as_view()),
    path('portal-access/<int:portal_id>/rotate', views.PortalRotatePasswordView.as_view()),
    path('portal-access/<int:portal_id>/copy-username', views.PortalCopyUsernameView.as_view()),
    path('portal-access/<int:portal_id>/copy-password', views.PortalCopyPasswordView.as_view()),
    path('portal-access/<int:portal_id>/open', views.PortalOpenView.as_view()),
    path('portal-access/<int:portal_id>/open-and-fill', views.PortalOpenAndFillView.as_view()),
    path('portal-access/logs', views.PortalAccessLogListView.as_view()),
    path('portal-access/match', views.PortalMatchView.as_view()),
    path('portal-access/autofill-log', views.PortalAutofillLogView.as_view()),
]
