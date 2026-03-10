from django.urls import path
from . import views

urlpatterns = [
    path('commission-rules', views.AllCommissionRulesView.as_view()),
    path('agreements/<int:agreement_id>/commission-rules', views.AgreementCommissionRulesView.as_view()),
    path('commission-rules/<int:rule_id>', views.CommissionRuleDetailView.as_view()),
]
