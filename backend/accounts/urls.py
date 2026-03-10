from django.urls import path
from . import views

urlpatterns = [
    path('login', views.LoginView.as_view()),
    path('verify-otp', views.VerifyOtpView.as_view()),
    path('resend-otp', views.ResendOtpView.as_view()),
    path('logout', views.LogoutView.as_view()),
    path('forgot-password', views.ForgotPasswordView.as_view()),
    path('reset-password', views.ResetPasswordView.as_view()),
    path('me', views.MeView.as_view()),
    path('client-info', views.ClientInfoView.as_view()),
    path('change-password', views.ChangePasswordView.as_view()),
    path('heartbeat', views.HeartbeatView.as_view()),
    path('sessions', views.SessionsView.as_view()),
    path('sessions/<int:session_id>/logout', views.SessionLogoutView.as_view()),
    path('logout-others', views.LogoutOthersView.as_view()),
    path('security-logs', views.SecurityLogsView.as_view()),
]
