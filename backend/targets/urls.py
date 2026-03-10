from django.urls import path
from . import views

urlpatterns = [
    path('agreements/<int:agreement_id>/targets', views.AgreementTargetsView.as_view()),
    path('targets/<int:target_id>', views.TargetDetailView.as_view()),
    path('targets/<int:target_id>/bonus-rules', views.TargetBonusRulesView.as_view()),
    path('bonus-rules/<int:rule_id>', views.BonusRuleDeleteView.as_view()),
    path('bonus-rules', views.AllBonusRulesView.as_view()),
    path('bonus/calculate', views.BonusCalculateView.as_view()),
]
