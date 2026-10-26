from django.urls import path
from .views import (
    PropertyListCreateView, 
    PropertyDetailView,
    PropertyImageListCreateView,
    PropertyImageDetailView,
    LocationListView
)

urlpatterns = [
    path('', PropertyListCreateView.as_view(), name='property-list-create'),
    path('locations/', LocationListView.as_view(), name='property-locations'),
    path('<int:pk>/', PropertyDetailView.as_view(), name='property-detail'),
    path('<int:property_pk>/images/', PropertyImageListCreateView.as_view(), name='property-image-list-create'),
    path('<int:property_pk>/images/<int:pk>/', PropertyImageDetailView.as_view(), name='property-image-detail'),
]
