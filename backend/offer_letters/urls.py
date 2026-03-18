from django.urls import path
from . import views

urlpatterns = [
    path('offer-letters', views.OfferLetterListView.as_view()),
    path('offer-letters/<uuid:offer_id>', views.OfferLetterDetailView.as_view()),
    path('offer-letters/<uuid:offer_id>/status', views.OfferLetterStatusView.as_view()),
    path('offer-letters/<uuid:offer_id>/upload-signed', views.OfferLetterUploadSignedView.as_view()),
    path('offer-letters/<uuid:offer_id>/download', views.OfferLetterDownloadView.as_view()),
]
