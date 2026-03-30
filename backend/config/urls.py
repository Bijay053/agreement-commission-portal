import os
from django.conf import settings
from django.urls import path, include, re_path
from django.http import FileResponse, HttpResponseNotFound
from accounts import views as account_views


def spa_view(request):
    index_path = os.path.join(settings.SPA_ROOT, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
    return HttpResponseNotFound('Frontend not built. Run: npm run build')


urlpatterns = [
    path('api/auth/', include('accounts.urls')),
    path('api/', include('providers.urls')),
    path('api/', include('agreements.urls')),
    path('api/', include('contacts.urls')),
    path('api/', include('targets.urls')),
    path('api/', include('commissions.urls')),
    path('api/', include('documents.urls')),
    path('api/', include('commission_tracker.urls')),
    path('api/', include('sub_agent.urls')),
    path('api/', include('audit.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('dashboard.urls')),
    path('api/', include('core.urls')),
    path('api/', include('templates_manager.urls')),
    path('api/', include('employees.urls')),
    path('api/', include('employment_agreements.urls')),
    path('api/', include('employee_documents.urls')),
    path('api/', include('offer_letters.urls')),
    path('api/', include('provider_commission.urls')),
    path('api/', include('hrms.urls')),
    path('api/', include('surveys.urls')),

    path('api/users', account_views.UsersListView.as_view()),
    path('api/users/<int:user_id>/roles', account_views.UserRolesView.as_view()),
    path('api/users/<int:user_id>/roles/<int:role_id>', account_views.UserRoleDeleteView.as_view()),
    path('api/users/<int:user_id>/name', account_views.UserNameUpdateView.as_view()),
    path('api/users/<int:user_id>/email', account_views.UserEmailUpdateView.as_view()),
    path('api/users/<int:user_id>/status', account_views.UserStatusUpdateView.as_view()),
    path('api/users/<int:user_id>/portal-access', account_views.UserPortalAccessUpdateView.as_view()),
    path('api/admin/users/<int:user_id>/sessions', account_views.AdminUserSessionsView.as_view()),
    path('api/admin/users/<int:user_id>/security-logs', account_views.AdminUserSecurityLogsView.as_view()),
    path('api/roles', account_views.RolesListView.as_view()),
    path('api/roles/<int:role_id>', account_views.RoleDetailView.as_view()),
    path('api/roles/<int:role_id>/permissions', account_views.RolePermissionsView.as_view()),
    path('api/roles/<int:role_id>/duplicate', account_views.RoleDuplicateView.as_view()),
]

if not settings.DEBUG or os.path.isdir(settings.SPA_ROOT):
    urlpatterns += [re_path(r'^(?!api/).*$', spa_view)]
