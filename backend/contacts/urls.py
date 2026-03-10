from django.urls import path
from . import views

urlpatterns = [
    path('contacts', views.AllContactsView.as_view()),
    path('contacts/<int:contact_id>', views.ContactDetailView.as_view()),
    path('agreements/<int:agreement_id>/contacts', views.AgreementContactsView.as_view()),
]
