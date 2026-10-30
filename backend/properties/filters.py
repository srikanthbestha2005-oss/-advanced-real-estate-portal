import re
import operator
from functools import reduce
from django.db import models
import django_filters
from rest_framework import filters
from rest_framework.filters import search_smart_split
from rest_framework.fields import CharField

from .models import Property


def get_property_type_mapping():
    """
    Builds a mapping from lowercase search keywords/phrases to stored property_type codes
    based on Property.PROPERTY_TYPES choices.
    """
    mapping = {}
    for code, label in Property.PROPERTY_TYPES:
        code_lower = code.lower()
        label_lower = label.lower()

        # Direct code match (e.g. 'house' -> 'HOUSE', 'commercial_land' -> 'COMMERCIAL_LAND')
        mapping.setdefault(code_lower, set()).add(code)
        mapping.setdefault(code_lower.replace('_', ' '), set()).add(code)
        mapping.setdefault(code_lower.replace('_', ''), set()).add(code)
        mapping.setdefault(code_lower + 's', set()).add(code)

        # Full display label match (e.g. 'residential plot/land' -> 'PLOT')
        mapping.setdefault(label_lower, set()).add(code)
        mapping.setdefault(label_lower.replace('/', ' '), set()).add(code)

        # Label token words (e.g. 'Residential Plot/Land' -> 'plot', 'land'; 'Commercial Land' -> 'land')
        # We exclude generic non-property adjectives like 'residential'
        words = [w for w in re.split(r'[\s/,\-]+', label_lower) if w and w not in ('residential',)]
        for word in words:
            mapping.setdefault(word, set()).add(code)
            mapping.setdefault(word + 's', set()).add(code)

    # Multi-word display phrases
    mapping.setdefault('residential plot', set()).add('PLOT')
    mapping.setdefault('residential land', set()).add('PLOT')
    mapping.setdefault('plot/land', set()).add('PLOT')
    mapping.setdefault('plot land', set()).add('PLOT')
    mapping.setdefault('commercial land', set()).add('COMMERCIAL_LAND')

    return {k: sorted(list(v)) for k, v in mapping.items()}


PROPERTY_TYPE_MAPPING = get_property_type_mapping()
MULTI_WORD_PROPERTY_PHRASES = sorted(
    [k for k in PROPERTY_TYPE_MAPPING.keys() if ' ' in k or '/' in k],
    key=len,
    reverse=True
)


class PropertySearchFilter(filters.SearchFilter):
    """
    Custom SearchFilter that supports keyword searches across standard text fields
    as well as property types (e.g. house, apartment, villa, shop, land).
    Handles case differences, whitespace, and maps display labels to stored model values.
    """

    def get_search_terms(self, request):
        value = request.query_params.get(self.search_param, '')
        field = CharField(trim_whitespace=False, allow_blank=True)
        cleaned_value = field.run_validation(value)
        if not cleaned_value or not cleaned_value.strip():
            return []

        processed_value = cleaned_value.strip()
        for phrase in MULTI_WORD_PROPERTY_PHRASES:
            pattern = r'(?i)(?<![\"\w])' + re.escape(phrase) + r'(?![\"\w])'
            if re.search(pattern, processed_value):
                processed_value = re.sub(pattern, lambda m: f'"{m.group(0)}"', processed_value)
                break

        return search_smart_split(processed_value)

    def filter_queryset(self, request, queryset, view):
        search_fields = self.get_search_fields(view, request)
        search_terms = self.get_search_terms(request)

        if not search_fields or not search_terms:
            return queryset

        orm_lookups = [
            self.construct_search(str(search_field), queryset)
            for search_field in search_fields
        ]

        base = queryset
        conditions = []
        for term in search_terms:
            clean_term = term.strip().lower()
            queries = [models.Q(**{orm_lookup: term}) for orm_lookup in orm_lookups]

            matching_types = PROPERTY_TYPE_MAPPING.get(clean_term, [])
            if matching_types:
                queries.append(models.Q(property_type__in=matching_types))

            conditions.append(reduce(operator.or_, queries))

        queryset = queryset.filter(reduce(operator.and_, conditions))

        if self.must_call_distinct(queryset, search_fields):
            queryset = queryset.filter(pk=models.OuterRef('pk'))
            queryset = base.filter(models.Exists(queryset))
        return queryset


class PropertyFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr='lte')
    min_bedrooms = django_filters.NumberFilter(field_name="bedrooms", lookup_expr='gte')
    state = django_filters.CharFilter(field_name="state", lookup_expr='iexact')
    district = django_filters.CharFilter(field_name="district", lookup_expr='iexact')
    locality = django_filters.CharFilter(field_name="locality", lookup_expr='icontains')

    class Meta:
        model = Property
        fields = ['city', 'state', 'district', 'locality', 'property_type', 'listing_type', 'verification_status', 'status']
