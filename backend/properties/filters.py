import django_filters
from .models import Property

class PropertyFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr='lte')
    min_bedrooms = django_filters.NumberFilter(field_name="bedrooms", lookup_expr='gte')
    district = django_filters.CharFilter(field_name="district", lookup_expr='iexact')
    locality = django_filters.CharFilter(field_name="locality", lookup_expr='icontains')

    class Meta:
        model = Property
        fields = ['city', 'state', 'district', 'locality', 'property_type', 'listing_type', 'verification_status', 'status']
