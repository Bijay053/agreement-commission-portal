from django.urls import path
from . import views

urlpatterns = [
    path('employment-agreements', views.EmploymentAgreementListView.as_view()),
    path('employment-agreements/<uuid:agreement_id>', views.EmploymentAgreementDetailView.as_view()),
    path('employment-agreements/<uuid:agreement_id>/send-for-signing', views.SendForSigningView.as_view()),
    path('signing/verify/<str:token>', views.VerifySigningTokenView.as_view()),
    path('signing/submit/<str:token>', views.SubmitSignatureView.as_view()),
]
